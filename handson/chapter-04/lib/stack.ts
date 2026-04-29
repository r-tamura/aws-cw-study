import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays, MetricFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

/**
 * Ch 4 Logs ハンズオン用スタック。
 *
 * 構成:
 * - TypeScript Lambda (api-handler) — 構造化 JSON ログ (INFO/WARN/ERROR) を確率的に emit
 * - Python Lambda (worker)          — `logging` + JSON フォーマッタでジョブ処理ログを emit
 * - HTTP API (/api → TS, /work → Python)
 * - 各 Lambda に 1 週間保持の LogGroup を明示的に紐付け
 * - TS Lambda のロググループにメトリクスフィルタ (level=ERROR を Ch04ErrorCount にカウント)
 */
export class Ch04LogsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ----- TypeScript API handler -----
    const apiLogGroup = new LogGroup(this, 'ApiHandlerLogGroup', {
      logGroupName: '/aws/lambda/aws-cw-study-ch04-api-handler',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const apiHandler = new LambdaFunction(this, 'ApiHandler', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset('lambda-ts/api-handler'),
      timeout: Duration.seconds(10),
      logGroup: apiLogGroup,
      environment: {
        SERVICE_NAME: 'api-handler',
      },
    });

    // ----- Python worker -----
    const workerLogGroup = new LogGroup(this, 'WorkerLogGroup', {
      logGroupName: '/aws/lambda/aws-cw-study-ch04-worker',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const worker = new LambdaFunction(this, 'Worker', {
      runtime: Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: Code.fromAsset('lambda-py/worker'),
      timeout: Duration.seconds(10),
      logGroup: workerLogGroup,
      environment: {
        SERVICE_NAME: 'worker',
      },
    });

    // ----- HTTP API -----
    const api = new HttpApi(this, 'Ch04Api', {
      apiName: 'aws-cw-study-ch04',
    });
    api.addRoutes({
      path: '/api',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('ApiHandlerInt', apiHandler),
    });
    api.addRoutes({
      path: '/work',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration: new HttpLambdaIntegration('WorkerInt', worker),
    });

    // ----- Metric Filter: count of ERROR level logs -----
    new MetricFilter(this, 'ApiHandlerErrorMetricFilter', {
      logGroup: apiLogGroup,
      // JSON ログを `{ $.level = "ERROR" }` パターンでマッチ
      filterPattern: FilterPattern.stringValue('$.level', '=', 'ERROR'),
      metricNamespace: 'AwsCwStudy/Ch04',
      metricName: 'Ch04ErrorCount',
      metricValue: '1',
      defaultValue: 0,
    });

    // ----- Outputs -----
    new CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'HTTP API endpoint base URL',
    });
    new CfnOutput(this, 'ApiHandlerLogGroupName', {
      value: apiLogGroup.logGroupName,
      description: 'Log group for the TS api-handler Lambda',
    });
    new CfnOutput(this, 'WorkerLogGroupName', {
      value: workerLogGroup.logGroupName,
      description: 'Log group for the Python worker Lambda',
    });
  }
}
