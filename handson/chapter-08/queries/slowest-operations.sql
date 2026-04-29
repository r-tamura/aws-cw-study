-- Slowest operations (Top 5) by average duration
--
-- Run against log group: aws/spans
-- CloudWatch Logs Insights syntax (not real SQL).
--
-- - durationNano is the span duration in nanoseconds; we divide by 1,000,000 for ms.
-- - `name` is the OpenTelemetry span name (e.g. "POST /checkout", "DynamoDB.UpdateItem").
-- - For a single service, add: | filter resource.attributes.`service.name` = "CheckoutApi"

fields @timestamp, name, durationNano / 1000000 as duration_ms, attributes.`http.status_code`
| filter ispresent(durationNano)
| stats avg(duration_ms) as avg_ms, max(duration_ms) as max_ms, count(*) as calls by name
| sort avg_ms desc
| limit 5
