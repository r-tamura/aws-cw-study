import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  Dashboard,
  DashboardVariable,
  DefaultValue,
  VariableInputType,
  VariableType,
  Values,
  GraphWidget,
  SingleValueWidget,
  LogQueryWidget,
  LogQueryVisualizationType,
  AlarmWidget,
  Metric,
  MathExpression,
  Alarm,
  ComparisonOperator,
  TreatMissingData,
  Stats,
  PeriodOverride,
} from 'aws-cdk-lib/aws-cloudwatch';

/**
 * Ch 6 Dashboards hands-on stack.
 *
 * Provisions:
 * - A TypeScript Lambda that emits OrderCount / OrderLatency via EMF.
 * - An EventBridge 1-minute schedule that drives the Lambda.
 * - A `Dashboard` (`AwsCwStudy-Ch06`) with five widgets demonstrating the four
 *   core widget types plus a SearchExpression-driven dynamic GraphWidget.
 */
export class Ch06DashboardsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------
    // Lambda: order metrics emitter
    // -------------------------------------------------------------------
    const orderEmitterLogGroup = new LogGroup(this, 'OrderEmitterLogGroup', {
      logGroupName: '/aws/lambda/AwsCwStudy-Ch06-OrderEmitter',
      retention: RetentionDays.ONE_WEEK,
    });

    const orderEmitter = new Function(this, 'OrderEmitter', {
      functionName: 'AwsCwStudy-Ch06-OrderEmitter',
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset('lambda-ts/order-emitter'),
      timeout: Duration.seconds(10),
      logGroup: orderEmitterLogGroup,
      environment: {
        ENVIRONMENT: 'dev',
      },
    });

    // EventBridge: invoke Lambda every minute so the dashboard keeps moving.
    new Rule(this, 'OrderEmitterSchedule', {
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [new LambdaFunction(orderEmitter)],
    });

    // -------------------------------------------------------------------
    // Metrics references (keyed off Environment dashboard variable)
    // -------------------------------------------------------------------
    const namespace = 'AwsCwStudy/Ch06';
    const dimensions = { Environment: 'dev', ServiceName: 'order-service' };

    const orderCountMetric = new Metric({
      namespace,
      metricName: 'OrderCount',
      dimensionsMap: dimensions,
      statistic: Stats.SUM,
      period: Duration.minutes(1),
    });

    const orderLatencyMetric = new Metric({
      namespace,
      metricName: 'OrderLatency',
      dimensionsMap: dimensions,
      statistic: Stats.AVERAGE,
      period: Duration.minutes(1),
    });

    // MathExpression: average latency per order (m2 / m1).
    const latencyPerOrder = new MathExpression({
      expression: 'm2/m1',
      usingMetrics: {
        m1: orderCountMetric,
        m2: orderLatencyMetric,
      },
      label: 'Latency per order',
      period: Duration.minutes(1),
    });

    // -------------------------------------------------------------------
    // Alarm used by AlarmWidget
    // -------------------------------------------------------------------
    const latencyAlarm = new Alarm(this, 'OrderLatencyAlarm', {
      alarmName: 'AwsCwStudy-Ch06-OrderLatencyHigh',
      alarmDescription: 'OrderLatency average exceeds 1000 ms over 1 minute.',
      metric: orderLatencyMetric,
      threshold: 1000,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });

    // -------------------------------------------------------------------
    // Widgets
    // -------------------------------------------------------------------

    // (1) GraphWidget: 2 metrics + a MathExpression on the right axis.
    const graphWidget = new GraphWidget({
      title: 'Orders & Latency (with math)',
      width: 12,
      height: 6,
      left: [orderCountMetric, orderLatencyMetric],
      right: [latencyPerOrder],
      leftYAxis: { label: 'Count / Latency (ms)', showUnits: false },
      rightYAxis: { label: 'ms / order', showUnits: false },
    });

    // (2) SingleValueWidget: latest OrderLatency.
    const singleValueWidget = new SingleValueWidget({
      title: 'Latest OrderLatency',
      width: 6,
      height: 6,
      metrics: [orderLatencyMetric],
      sparkline: true,
      setPeriodToTimeRange: false,
    });

    // (3) LogQueryWidget: tail the Lambda log group with Logs Insights.
    const logQueryWidget = new LogQueryWidget({
      title: 'Recent emitter logs',
      width: 12,
      height: 6,
      logGroupNames: [orderEmitterLogGroup.logGroupName],
      view: LogQueryVisualizationType.TABLE,
      queryLines: [
        'fields @timestamp, OrderCount, OrderLatency, Environment',
        'sort @timestamp desc',
        'limit 20',
      ],
    });

    // (4) AlarmWidget: visualizes the OrderLatency alarm with its threshold band.
    const alarmWidget = new AlarmWidget({
      title: 'OrderLatency alarm state',
      width: 12,
      height: 6,
      alarm: latencyAlarm,
    });

    // (5) GraphWidget with SearchExpression: dynamically discover any metric
    //     under AwsCwStudy/Ch06 grouped by ServiceName. New services emitting
    //     into this namespace appear automatically without editing the dashboard.
    const searchExpression = new MathExpression({
      expression:
        "SEARCH('{AwsCwStudy/Ch06,Environment,ServiceName} MetricName=\"OrderLatency\"', 'Average', 60)",
      label: 'Discovered OrderLatency series',
      usingMetrics: {},
      period: Duration.minutes(1),
    });

    const searchWidget = new GraphWidget({
      title: 'Dynamic discovery (SearchExpression)',
      width: 24,
      height: 6,
      left: [searchExpression],
      leftYAxis: { showUnits: false, label: 'ms (Average)' },
    });

    // -------------------------------------------------------------------
    // Dashboard
    // -------------------------------------------------------------------
    const dashboard = new Dashboard(this, 'Ch06Dashboard', {
      dashboardName: 'AwsCwStudy-Ch06',
      defaultInterval: Duration.hours(1),
      periodOverride: PeriodOverride.AUTO,
    });

    // Dashboard variable: switches the `Environment` dimension across widgets.
    // Readers can flip between `dev` / `staging` / `prod` directly in the console.
    dashboard.addVariable(
      new DashboardVariable({
        id: 'environment',
        type: VariableType.PROPERTY,
        inputType: VariableInputType.SELECT,
        value: 'Environment',
        defaultValue: DefaultValue.value('dev'),
        values: Values.fromValues(
          { label: 'dev', value: 'dev' },
          { label: 'staging', value: 'staging' },
          { label: 'prod', value: 'prod' },
        ),
        label: 'Environment',
        visible: true,
      }),
    );

    dashboard.addWidgets(graphWidget, singleValueWidget);
    dashboard.addWidgets(logQueryWidget, alarmWidget);
    dashboard.addWidgets(searchWidget);

    // -------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------
    new CfnOutput(this, 'DashboardName', {
      value: dashboard.dashboardName,
      description: 'CloudWatch dashboard name.',
    });

    new CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'Direct URL to the deployed dashboard.',
    });

    new CfnOutput(this, 'AlarmName', {
      value: latencyAlarm.alarmName,
      description: 'Name of the OrderLatency alarm shown in AlarmWidget.',
    });
  }
}
