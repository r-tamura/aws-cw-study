#!/usr/bin/env bash
#
# Disable CloudWatch Application Signals Transaction Search.
#
# What this does:
#   - Switch trace segment destination back to X-Ray (default)
#   - Reset trace summary indexing to 1% (the free-tier default)
#   - Delete the resource policy that allowed X-Ray to write into aws/spans
#
# Usage:
#   bash disable-transaction-search.sh [region]
#
# Note:
#   The aws/spans log group itself is NOT deleted by this script. It can hold
#   chargeable storage. If you want to free that storage, delete it manually:
#     aws logs delete-log-group --log-group-name aws/spans --region <region>
#
set -euo pipefail

REGION="${1:-ap-northeast-1}"

echo "[1/3] UpdateTraceSegmentDestination: switch back to XRay"
aws xray update-trace-segment-destination \
  --destination XRay \
  --region "$REGION" \
  >/dev/null

echo "[2/3] UpdateIndexingRule: reset Default to 1% (free tier)"
aws xray update-indexing-rule \
  --name "Default" \
  --rule '{"Probabilistic":{"DesiredSamplingPercentage":1}}' \
  --region "$REGION" \
  >/dev/null

echo "[3/3] DeleteResourcePolicy: TransactionSearchXrayAccess"
aws logs delete-resource-policy \
  --policy-name TransactionSearchXrayAccess \
  --region "$REGION" \
  >/dev/null || echo "  (policy already absent)"

echo
echo "Transaction Search disabled. To remove stored spans as well, run:"
echo "  aws logs delete-log-group --log-group-name aws/spans --region ${REGION}"
