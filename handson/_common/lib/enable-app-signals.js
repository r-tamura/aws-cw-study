"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableAppSignals = enableAppSignals;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_lambda_1 = require("aws-cdk-lib/aws-lambda");
const aws_iam_1 = require("aws-cdk-lib/aws-iam");
const adot_layer_arns_1 = require("./adot-layer-arns");
const DISCOVERY_FLAG = Symbol.for('aws-cw-study.app-signals-discovery');
/**
 * Enable Application Signals on a Lambda function.
 *
 * - Adds the account-wide CfnDiscovery resource once per stack.
 * - Attaches the CloudWatchLambdaApplicationSignalsExecutionRolePolicy.
 * - Adds the AWS Distro for OpenTelemetry Lambda layer for the runtime.
 * - Sets AWS_LAMBDA_EXEC_WRAPPER so the layer auto-instruments the function.
 */
function enableAppSignals(fn, runtime) {
    const stack = aws_cdk_lib_1.Stack.of(fn);
    if (!stack[DISCOVERY_FLAG]) {
        new aws_cdk_lib_1.aws_applicationsignals.CfnDiscovery(stack, 'ApplicationSignalsDiscovery', {});
        stack[DISCOVERY_FLAG] = true;
    }
    fn.role?.addManagedPolicy(aws_iam_1.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLambdaApplicationSignalsExecutionRolePolicy'));
    const layerArn = (0, adot_layer_arns_1.getAdotLayerArn)(stack.region, runtime);
    fn.addLayers(aws_lambda_1.LayerVersion.fromLayerVersionArn(stack, `${fn.node.id}OtelLayer`, layerArn));
    fn.addEnvironment('AWS_LAMBDA_EXEC_WRAPPER', '/opt/otel-instrument');
}
