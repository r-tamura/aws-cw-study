import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Ch05AlarmsStack } from '../lib/stack';

function synth(): Template {
  const app = new App();
  const stack = new Ch05AlarmsStack(app, 'TestCh05', {
    env: { region: 'ap-northeast-1' },
    notificationEmail: 'nobody@example.com',
  });
  return Template.fromStack(stack);
}

describe('Ch05AlarmsStack', () => {
  test('synth produces the spike emitter Lambda + EventBridge schedule', () => {
    const t = synth();
    t.resourceCountIs('AWS::Lambda::Function', 1);
    t.resourceCountIs('AWS::Events::Rule', 1);
    t.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 minute)',
    });
  });

  test('SNS topic has an email subscription', () => {
    const t = synth();
    t.resourceCountIs('AWS::SNS::Topic', 1);
    t.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'nobody@example.com',
    });
  });

  test('static threshold alarm fires above 800', () => {
    const t = synth();
    t.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'AwsCwStudyCh05-OrderValueHigh',
      Threshold: 800,
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'OrderValue',
      Namespace: 'AwsCwStudy/Ch05',
    });
  });

  test('anomaly detector + anomaly alarm reference the same metric', () => {
    const t = synth();
    t.resourceCountIs('AWS::CloudWatch::AnomalyDetector', 1);
    t.hasResourceProperties('AWS::CloudWatch::AnomalyDetector', {
      Namespace: 'AwsCwStudy/Ch05',
      MetricName: 'OrderValue',
      Stat: 'Average',
    });
    t.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'AwsCwStudyCh05-OrderValueAnomaly',
      ComparisonOperator: 'GreaterThanUpperThreshold',
      ThresholdMetricId: 'ad1',
      Metrics: Match.arrayWith([
        Match.objectLike({
          Id: 'ad1',
          Expression: 'ANOMALY_DETECTION_BAND(m1, 2)',
        }),
      ]),
    });
  });

  test('composite alarm AND-combines the two child alarms', () => {
    const t = synth();
    t.resourceCountIs('AWS::CloudWatch::CompositeAlarm', 1);
    const composites = t.findResources('AWS::CloudWatch::CompositeAlarm');
    const props = Object.values(composites)[0].Properties as { AlarmRule: unknown };
    // The rule renders to Fn::Join'd CFN intrinsics. Stringify and check for
    // AND + both child alarm names.
    const rendered = JSON.stringify(props.AlarmRule);
    expect(rendered).toContain('AND');
    expect(rendered).toContain('AwsCwStudyCh05-OrderValueAnomaly');
    // The static alarm is referenced by Ref/GetAtt rather than literal name,
    // so we just check that the composite has two operands joined by AND.
    expect((rendered.match(/ALARM/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test('all three alarms have an SNS action wired up', () => {
    const t = synth();
    // Static alarm + anomaly alarm = AWS::CloudWatch::Alarm with AlarmActions
    const alarms = t.findResources('AWS::CloudWatch::Alarm');
    const alarmActionCount = Object.values(alarms).filter(
      (r) => Array.isArray((r.Properties as { AlarmActions?: unknown[] }).AlarmActions),
    ).length;
    expect(alarmActionCount).toBe(2);

    const composites = t.findResources('AWS::CloudWatch::CompositeAlarm');
    expect(
      Object.values(composites).every((r) =>
        Array.isArray((r.Properties as { AlarmActions?: unknown[] }).AlarmActions),
      ),
    ).toBe(true);
  });
});
