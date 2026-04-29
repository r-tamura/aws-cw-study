#!/usr/bin/env bash
#
# Enable CloudWatch Application Signals Transaction Search at the account level.
#
# Reference:
#   https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Enable-TransactionSearch.html
#
# Usage:
#   bash enable-transaction-search.sh [region] [indexing-percentage]
#
#   region                Optional. Defaults to ap-northeast-1.
#   indexing-percentage   Optional. Defaults to 100. Use 1 to stay in the free tier.
#
# Idempotency:
#   - put-resource-policy with the same --policy-name overwrites in place.
#   - update-trace-segment-destination is idempotent (CloudWatchLogs is already the target on second run).
#   - update-indexing-rule overwrites the Default rule in place.
#   Re-running this script is safe.
#
set -euo pipefail

REGION="${1:-ap-northeast-1}"
INDEXING_PCT="${2:-100}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

echo "[1/4] PutResourcePolicy: allow X-Ray to write spans into aws/spans (account=${ACCOUNT_ID}, region=${REGION})"
aws logs put-resource-policy \
  --policy-name TransactionSearchXrayAccess \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Sid\":\"TransactionSearchXRayAccess\",
      \"Effect\":\"Allow\",
      \"Principal\":{\"Service\":\"xray.amazonaws.com\"},
      \"Action\":\"logs:PutLogEvents\",
      \"Resource\":[
        \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:aws/spans:*\",
        \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:/aws/application-signals/data:*\"
      ],
      \"Condition\":{
        \"ArnLike\":{\"aws:SourceArn\":\"arn:aws:xray:${REGION}:${ACCOUNT_ID}:*\"},
        \"StringEquals\":{\"aws:SourceAccount\":\"${ACCOUNT_ID}\"}
      }
    }]
  }" \
  --region "$REGION" \
  >/dev/null

echo "[2/4] UpdateTraceSegmentDestination: route trace segments to CloudWatch Logs"
aws xray update-trace-segment-destination \
  --destination CloudWatchLogs \
  --region "$REGION" \
  >/dev/null

echo "[3/4] UpdateIndexingRule: set Default trace summary indexing to ${INDEXING_PCT}%"
aws xray update-indexing-rule \
  --name "Default" \
  --rule "{\"Probabilistic\":{\"DesiredSamplingPercentage\":${INDEXING_PCT}}}" \
  --region "$REGION" \
  >/dev/null

echo "[4/4] GetTraceSegmentDestination: verify"
aws xray get-trace-segment-destination --region "$REGION"

cat <<EOF

Transaction Search is being enabled.
- Spans flow into log group:  aws/spans
- Trace summary indexing:     ${INDEXING_PCT}% (1% is free; >1% incurs X-Ray indexing charges)
- Wait 5-10 minutes for spans to become searchable in:
    CloudWatch console -> Application Signals -> Transaction Search

Tip: re-run this script with a different percentage to adjust indexing later, e.g.
    bash enable-transaction-search.sh ${REGION} 1
EOF
