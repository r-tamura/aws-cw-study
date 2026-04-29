#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Ch06DashboardsStack } from '../lib/stack';

const app = new App();
new Ch06DashboardsStack(app, 'AwsCwStudyCh06Dashboards', {
  env: {
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});
