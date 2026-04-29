// Ch 4 Logs ハンズオン: TypeScript Lambda が JSON 構造化ログを出す。
// CloudWatch Logs にそのまま JSON が落ちるので、Logs Insights で
// `fields @timestamp, level, msg` のように構造化フィールドとしてクエリ可能。

import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';

type Level = 'INFO' | 'WARN' | 'ERROR';

interface LogRecord {
  level: Level;
  msg: string;
  service: string;
  requestId: string;
  path?: string;
  method?: string;
  durationMs?: number;
  errorCode?: string;
}

const SERVICE = process.env.SERVICE_NAME ?? 'api-handler';

function emit(rec: LogRecord): void {
  // 1 行 1 JSON でログを書く (CloudWatch Logs は 1 行を 1 イベントとして取り込む)
  console.log(JSON.stringify(rec));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = event.requestContext?.requestId ?? `local-${Date.now()}`;
  const start = Date.now();

  emit({
    level: 'INFO',
    msg: 'received',
    service: SERVICE,
    requestId,
    path: event.requestContext?.http?.path,
    method: event.requestContext?.http?.method,
  });

  // 確率的に WARN / ERROR を混ぜて、Logs Insights や Pattern analysis の素材にする
  const r = Math.random();

  if (r < 0.1) {
    // 10% で ERROR
    const errorCode = r < 0.05 ? 'E_DOWNSTREAM_TIMEOUT' : 'E_VALIDATION';
    emit({
      level: 'ERROR',
      msg: 'request failed',
      service: SERVICE,
      requestId,
      errorCode,
      durationMs: Date.now() - start,
    });
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: false, errorCode, requestId }),
    };
  }

  if (r < 0.3) {
    // さらに 20% で WARN (結果は 200 を返すが何かしら警告)
    emit({
      level: 'WARN',
      msg: 'slow downstream',
      service: SERVICE,
      requestId,
      durationMs: Date.now() - start,
    });
  }

  emit({
    level: 'INFO',
    msg: 'completed',
    service: SERVICE,
    requestId,
    durationMs: Date.now() - start,
  });

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, requestId }),
  };
};
