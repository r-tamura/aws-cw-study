-- Recent error spans with traceId for drill-down into the X-Ray Trace Map
--
-- Run against log group: aws/spans
-- CloudWatch Logs Insights syntax.
--
-- Use the resulting traceId values in the X-Ray console (Traces) or open the row to see
-- all attributes. Combine with `attributes.http.status_code` to filter HTTP-layer errors.

fields @timestamp, name, traceId, attributes.`http.status_code` as http_status, resource.attributes.`service.name` as service
| filter `status.code` = 2
| sort @timestamp desc
| limit 50
