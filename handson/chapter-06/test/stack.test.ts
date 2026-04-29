import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Ch06DashboardsStack } from '../lib/stack';

describe('Ch06DashboardsStack', () => {
  const app = new App();
  const stack = new Ch06DashboardsStack(app, 'TestCh06', {
    env: { region: 'ap-northeast-1', account: '123456789012' },
  });
  const template = Template.fromStack(stack);

  test('provisions exactly one Lambda function', () => {
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('schedules the Lambda on a 1-minute EventBridge rule', () => {
    template.resourceCountIs('AWS::Events::Rule', 1);
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 minute)',
    });
  });

  test('creates exactly one Dashboard named AwsCwStudy-Ch06', () => {
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'AwsCwStudy-Ch06',
    });
  });

  test('creates exactly one OrderLatency alarm above threshold 1000', () => {
    template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'AwsCwStudy-Ch06-OrderLatencyHigh',
      Threshold: 1000,
      ComparisonOperator: 'GreaterThanThreshold',
      MetricName: 'OrderLatency',
      Namespace: 'AwsCwStudy/Ch06',
    });
  });

  // Helper: dashboard bodies are usually emitted as Fn::Join with embedded
  // refs (Lambda log group ARN, alarm ARN, etc). Flatten the join into a
  // single string preserving Ref / GetAtt as readable placeholders.
  function flattenDashboardBody(): string {
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    const raw = Object.values(dashboards)[0].Properties?.DashboardBody as
      | string
      | { 'Fn::Join': [string, unknown[]] };
    if (typeof raw === 'string') return raw;
    return (raw['Fn::Join'][1] as unknown[])
      .map((p) => {
        if (typeof p === 'string') return p;
        if (p && typeof p === 'object') {
          const obj = p as Record<string, unknown>;
          if ('Ref' in obj) return `<<Ref:${String(obj.Ref)}>>`;
          if ('Fn::GetAtt' in obj) {
            const v = obj['Fn::GetAtt'] as unknown[];
            return `<<GetAtt:${v.join('.')}>>`;
          }
        }
        return '';
      })
      .join('');
  }

  test('dashboard body contains all four required widget types', () => {
    const flattened = flattenDashboardBody();

    // GraphWidget / SingleValueWidget => view: timeSeries / singleValue
    expect(flattened).toContain('"view":"timeSeries"');
    expect(flattened).toContain('"view":"singleValue"');
    // LogQueryWidget => type "log"
    expect(flattened).toContain('"type":"log"');
    // AlarmWidget => annotations.alarms with the alarm ARN
    expect(flattened).toContain('"alarms"');
    // SearchExpression demonstration
    expect(flattened).toContain('SEARCH(');
  });

  test('dashboard exposes an Environment variable', () => {
    const flattened = flattenDashboardBody();
    expect(flattened).toContain('"variables"');
    expect(flattened).toContain('"Environment"');
  });

  test('LogQueryWidget references the order-emitter log group', () => {
    const flattened = flattenDashboardBody();
    // The log group is wired in via a CloudFormation Ref to the LogGroup
    // resource, which our flattener stringifies as <<Ref:OrderEmitterLogGroup...>>.
    expect(flattened).toMatch(/<<Ref:OrderEmitterLogGroup/);
  });

  test('AlarmWidget references the OrderLatency alarm', () => {
    const flattened = flattenDashboardBody();
    // Alarm ARN comes through as Fn::GetAtt OrderLatencyAlarm.Arn
    expect(flattened).toMatch(/<<GetAtt:OrderLatencyAlarm[^.]*\.Arn>>/);
  });
});
