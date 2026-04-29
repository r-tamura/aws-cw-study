import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';

const APP_MONITOR_NAME = 'aws-cw-study-ch09';

export class Chapter09RumStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------
    // 1. S3 bucket for static site (private; CloudFront reads via OAC)
    // -------------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
    });

    // -------------------------------------------------------------------
    // 2. CloudFront distribution with Origin Access Control to S3
    // -------------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // hands-on: see updates immediately
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // -------------------------------------------------------------------
    // 3. Upload web/ contents to the bucket
    // -------------------------------------------------------------------
    new s3deploy.BucketDeployment(this, 'DeployWeb', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '..', 'web'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // -------------------------------------------------------------------
    // 4. Cognito Identity Pool that allows unauthenticated identities
    // -------------------------------------------------------------------
    const identityPool = new cognito.CfnIdentityPool(this, 'RumIdentityPool', {
      allowUnauthenticatedIdentities: true,
      identityPoolName: 'aws-cw-study-ch09-rum',
    });

    // RUM AppMonitor ARN (constructed in advance so the role policy can reference it)
    const appMonitorArn = cdk.Stack.of(this).formatArn({
      service: 'rum',
      resource: 'appmonitor',
      resourceName: APP_MONITOR_NAME,
      arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
    });

    // Unauthenticated role: allow PutRumEvents on this AppMonitor only
    const unauthRole = new iam.Role(this, 'RumUnauthRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      description: 'CloudWatch RUM SDK guest role (unauthenticated Cognito identity)',
    });

    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [appMonitorArn],
      }),
    );

    // Bind the role to the identity pool's unauthenticated path
    new cognito.CfnIdentityPoolRoleAttachment(this, 'RumRoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      },
    });

    // -------------------------------------------------------------------
    // 5. CloudWatch RUM AppMonitor
    // -------------------------------------------------------------------
    const appMonitor = new rum.CfnAppMonitor(this, 'AppMonitor', {
      name: APP_MONITOR_NAME,
      domain: distribution.distributionDomainName,
      cwLogEnabled: true,
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        sessionSampleRate: 1.0,
        telemetries: ['errors', 'performance', 'http'],
        identityPoolId: identityPool.ref,
        guestRoleArn: unauthRole.roleArn,
      },
    });
    appMonitor.node.addDependency(unauthRole);

    // -------------------------------------------------------------------
    // 6. Outputs (the user pastes these into web/app.js, then redeploys)
    // -------------------------------------------------------------------
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}/`,
      description: 'Static site URL served by CloudFront',
    });

    new cdk.CfnOutput(this, 'AppMonitorName', {
      value: appMonitor.name,
      description: 'CloudWatch RUM AppMonitor name (use as APPLICATION_ID lookup)',
    });

    new cdk.CfnOutput(this, 'AppMonitorArn', {
      value: appMonitorArn,
      description: 'AppMonitor ARN (matches the IAM policy resource)',
    });

    new cdk.CfnOutput(this, 'AppMonitorIdHint', {
      value:
        'Run: aws rum get-app-monitor --name ' +
        APP_MONITOR_NAME +
        ' --query AppMonitor.Id --output text',
      description: 'Command to fetch the AppMonitor ID needed by the RUM Web SDK',
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
      description: 'Cognito Identity Pool ID used by the RUM SDK',
    });

    new cdk.CfnOutput(this, 'GuestRoleArn', {
      value: unauthRole.roleArn,
      description: 'Unauthenticated IAM role ARN attached to the Identity Pool',
    });

    new cdk.CfnOutput(this, 'Region', {
      value: cdk.Stack.of(this).region,
      description: 'AWS region (used by the RUM SDK CDN URL and config)',
    });
  }
}
