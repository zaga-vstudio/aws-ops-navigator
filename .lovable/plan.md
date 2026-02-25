

## Diagnosis: Why Discord Alerts Are Not Being Received

### Root Cause Found — Critical Bug in `handleUpdate`

The notification pipeline is: **CloudWatch Alarm → SNS Topic → sns-webhook edge function → dispatchNotification → Discord**.

Evidence from investigation:

1. **Discord webhook is configured** — `encrypted_discord_webhook` exists in `notification_preferences`.
2. **SNS topic exists** — `arn:aws:sns:us-east-1:940482449081:CloudHub-456f568f` is stored.
3. **Alert rule exists** — "Work", CPUUtilization > 2%, alarm name `CloudHub-456f568f-Work`.
4. **Zero `sns-webhook` logs** — the webhook has never been called. Not once. Not even a subscription confirmation.
5. **Zero `alert_history` records** — no alerts have ever been processed.
6. **The alarm was recently edited** — logs show `"Updated CloudWatch alarm: CloudHub-456f568f-Work"`.

**The bug**: When `handleUpdate` calls `PutMetricAlarmCommand` (lines 384-395), it does **not** include `AlarmActions` or `OKActions`. AWS `PutMetricAlarm` is a full replacement — any fields not provided are cleared. So when the alarm was edited, the SNS topic was disconnected from the alarm. Even if it was wired correctly at creation, the update stripped it.

Compare with `handleCreate` (lines 219-223):
```text
// Wire SNS topic for alarm and OK actions
if (topicArn) {
  alarmParams.AlarmActions = [topicArn];
  alarmParams.OKActions = [topicArn];
}
```

This wiring is completely missing from `handleUpdate`.

**Secondary concern**: Since `sns-webhook` has zero logs (not even a subscription confirmation), the SNS subscription may also have never confirmed. This could happen if the edge function wasn't deployed when the subscription was created, or if the confirmation POST from AWS was rejected.

### Fix Plan

**1. Fix `handleUpdate` in `manage-alert-rules/index.ts` — Preserve SNS actions**

Before calling `PutMetricAlarmCommand` in `handleUpdate`, fetch the user's `sns_topic_arn` from `notification_preferences` and include `AlarmActions` and `OKActions`:

```typescript
// Fetch SNS topic ARN so it's not stripped by the update
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
const { data: prefs } = await serviceClient
  .from('notification_preferences')
  .select('sns_topic_arn')
  .eq('user_id', user.id)
  .single();

const alarmParams: any = {
  AlarmName: rule.cloudwatch_alarm_name,
  // ... existing fields ...
};

if (prefs?.sns_topic_arn) {
  alarmParams.AlarmActions = [prefs.sns_topic_arn];
  alarmParams.OKActions = [prefs.sns_topic_arn];
}
```

This ensures editing an alarm never silently disconnects notifications.

**2. Add a "Test Notification" edge function — `test-notification/index.ts`**

A new edge function that lets users verify their notification channels work without waiting for a real CloudWatch alarm:

- Accepts `{ channel?: 'discord' | 'slack' | 'webhook' | 'email' | 'all' }` (defaults to `'all'`).
- Calls `dispatchNotification` with a synthetic test alert payload:
  ```typescript
  {
    alertName: 'Test Notification',
    metric: 'TestMetric',
    threshold: 100,
    currentValue: 42,
    severity: 'info',
  }
  ```
- Returns per-channel results so the user sees exactly which channels succeeded/failed and the error message for failures.
- Add `verify_jwt = false` in config.toml and validate auth in code (same pattern as other functions).

**3. Add "Test" button to notification channel UI**

In `src/components/NotificationPreferencesDialog.tsx` (or wherever channels are managed):

- Add a "Test" button on each configured channel card.
- Calls the `test-notification` edge function with the specific channel type.
- Shows a toast with the result (success or failure with error detail).
- This lets users verify Discord/Slack/webhook configuration immediately after saving, without creating a real alarm.

**4. Add SNS subscription re-confirmation logic**

In the `handleCreate` flow (and the new test function), after verifying the SNS topic exists, also verify the subscription is confirmed. If not, re-subscribe. This handles cases where the initial subscription confirmation was missed.

### Summary

| Issue | Cause | Fix |
|---|---|---|
| Alarm update strips SNS actions | `handleUpdate` missing `AlarmActions`/`OKActions` | Include them by fetching `sns_topic_arn` |
| No way to verify channels work | No test mechanism exists | New `test-notification` edge function + UI button |
| Possible dead subscription | Confirmation may have been missed | Re-verify subscription in create/test flows |

