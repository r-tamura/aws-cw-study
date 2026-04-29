import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Bucket,
  BlockPublicAccess,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';

export interface Ch10SyntheticsStackProps extends StackProps {
  /**
   * Target URL for the API canary. Falls back to https://example.com/ which
   * always returns 200 so the hands-on works out of the box.
   */
  readonly targetUrl?: string;
}

/**
 * Phase 3a / Chapter 10: 3 Synthetics canaries (Heartbeat, API, Multi-checks)
 * sharing one S3 artifact bucket. X-Ray tracing is enabled so the canaries
 * appear under the "Synthetics canaries" tab on every Application Signals
 * service detail page they touch.
 */
export class Ch10SyntheticsStack extends Stack {
  constructor(scope: Construct, id: string, props: Ch10SyntheticsStackProps = {}) {
    super(scope, id, props);

    const targetUrl = props.targetUrl ?? 'https://example.com/';

    // ---------------------------------------------------------------------
    // Shared artifact bucket
    // ---------------------------------------------------------------------
    const artifactBucket = new Bucket(this, 'CanaryArtifacts', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    // ---------------------------------------------------------------------
    // Canary 1: Heartbeat against https://aws.amazon.com/
    // ---------------------------------------------------------------------
    const heartbeat = new synthetics.Canary(this, 'HeartbeatCanary', {
      canaryName: 'cw-study-heartbeat',
      schedule: synthetics.Schedule.rate(Duration.minutes(5)),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_9_1,
      artifactsBucketLocation: { bucket: artifactBucket, prefix: 'heartbeat' },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset('canaries/heartbeat'),
        handler: 'index.handler',
      }),
      environmentVariables: {
        TARGET_URL: 'https://aws.amazon.com/',
      },
      provisionedResourceCleanup: true,
      activeTracing: true,
      startAfterCreation: true,
    });

    // ---------------------------------------------------------------------
    // Canary 2: API canary against the user-supplied target URL
    // ---------------------------------------------------------------------
    const api = new synthetics.Canary(this, 'ApiCanary', {
      canaryName: 'cw-study-api',
      schedule: synthetics.Schedule.rate(Duration.minutes(5)),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_9_1,
      artifactsBucketLocation: { bucket: artifactBucket, prefix: 'api' },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset('canaries/api'),
        handler: 'index.handler',
      }),
      environmentVariables: {
        TARGET_URL: targetUrl,
      },
      provisionedResourceCleanup: true,
      activeTracing: true,
      startAfterCreation: true,
    });

    // ---------------------------------------------------------------------
    // Canary 3: Multi-checks (HTTP + DNS + SSL) on the Playwright runtime
    //
    // L2 `Canary` does not yet surface the BlueprintTypes property, so we
    // reach through the L1 `CfnCanary` to flip it.
    // ---------------------------------------------------------------------
    // NOTE: the Playwright runtime does not support `activeTracing` (it is
    // wired through Application Signals automatically when a canary runs
    // against an Application-Signals-instrumented service), so we leave it
    // off here. The Heartbeat and API canaries above still emit X-Ray traces.
    const multi = new synthetics.Canary(this, 'MultiChecksCanary', {
      canaryName: 'cw-study-multi-checks',
      schedule: synthetics.Schedule.rate(Duration.minutes(5)),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_3_0,
      artifactsBucketLocation: { bucket: artifactBucket, prefix: 'multi-checks' },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset('canaries/multi-checks'),
        handler: 'index.handler',
      }),
      provisionedResourceCleanup: true,
      startAfterCreation: true,
    });

    // L2 `Canary` does not surface BlueprintTypes yet, so we reach through
    // the L1 to mark this canary as a multi-checks blueprint canary. The
    // runtime then reads `blueprint-config.json` from the asset bundle and
    // executes the declared HTTP / DNS / SSL checks.
    const multiCfn = multi.node.defaultChild as synthetics.CfnCanary;
    multiCfn.addPropertyOverride('BlueprintTypes', ['multi-checks']);

    // ---------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------
    new CfnOutput(this, 'ArtifactBucketName', { value: artifactBucket.bucketName });
    new CfnOutput(this, 'HeartbeatCanaryName', { value: heartbeat.canaryName });
    new CfnOutput(this, 'ApiCanaryName', { value: api.canaryName });
    new CfnOutput(this, 'MultiChecksCanaryName', { value: multi.canaryName });
    new CfnOutput(this, 'ApiTargetUrl', { value: targetUrl });
  }
}
