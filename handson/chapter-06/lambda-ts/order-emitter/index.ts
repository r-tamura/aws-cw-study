/**
 * Order metrics emitter for Ch 6 Dashboards hands-on.
 *
 * Emits Embedded Metric Format (EMF) records so CloudWatch parses them into
 * custom metrics under the `AwsCwStudy/Ch06` namespace. The Lambda is invoked
 * on a 1-minute EventBridge schedule to give the dashboard a continuous
 * stream of data points.
 */

interface EmfDocument {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{ Name: string; Unit: string }>;
    }>;
  };
  Environment: string;
  ServiceName: string;
  OrderCount: number;
  OrderLatency: number;
}

export const handler = async (): Promise<{ ok: true }> => {
  const environment = process.env.ENVIRONMENT ?? 'dev';
  const serviceName = 'order-service';

  // Random-walk-ish synthetic values so dashboards & alarms have something to react to.
  const orderCount = Math.floor(Math.random() * 50) + 1;
  // Occasionally spike OrderLatency above 1000 ms so the AlarmWidget shows ALARM.
  const spike = Math.random() < 0.2;
  const orderLatency = spike
    ? 1100 + Math.random() * 500
    : 200 + Math.random() * 600;

  const emf: EmfDocument = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'AwsCwStudy/Ch06',
          Dimensions: [['Environment', 'ServiceName']],
          Metrics: [
            { Name: 'OrderCount', Unit: 'Count' },
            { Name: 'OrderLatency', Unit: 'Milliseconds' },
          ],
        },
      ],
    },
    Environment: environment,
    ServiceName: serviceName,
    OrderCount: orderCount,
    OrderLatency: orderLatency,
  };

  // EMF is just structured stdout. CloudWatch Logs parses the `_aws` block.
  console.log(JSON.stringify(emf));
  return { ok: true };
};
