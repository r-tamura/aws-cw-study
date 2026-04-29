"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADOT_LAYER_ARNS = void 0;
exports.getAdotLayerArn = getAdotLayerArn;
// AWS Distro for OpenTelemetry Lambda layer ARNs.
// Source of truth: https://aws-otel.github.io/docs/getting-started/lambda
// Update version suffix when AWS publishes a new layer.
exports.ADOT_LAYER_ARNS = {
    'ap-northeast-1': {
        python: 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroPython:13',
        nodejs: 'arn:aws:lambda:ap-northeast-1:615299751070:layer:AWSOpenTelemetryDistroJs:7',
    },
    'us-east-1': {
        python: 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroPython:13',
        nodejs: 'arn:aws:lambda:us-east-1:615299751070:layer:AWSOpenTelemetryDistroJs:7',
    },
};
function getAdotLayerArn(region, runtime) {
    const entry = exports.ADOT_LAYER_ARNS[region];
    if (!entry) {
        throw new Error(`No ADOT layer ARN registered for region ${region}. ` +
            `Add it to handson/_common/lib/adot-layer-arns.ts.`);
    }
    return entry[runtime];
}
