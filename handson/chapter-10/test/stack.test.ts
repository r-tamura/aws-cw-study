import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Ch10SyntheticsStack } from '../lib/stack';

function synth(targetUrl?: string) {
  const app = new App();
  const stack = new Ch10SyntheticsStack(app, 'TestCh10', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
    targetUrl,
  });
  return Template.fromStack(stack);
}

describe('Ch10SyntheticsStack', () => {
  test('creates exactly 3 canaries', () => {
    const t = synth();
    t.resourceCountIs('AWS::Synthetics::Canary', 3);
  });

  test('creates a single artifact S3 bucket', () => {
    const t = synth();
    t.resourceCountIs('AWS::S3::Bucket', 1);
  });

  test('Puppeteer canaries enable X-Ray active tracing', () => {
    const t = synth();
    // Heartbeat + API are on the Puppeteer runtime and have ActiveTracing.
    // Multi-checks runs on the Playwright runtime, which does not support
    // ActiveTracing (it integrates with Application Signals via a different path).
    const canaries = t.findResources('AWS::Synthetics::Canary');
    const tracingValues = Object.values(canaries).map(
      (c) => (c.Properties.RunConfig?.ActiveTracing as boolean | undefined) === true,
    );
    const tracedCount = tracingValues.filter(Boolean).length;
    expect(tracedCount).toBe(2);
  });

  test('all canaries set ProvisionedResourceCleanup', () => {
    const t = synth();
    const canaries = t.findResources('AWS::Synthetics::Canary');
    for (const c of Object.values(canaries)) {
      expect(c.Properties.ProvisionedResourceCleanup).toBe('AUTOMATIC');
    }
  });

  test('multi-checks canary declares BlueprintTypes', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Synthetics::Canary', {
      Name: 'cw-study-multi-checks',
      BlueprintTypes: ['multi-checks'],
    });
  });

  test('api canary uses targetUrl from context', () => {
    const t = synth('https://my-api.example.com/health');
    t.hasResourceProperties('AWS::Synthetics::Canary', {
      Name: 'cw-study-api',
      RunConfig: Match.objectLike({
        EnvironmentVariables: Match.objectLike({
          TARGET_URL: 'https://my-api.example.com/health',
        }),
      }),
    });
  });

  test('heartbeat canary targets aws.amazon.com', () => {
    const t = synth();
    t.hasResourceProperties('AWS::Synthetics::Canary', {
      Name: 'cw-study-heartbeat',
      RunConfig: Match.objectLike({
        EnvironmentVariables: Match.objectLike({
          TARGET_URL: 'https://aws.amazon.com/',
        }),
      }),
    });
  });
});
