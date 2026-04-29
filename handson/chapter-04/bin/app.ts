#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Ch04LogsStack } from '../lib/stack';

const app = new App();
new Ch04LogsStack(app, 'AwsCwStudyCh04Logs', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});
