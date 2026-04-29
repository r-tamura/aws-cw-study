#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { Ch05AlarmsStack } from '../lib/stack';

const app = new App();

const email =
  (app.node.tryGetContext('email') as string | undefined) ?? 'nobody@example.com';

new Ch05AlarmsStack(app, 'AwsCwStudyCh05Alarms', {
  env: { region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1' },
  notificationEmail: email,
});
