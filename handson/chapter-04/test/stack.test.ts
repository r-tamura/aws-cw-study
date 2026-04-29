import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Ch04LogsStack } from '../lib/stack';

describe('Ch04LogsStack', () => {
  const app = new App();
  const stack = new Ch04LogsStack(app, 'TestCh04', {
    env: { region: 'ap-northeast-1' },
  });
  const t = Template.fromStack(stack);

  test('produces 2 Lambda functions and 1 HTTP API', () => {
    t.resourceCountIs('AWS::Lambda::Function', 2);
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  });

  test('explicit log groups have 1 week retention', () => {
    t.resourceCountIs('AWS::Logs::LogGroup', 2);
    t.allResourcesProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });
  });

  test('metric filter sends ERROR logs to Ch04ErrorCount', () => {
    t.hasResourceProperties('AWS::Logs::MetricFilter', {
      FilterPattern: '{ $.level = "ERROR" }',
      MetricTransformations: Match.arrayWith([
        Match.objectLike({
          MetricNamespace: 'AwsCwStudy/Ch04',
          MetricName: 'Ch04ErrorCount',
          MetricValue: '1',
        }),
      ]),
    });
  });

  test('exposes ApiUrl and log group names as outputs', () => {
    t.hasOutput('ApiUrl', {});
    t.hasOutput('ApiHandlerLogGroupName', {});
    t.hasOutput('WorkerLogGroupName', {});
  });
});
