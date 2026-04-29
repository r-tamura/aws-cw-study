import {
  Stack,
  StackProps,
  Duration,
  CfnOutput,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  Metric,
  Alarm,
  AlarmRule,
  AlarmState,
  ComparisonOperator,
  CompositeAlarm,
  CfnAnomalyDetector,
  CfnAlarm,
  TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets';

export interface Ch05AlarmsStackProps extends StackProps {
  /** Email address that receives SNS notifications when an alarm fires. */
  readonly notificationEmail: string;
}

const NAMESPACE = 'AwsCwStudy/Ch05';
const METRIC_NAME = 'OrderValue';
const SERVICE_NAME = 'spike-emitter';
const OPERATION = 'CreateOrder';

export class Ch05AlarmsStack extends Stack {
  constructor(scope: Construct, id: string, props: Ch05AlarmsStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------
    // 1. Spike emitter Lambda + EventBridge schedule (every minute)
    // ------------------------------------------------------------------
    const emitter = new LambdaFunction(this, 'SpikeEmitter', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: Code.fromAsset('lambda-ts/spike-emitter'),
      timeout: Duration.seconds(10),
      memorySize: 128,
      logGroup: new LogGroup(this, 'SpikeEmitterLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    new Rule(this, 'EveryMinuteSchedule', {
      description: 'Drives the spike-emitter Lambda once per minute so the metric has data.',
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [new LambdaFunctionTarget(emitter)],
    });

    // ------------------------------------------------------------------
    // 2. SNS Topic + Email subscription used by every alarm.
    // ------------------------------------------------------------------
    const topic = new Topic(this, 'AlarmTopic', {
      displayName: 'aws-cw-study Ch05 alarms',
    });
    topic.addSubscription(new EmailSubscription(props.notificationEmail));
    const snsAction = new SnsAction(topic);

    // ------------------------------------------------------------------
    // 3. Reference the OrderValue metric emitted via EMF.
    // ------------------------------------------------------------------
    const orderValue = new Metric({
      namespace: NAMESPACE,
      metricName: METRIC_NAME,
      dimensionsMap: {
        ServiceName: SERVICE_NAME,
        Operation: OPERATION,
      },
      statistic: 'Average',
      period: Duration.minutes(1),
    });

    // ------------------------------------------------------------------
    // 4. Static threshold alarm — fires when OrderValue > 800.
    // ------------------------------------------------------------------
    const staticAlarm = new Alarm(this, 'OrderValueHighAlarm', {
      alarmName: 'AwsCwStudyCh05-OrderValueHigh',
      alarmDescription:
        'Static threshold: average OrderValue exceeds 800 over a 1 minute period.',
      metric: orderValue,
      threshold: 800,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    staticAlarm.addAlarmAction(snsAction);

    // ------------------------------------------------------------------
    // 5. Anomaly Detection alarm — band-based on the same metric.
    //    The high-level Alarm L2 construct does not currently expose
    //    band-thresholds, so we drop down to CfnAnomalyDetector + CfnAlarm.
    // ------------------------------------------------------------------
    new CfnAnomalyDetector(this, 'OrderValueAnomalyDetector', {
      namespace: NAMESPACE,
      metricName: METRIC_NAME,
      stat: 'Average',
      dimensions: [
        { name: 'ServiceName', value: SERVICE_NAME },
        { name: 'Operation', value: OPERATION },
      ],
    });

    const anomalyAlarm = new CfnAlarm(this, 'OrderValueAnomalyAlarm', {
      alarmName: 'AwsCwStudyCh05-OrderValueAnomaly',
      alarmDescription:
        'Anomaly detection band: OrderValue falls outside the predicted band (stdev=2).',
      comparisonOperator: 'GreaterThanUpperThreshold',
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      thresholdMetricId: 'ad1',
      treatMissingData: 'notBreaching',
      alarmActions: [topic.topicArn],
      metrics: [
        {
          id: 'm1',
          metricStat: {
            metric: {
              namespace: NAMESPACE,
              metricName: METRIC_NAME,
              dimensions: [
                { name: 'ServiceName', value: SERVICE_NAME },
                { name: 'Operation', value: OPERATION },
              ],
            },
            period: 60,
            stat: 'Average',
          },
          returnData: true,
        },
        {
          id: 'ad1',
          expression: 'ANOMALY_DETECTION_BAND(m1, 2)',
          label: 'OrderValue (expected band)',
          returnData: true,
        },
      ],
    });

    // Wrap the L1 anomaly alarm so we can reference it from the composite alarm.
    const anomalyAlarmRef = Alarm.fromAlarmArn(
      this,
      'OrderValueAnomalyAlarmRef',
      this.formatArn({
        service: 'cloudwatch',
        resource: 'alarm',
        resourceName: anomalyAlarm.alarmName!,
        arnFormat: undefined,
      }),
    );

    // ------------------------------------------------------------------
    // 6. Composite alarm — fires only when *both* child alarms are ALARM.
    // ------------------------------------------------------------------
    const composite = new CompositeAlarm(this, 'OrderValueCompositeAlarm', {
      compositeAlarmName: 'AwsCwStudyCh05-OrderValueComposite',
      alarmDescription:
        'Composite: static threshold AND anomaly band both in ALARM. Reduces noise from single-source alerts.',
      alarmRule: AlarmRule.allOf(
        AlarmRule.fromAlarm(staticAlarm, AlarmState.ALARM),
        AlarmRule.fromAlarm(anomalyAlarmRef, AlarmState.ALARM),
      ),
    });
    composite.addAlarmAction(snsAction);

    // ------------------------------------------------------------------
    // 7. Outputs.
    // ------------------------------------------------------------------
    new CfnOutput(this, 'EmitterFunctionName', { value: emitter.functionName });
    new CfnOutput(this, 'AlarmTopicArn', { value: topic.topicArn });
    new CfnOutput(this, 'StaticAlarmName', { value: staticAlarm.alarmName });
    new CfnOutput(this, 'AnomalyAlarmName', { value: anomalyAlarm.alarmName! });
    new CfnOutput(this, 'CompositeAlarmName', {
      value: composite.alarmName,
    });
  }
}
