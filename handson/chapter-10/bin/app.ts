#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Ch10SyntheticsStack } from '../lib/stack';

const app = new App();

const targetUrl = app.node.tryGetContext('targetUrl') as string | undefined;

new Ch10SyntheticsStack(app, 'AwsCwStudyCh10Synthetics', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  targetUrl,
});
