"""Ch 4 Logs ハンズオン: Python Lambda がジョブ処理を構造化 JSON ログで残す。

`logging` 標準ライブラリに JSON フォーマッタをかぶせ、ジョブのライフサイクル
(start / progress / complete / fail) を 1 行 1 JSON で出す。CloudWatch Logs に
そのまま JSON で落ち、Logs Insights から `fields jobId, status` 等で参照できる。
"""

from __future__ import annotations

import json
import logging
import os
import random
import time
import uuid
from typing import Any

SERVICE = os.environ.get("SERVICE_NAME", "worker")


class JsonFormatter(logging.Formatter):
    """1 行 1 JSON で構造化ログを書くフォーマッタ。"""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "msg": record.getMessage(),
            "service": SERVICE,
        }
        # `logger.info("...", extra={...})` で渡された追加フィールドを取り込む
        extra = getattr(record, "extra_fields", None)
        if isinstance(extra, dict):
            payload.update(extra)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def _configure_logger() -> logging.Logger:
    logger = logging.getLogger("ch04.worker")
    logger.setLevel(logging.INFO)
    # Lambda は root logger に既定ハンドラを足すので、子 logger に独立ハンドラを置き
    # propagate=False にして二重出力を防ぐ。
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False
    return logger


_log = _configure_logger()


def _log_with(level: int, msg: str, **fields: Any) -> None:
    _log.log(level, msg, extra={"extra_fields": fields})


def handler(event: dict, context: Any) -> dict:
    request_id = getattr(context, "aws_request_id", None) or f"local-{int(time.time())}"
    job_id = str(uuid.uuid4())

    _log_with(
        logging.INFO,
        "job received",
        requestId=request_id,
        jobId=job_id,
        path=(event.get("requestContext") or {}).get("http", {}).get("path"),
    )

    start = time.time()
    # 擬似的な処理時間
    work_ms = random.randint(20, 200)
    time.sleep(work_ms / 1000.0)

    _log_with(
        logging.INFO,
        "job progress",
        requestId=request_id,
        jobId=job_id,
        progress=50,
    )

    r = random.random()
    if r < 0.05:
        # 5% で例外を上げる
        _log_with(
            logging.ERROR,
            "job failed",
            requestId=request_id,
            jobId=job_id,
            errorCode="E_JOB_CRASH",
            durationMs=int((time.time() - start) * 1000),
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"ok": False, "jobId": job_id, "requestId": request_id}),
        }

    if r < 0.2:
        _log_with(
            logging.WARNING,
            "job slow",
            requestId=request_id,
            jobId=job_id,
            durationMs=int((time.time() - start) * 1000),
        )

    _log_with(
        logging.INFO,
        "job complete",
        requestId=request_id,
        jobId=job_id,
        status="OK",
        durationMs=int((time.time() - start) * 1000),
    )

    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"ok": True, "jobId": job_id, "requestId": request_id}),
    }
