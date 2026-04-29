import { Stack, aws_applicationsignals as appsignals } from 'aws-cdk-lib';
import { Function as LambdaFunction, LayerVersion } from 'aws-cdk-lib/aws-lambda';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { getAdotLayerArn, LambdaRuntime } from './adot-layer-arns';

const DISCOVERY_FLAG = Symbol.for('aws-cw-study.app-signals-discovery');

interface StackWithDiscovery extends Stack {
  [DISCOVERY_FLAG]?: true;
}

/**
 * Enable Application Signals on a Lambda function.
 *
 * - Adds the account-wide CfnDiscovery resource once per stack.
 * - Attaches the CloudWatchLambdaApplicationSignalsExecutionRolePolicy.
 * - Adds the AWS Distro for OpenTelemetry Lambda layer for the runtime.
 * - Sets AWS_LAMBDA_EXEC_WRAPPER so the layer auto-instruments the function.
 */
export function enableAppSignals(fn: LambdaFunction, runtime: LambdaRuntime): void {
  const stack = Stack.of(fn) as StackWithDiscovery;

  if (!stack[DISCOVERY_FLAG]) {
    new appsignals.CfnDiscovery(stack, 'ApplicationSignalsDiscovery', {});
    stack[DISCOVERY_FLAG] = true;
  }

  fn.role?.addManagedPolicy(
    ManagedPolicy.fromAwsManagedPolicyName(
      'CloudWatchLambdaApplicationSignalsExecutionRolePolicy',
    ),
  );

  const layerArn = getAdotLayerArn(stack.region, runtime);
  fn.addLayers(
    LayerVersion.fromLayerVersionArn(stack, `${fn.node.id}OtelLayer`, layerArn),
  );

  fn.addEnvironment('AWS_LAMBDA_EXEC_WRAPPER', '/opt/otel-instrument');
}
