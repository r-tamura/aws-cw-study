import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class Ch03MetricsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const order = new Function(this, 'OrderMetrics', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset('lambda-ts/order-metrics'),
      timeout: Duration.seconds(10),
    });

    const inventory = new Function(this, 'InventoryMetrics', {
      runtime: Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: Code.fromAsset('lambda-py/inventory-metrics'),
      timeout: Duration.seconds(10),
    });

    const api = new HttpApi(this, 'Ch03Api');
    api.addRoutes({
      path: '/order',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('OrderInt', order),
    });
    api.addRoutes({
      path: '/inventory',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('InvInt', inventory),
    });

    new CfnOutput(this, 'ApiUrl', { value: api.apiEndpoint });
  }
}
