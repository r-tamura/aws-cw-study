-- Top 10 customers affected by errors
--
-- Run against log group: aws/spans
-- CloudWatch Logs Insights syntax.
--
-- - `status.code` = 2 maps to OpenTelemetry's STATUS_CODE_ERROR (0=UNSET, 1=OK, 2=ERROR).
-- - attributes.`enduser.id` is a standard OpenTelemetry semantic convention. If your app
--   emits a different attribute (e.g. attributes.`customer.id`), swap the field name below.

fields attributes.`enduser.id` as customer_id
| filter ispresent(customer_id) and `status.code` = 2
| stats count(*) as error_count by customer_id
| sort error_count desc
| limit 10
