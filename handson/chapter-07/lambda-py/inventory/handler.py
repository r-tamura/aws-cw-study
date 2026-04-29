"""Inventory API Lambda.

Backed by a DynamoDB table whose partition key is `sku`.
Supported operations (passed in the invoke payload):

  {"op": "get",       "sku": "ABC-123"}
  {"op": "decrement", "sku": "ABC-123", "qty": 1}
  {"op": "set",       "sku": "ABC-123", "qty": 100}

The function emits structured JSON logs so they can be queried via
CloudWatch Logs Insights / Application Signals correlated traces.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

LOG = logging.getLogger()
LOG.setLevel(logging.INFO)

_TABLE_NAME = os.environ.get("TABLE_NAME", "Inventory")
_DDB = boto3.resource("dynamodb")  # type: ignore[no-untyped-call]
_TABLE = _DDB.Table(_TABLE_NAME)  # type: ignore[attr-defined]


def _log(level: str, msg: str, **extra: Any) -> None:
    payload = {"level": level, "msg": msg, **extra}
    LOG.info(json.dumps(payload, default=str))


def _get_stock(sku: str) -> int:
    resp = _TABLE.get_item(Key={"sku": sku})
    item = resp.get("Item")
    if not item:
        return 0
    return int(item.get("stock", 0))


def _set_stock(sku: str, qty: int) -> int:
    _TABLE.put_item(Item={"sku": sku, "stock": qty})
    return qty


def _decrement(sku: str, qty: int) -> Dict[str, Any]:
    """Conditionally decrement stock; returns ok/remaining or reason."""
    try:
        resp = _TABLE.update_item(
            Key={"sku": sku},
            UpdateExpression="SET stock = stock - :q",
            ConditionExpression="attribute_exists(sku) AND stock >= :q",
            ExpressionAttributeValues={":q": qty},
            ReturnValues="UPDATED_NEW",
        )
        remaining = int(resp["Attributes"]["stock"])
        return {"ok": True, "sku": sku, "remaining": remaining}
    except ClientError as err:
        code = err.response.get("Error", {}).get("Code", "")
        if code == "ConditionalCheckFailedException":
            existing = _get_stock(sku)
            reason = "out_of_stock" if existing > 0 else "unknown_sku"
            return {"ok": False, "sku": sku, "reason": reason, "remaining": existing}
        raise


def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    op = event.get("op", "get")
    sku = event.get("sku")
    qty = int(event.get("qty", 1))

    _log("info", "inventory_request", op=op, sku=sku, qty=qty)

    if not sku:
        return {"ok": False, "reason": "missing_sku"}

    if op == "get":
        return {"ok": True, "sku": sku, "remaining": _get_stock(sku)}
    if op == "set":
        return {"ok": True, "sku": sku, "remaining": _set_stock(sku, qty)}
    if op == "decrement":
        result = _decrement(sku, qty)
        _log("info", "inventory_response", **result)
        return result

    return {"ok": False, "reason": f"unknown_op:{op}"}
