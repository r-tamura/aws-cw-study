// Periodically emits a single EMF metric (`OrderValue`) for the namespace
// `AwsCwStudy/Ch05`. Roughly 5% of invocations emit a spike so that a static
// threshold alarm and an anomaly-detection alarm can both have something to
// react to.
//
// Optional `event.value` (number) overrides the random value, which is useful
// for manually invoking the function from the AWS console / CLI to force an
// alarm into ALARM state without waiting for a natural spike.

interface SpikeEvent {
  value?: number;
}

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
  OrderValue: number;
}

function pickValue(event: SpikeEvent): number {
  if (typeof event?.value === 'number' && !Number.isNaN(event.value)) {
    return event.value;
  }
  // ~95% baseline (100..400), ~5% spike (1500..2500).
  if (Math.random() < 0.05) {
    return 1500 + Math.random() * 1000;
  }
  return 100 + Math.random() * 300;
}

export const handler = async (event: SpikeEvent = {}): Promise<{ ok: true; orderValue: number }> => {
  const orderValue = pickValue(event);

  const emf: EmfDoc = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: 'AwsCwStudy/Ch05',
          Dimensions: [['ServiceName', 'Operation']],
          Metrics: [{ Name: 'OrderValue', Unit: 'None' }],
        },
      ],
    },
    ServiceName: 'spike-emitter',
    Operation: 'CreateOrder',
    OrderValue: orderValue,
  };

  // Writing the EMF document to stdout is what makes CloudWatch promote the
  // structured payload into an actual metric data point.
  console.log(JSON.stringify(emf));

  return { ok: true, orderValue };
};
