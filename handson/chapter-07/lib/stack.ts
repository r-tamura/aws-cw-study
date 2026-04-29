import { Stack, StackProps, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { enableAppSignals } from '@aws-cw-study/common';
import * as path from 'path';

/**
 * Hands-on stack for Chapter 7 (Application Signals & SLO).
 *
 * Topology:
 *   API Gateway HTTP API
 *     -> CheckoutApi (Node.js 22.x)
 *        -> InventoryApi (Python 3.13)
 *           -> DynamoDB Inventory table
 *
 * Both Lambdas are wrapped with `enableAppSignals` so the ADOT layer
 * auto-instruments them and Application Signals draws the service map.
 */
export class Chapter07Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 1) DynamoDB: SKU を主キーにした単純な在庫テーブル
    const inventoryTable = new Table(this, 'InventoryTable', {
      tableName: 'Inventory',
      partitionKey: { name: 'sku', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 2) Inventory API (Python) - DynamoDB を読み書きする
    const inventory = new Function(this, 'InventoryApi', {
      runtime: Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: Code.fromAsset('lambda-py/inventory'),
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: inventoryTable.tableName,
      },
    });
    inventoryTable.grantReadWriteData(inventory);
    enableAppSignals(inventory, 'python');

    // 3) Checkout API (TypeScript) - Inventory API を Lambda invoke で呼ぶ
    //    NodejsFunction が esbuild で TS をバンドルしてデプロイする
    const checkout = new NodejsFunction(this, 'CheckoutApi', {
      runtime: Runtime.NODEJS_22_X,
      entry: path.join(__dirname, '..', 'lambda-ts', 'checkout', 'index.ts'),
      handler: 'handler',
      timeout: Duration.seconds(10),
      environment: {
        INVENTORY_FN: inventory.functionName,
      },
    });
    inventory.grantInvoke(checkout);
    enableAppSignals(checkout, 'nodejs');

    // 4) HTTP API: POST /checkout -> CheckoutApi
    const httpApi = new HttpApi(this, 'CheckoutHttpApi', {
      apiName: 'checkout-api',
    });
    httpApi.addRoutes({
      path: '/checkout',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CheckoutIntegration', checkout),
    });

    new CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API endpoint (append /checkout for the route)',
    });
    new CfnOutput(this, 'InventoryTableName', {
      value: inventoryTable.tableName,
      description: 'DynamoDB inventory table name',
    });
  }
}
