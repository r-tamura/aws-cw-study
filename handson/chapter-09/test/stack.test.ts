import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { Chapter09RumStack } from '../lib/stack';

describe('Chapter09RumStack', () => {
  const app = new cdk.App();
  const stack = new Chapter09RumStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);

  test('creates a private S3 bucket with autoDeleteObjects', () => {
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('creates a CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('creates a Cognito Identity Pool with unauth identities allowed', () => {
    template.hasResourceProperties('AWS::Cognito::IdentityPool', {
      AllowUnauthenticatedIdentities: true,
    });
  });

  test('unauth role policy allows rum:PutRumEvents on the AppMonitor ARN', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'rum:PutRumEvents',
            Effect: 'Allow',
            Resource: Match.objectLike({
              'Fn::Join': Match.arrayWith([
                Match.arrayWith([
                  Match.stringLikeRegexp('appmonitor/aws-cw-study-ch09'),
                ]),
              ]),
            }),
          }),
        ]),
      },
    });
  });

  test('creates a CloudWatch RUM AppMonitor with the expected name and config', () => {
    template.hasResourceProperties('AWS::RUM::AppMonitor', {
      Name: 'aws-cw-study-ch09',
      CwLogEnabled: true,
      AppMonitorConfiguration: Match.objectLike({
        SessionSampleRate: 1,
        Telemetries: ['errors', 'performance', 'http'],
      }),
    });
  });

  test('emits the outputs the README tells the user to copy', () => {
    template.hasOutput('CloudFrontUrl', {});
    template.hasOutput('AppMonitorName', {});
    template.hasOutput('IdentityPoolId', {});
    template.hasOutput('GuestRoleArn', {});
    template.hasOutput('Region', {});
  });
});
