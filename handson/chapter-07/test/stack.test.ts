import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Chapter07Stack } from '../lib/stack';

describe('Chapter07Stack', () => {
  const app = new App();
  const stack = new Chapter07Stack(app, 'TestChapter07Stack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const template = Template.fromStack(stack);

  test('creates exactly two Lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 2);
  });

  test('creates one DynamoDB table for inventory', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'Inventory',
      KeySchema: [{ AttributeName: 'sku', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('creates one HTTP API', () => {
    template.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'HTTP',
    });
  });

  test('creates exactly one ApplicationSignals::Discovery (shared across both Lambdas)', () => {
    template.resourceCountIs('AWS::ApplicationSignals::Discovery', 1);
  });

  test('both Lambdas get the AWS_LAMBDA_EXEC_WRAPPER env var', () => {
    const functions = template.findResources('AWS::Lambda::Function');
    const wrapped = Object.values(functions).filter((res) => {
      const env = (res.Properties as { Environment?: { Variables?: Record<string, string> } })
        .Environment?.Variables;
      return env?.AWS_LAMBDA_EXEC_WRAPPER === '/opt/otel-instrument';
    });
    expect(wrapped).toHaveLength(2);
  });
});
