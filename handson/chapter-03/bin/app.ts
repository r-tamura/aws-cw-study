#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Ch03MetricsStack } from '../lib/stack';

const app = new App();
new Ch03MetricsStack(app, 'AwsCwStudyCh03Metrics', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
