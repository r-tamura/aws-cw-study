import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

interface EmfDoc {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{ Name: string; Unit: string }>;
    }>;
  };
  ServiceName: string;
  Operation: string;
  OrderCount: number;
  OrderValue: number;
}

export const handler: APIGatewayProxyHandlerV2 = async (_event) => {
  const orderCount = 1;
  const orderValue = Math.random() * 1000;

  const emf: EmfDoc = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'AwsCwStudy/Ch03',
          Dimensions: [['ServiceName', 'Operation']],
          Metrics: [
            { Name: 'OrderCount', Unit: 'Count' },
            { Name: 'OrderValue', Unit: 'None' },
          ],
        },
      ],
    },
    ServiceName: 'order-metrics',
    Operation: 'CreateOrder',
    OrderCount: orderCount,
    OrderValue: orderValue,
  };
  console.log(JSON.stringify(emf));

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, orderValue }),
  };
};
