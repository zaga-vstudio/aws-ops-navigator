

## Root Cause Analysis

There are **two independent bugs** preventing real alerts from working:

### Bug 1: CloudWatch alarm has no Dimensions (primary cause)
In `manage-alert-rules/index.ts` (line 223-234), the `PutMetricAlarmCommand` creates the alarm **without** a `Dimensions` parameter. EC2 metrics like `CPUUtilization` are published **per-instance** — CloudWatch only has data at the `InstanceId` dimension level. An alarm without dimensions finds no data and stays permanently in `INSUFFICIENT_DATA` state, which the webhook explicitly skips.

**Fix**: When creating/updating CloudWatch alarms for EC2/RDS metrics, require the user to specify a `resourceId` (instance ID) and include it as a Dimension:
```
Dimensions: [{ Name: 'InstanceId', Value: resourceId }]
```
For RDS metrics, use `{ Name: 'DBInstanceIdentifier', Value: resourceId }`.

This requires:
- Adding a `resourceId` field to the create alert flow (UI + edge function)
- Adding a `resource_id` column to the `alert_rules` table
- Passing dimensions in both `handleCreate` and `handleUpdate`

### Bug 2: SNS subscription healing silently fails
In `test-notification/index.ts`, the `healSnsSubscription` function uses the **service role client** to call `rpc('get_user_aws_credentials')`. But that database function checks `auth.uid() != user_id_param` — and service role calls have `auth.uid() = null`, so it always throws "Unauthorized access to credentials". The error is caught silently, so the heal never runs.

**Fix**: Pass the authenticated `supabaseClient` (which has the user's JWT) to `healSnsSubscription` and use it for the `get_user_aws_credentials` RPC call. Keep the service client only for reading `notification_preferences`.

### Changes

**Database migration**: Add `resource_id` column to `alert_rules`:
```sql
ALTER TABLE alert_rules ADD COLUMN resource_id text;
```

**`supabase/functions/manage-alert-rules/index.ts`**:
- Accept `resourceId` in the request body for `handleCreate` and `handleUpdate`
- Add `Dimensions` to `PutMetricAlarmCommand` based on metric namespace (EC2 → `InstanceId`, RDS → `DBInstanceIdentifier`, EBS → `VolumeId`)
- Store `resource_id` in the `alert_rules` row

**`supabase/functions/test-notification/index.ts`**:
- Change `healSnsSubscription(user.id)` to `healSnsSubscription(user.id, supabaseClient)`
- Inside `healSnsSubscription`, use the passed `supabaseClient` for `rpc('get_user_aws_credentials')` instead of `serviceClient`

**UI — Alert creation dialog** (likely `src/components/NewAlertRuleDialog.tsx` or similar):
- Add a resource selector (dropdown of EC2 instances / RDS databases) when creating a CloudWatch metric alert
- Pass `resourceId` to the `manage-alert-rules` function call

### Technical Detail

```text
Current alarm (broken):
  PutMetricAlarm {
    MetricName: "CPUUtilization"
    Namespace: "AWS/EC2"
    Threshold: 1
    // No Dimensions → INSUFFICIENT_DATA forever
  }

Fixed alarm:
  PutMetricAlarm {
    MetricName: "CPUUtilization"
    Namespace: "AWS/EC2"
    Threshold: 1
    Dimensions: [{ Name: "InstanceId", Value: "i-0bd097bd20b3ff22f" }]
    // Matches per-instance metric data → triggers when CPU > 1%
  }
```

