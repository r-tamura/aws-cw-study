#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Chapter09RumStack } from '../lib/stack';

const app = new cdk.App();
new Chapter09RumStack(app, 'AwsCwStudyChapter09', {
  description: 'aws-cw-study Chapter 9 RUM hands-on (S3 + CloudFront + Cognito + RUM AppMonitor)',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
