"""Inventory query Lambda that emits CloudWatch metrics via Embedded Metric Format (EMF)."""

import json
import random
import time


def handler(event, context):
    emf = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "AwsCwStudy/Ch03",
                    "Dimensions": [["ServiceName", "Operation"]],
                    "Metrics": [
                        {"Name": "InventoryQueries", "Unit": "Count"},
                        {"Name": "InventoryLatency", "Unit": "Milliseconds"},
                    ],
                }
            ],
        },
        "ServiceName": "inventory-metrics",
        "Operation": "QueryInventory",
        "InventoryQueries": 1,
        "InventoryLatency": random.randint(10, 200),
    }
    print(json.dumps(emf))
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"ok": True}),
    }
