#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Chapter07Stack } from '../lib/stack';

const app = new App();
new Chapter07Stack(app, 'Chapter07Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});
