import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});
const INVENTORY_FN = process.env.INVENTORY_FN ?? '';

interface CheckoutRequest {
  sku?: string;
  qty?: number;
}

interface InventoryResponse {
  ok: boolean;
  sku?: string;
  remaining?: number;
  reason?: string;
}

interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const log = (level: string, msg: string, extra: Record<string, unknown> = {}): void => {
  console.log(JSON.stringify({ level, msg, ...extra }));
};

const respond = (statusCode: number, body: unknown): ApiGatewayResponse => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event: { body?: string }): Promise<ApiGatewayResponse> => {
  let req: CheckoutRequest = {};
  try {
    req = event.body ? (JSON.parse(event.body) as CheckoutRequest) : {};
  } catch (err) {
    log('warn', 'invalid_json_body', { err: String(err) });
    return respond(400, { ok: false, reason: 'invalid_json' });
  }

  const sku = req.sku;
  const qty = req.qty ?? 1;
  if (!sku || qty <= 0) {
    return respond(400, { ok: false, reason: 'missing_sku_or_qty' });
  }

  log('info', 'checkout_request', { sku, qty });

  const out = await lambda.send(
    new InvokeCommand({
      FunctionName: INVENTORY_FN,
      Payload: Buffer.from(JSON.stringify({ op: 'decrement', sku, qty })),
    }),
  );

  const payload = out.Payload ? Buffer.from(out.Payload).toString('utf8') : '{}';
  let parsed: InventoryResponse;
  try {
    parsed = JSON.parse(payload) as InventoryResponse;
  } catch (err) {
    log('error', 'inventory_payload_parse_error', { err: String(err), payload });
    return respond(502, { ok: false, reason: 'inventory_unavailable' });
  }

  if (!parsed.ok) {
    log('info', 'checkout_rejected', { sku, qty, reason: parsed.reason });
    return respond(409, parsed);
  }

  log('info', 'checkout_ok', { sku, qty, remaining: parsed.remaining });
  return respond(200, parsed);
};
