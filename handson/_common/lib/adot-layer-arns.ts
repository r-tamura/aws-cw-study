// AWS Distro for OpenTelemetry Lambda layer ARNs.
// Source of truth: https://aws-otel.github.io/docs/getting-started/lambda
// Update version suffix when AWS publishes a new layer.
export const ADOT_LAYER_ARNS = {
  'ap-northeast-1': {
    python: 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:13',
    nodejs: 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroJs:7',
  },
  'us-east-1': {
    python: 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:13',
    nodejs: 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroJs:7',
  },
} as const;

export type SupportedRegion = keyof typeof ADOT_LAYER_ARNS;
export type LambdaRuntime = 'python' | 'nodejs';

export function getAdotLayerArn(region: string, runtime: LambdaRuntime): string {
  const entry = (ADOT_LAYER_ARNS as Record<string, { python: string; nodejs: string }>)[region];
  if (!entry) {
    throw new Error(
      `No ADOT layer ARN registered for region ${region}. ` +
        `Add it to handson/_common/lib/adot-layer-arns.ts.`,
    );
  }
  return entry[runtime];
}
