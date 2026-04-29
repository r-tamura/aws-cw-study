import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Ch03MetricsStack } from '../lib/stack';

describe('Ch03MetricsStack', () => {
  test('synth produces 2 Lambda functions and 1 HTTP API', () => {
    const app = new App();
    const stack = new Ch03MetricsStack(app, 'TestCh03', {
      env: { region: 'ap-northeast-1' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::Lambda::Function', 2);
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  });

  test('exposes /order POST and /inventory GET routes', () => {
    const app = new App();
    const stack = new Ch03MetricsStack(app, 'TestCh03Routes', {
      env: { region: 'ap-northeast-1' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::ApiGatewayV2::Route', 2);
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /order',
    });
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /inventory',
    });
  });
});
