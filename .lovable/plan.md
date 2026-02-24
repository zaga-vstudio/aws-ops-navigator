

## Alert History & SNS End-to-End Wiring (Revised)

Incorporating all feedback: `state_value` column, index on `alert_rule_id`, proper SNS signature validation, sanitized topic names, and free-tier CloudWatch alarm compliance.

### Current State

- `send-alert-notification` exists but is **never called** — zero references in `src/`
- `manage-alert-rules` creates CloudWatch alarms with **no `AlarmActions`** — alarms fire silently
- Alert dismissals use `localStorage` only — no persistent history
- "This Month" stat card just re-displays `activeAlarms.length`

### Architecture

```text
CloudWatch Alarm fires
  → SNS Topic (AlarmActions ARN)
    → HTTPS Subscription → sns-webhook edge function
      → Validate SNS signature (certificate-based)
      → Log to alert_history table
      → Dispatch to channels (email/slack/discord/webhook)
```

### Changes

**1. Database Migration**

```sql
-- alert_history table
CREATE TABLE alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  cloudwatch_alarm_name text,
  alert_name text NOT NULL,
  metric text NOT NULL,
  threshold numeric,
  current_value numeric,
  state_value text,  -- raw AWS state: ALARM, OK, INSUFFICIENT_DATA
  severity text NOT NULL DEFAULT 'warning',
  event_type text NOT NULL DEFAULT 'triggered',
  notification_results jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION validate_alert_history_event_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.event_type NOT IN ('triggered', 'resolved', 'acknowledged') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be triggered, resolved, or acknowledged.', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_alert_history_event_type
  BEFORE INSERT OR UPDATE ON alert_history
  FOR EACH ROW EXECUTE FUNCTION validate_alert_history_event_type();

-- RLS
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alert history"
  ON alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert alert history"
  ON alert_history FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_alert_history_user_created
  ON alert_history(user_id, created_at DESC);
CREATE INDEX idx_alert_history_rule
  ON alert_history(alert_rule_id);

-- Add sns_topic_arn to notification_preferences
ALTER TABLE notification_preferences
  ADD COLUMN sns_topic_arn text;
```

The `state_value` column stores the raw AWS `NewStateValue` (`ALARM`, `OK`, `INSUFFICIENT_DATA`) for audit clarity, separate from the derived `event_type` which represents the application-level event.

**2. New Edge Function: `sns-webhook` (verify_jwt = false)**

Handles inbound SNS messages. Key responsibilities:

- **Full SNS signature validation**: Fetch the signing certificate from `SigningCertURL` (validate it's an `*.amazonaws.com` domain), verify the `Signature` against the message body using the certificate's public key. This is the cryptographic proof that the message came from AWS — checking `TopicArn` alone does NOT prevent spoofed POSTs.
- Handle `SubscriptionConfirmation`: fetch the `SubscribeURL` to confirm.
- Handle `Notification`: parse CloudWatch alarm JSON from the message body, extract `AlarmName`, `NewStateValue`, `NewStateReason`, `Trigger.MetricName`, `Trigger.Threshold`.
- Look up the `alert_rules` row by `cloudwatch_alarm_name` to resolve `user_id`, `alert_rule_id`, `severity`.
- Map `NewStateValue`:
  - `ALARM` → `event_type: 'triggered'`
  - `OK` → `event_type: 'resolved'`
  - `INSUFFICIENT_DATA` → skip (no notification)
- Insert into `alert_history` with both `event_type` and raw `state_value`.
- Dispatch notifications using the same logic as `send-alert-notification` (decrypt webhooks via service role, send to email/slack/discord/webhook).
- Store per-channel delivery results in `notification_results`.
- Uses service role client for all DB operations since there's no user JWT.

**3. New Edge Function: `manage-sns-topic` (verify_jwt = true)**

- Creates a per-user SNS topic. Topic name: `CloudHub-<first8chars_of_userId>` — SNS topic names are limited to 256 chars; we sanitize by stripping non-alphanumeric/hyphen characters and truncating.
- Subscribes the `sns-webhook` edge function URL as an HTTPS endpoint.
- Returns the topic ARN.
- Stores the topic ARN in `notification_preferences.sns_topic_arn`.
- Idempotent: if `sns_topic_arn` already exists and the topic still exists in AWS, return it without recreating.
- Required IAM permissions: `sns:CreateTopic`, `sns:Subscribe`, `sns:GetTopicAttributes`.

**4. Update `manage-alert-rules` Edge Function**

- On `create` (CloudWatch path only, not budgets):
  - Before `PutMetricAlarmCommand`, ensure the user has an SNS topic by checking `notification_preferences.sns_topic_arn`. If missing, create one inline (same logic as `manage-sns-topic`).
  - Add `AlarmActions: [topicArn]` and `OKActions: [topicArn]` to the `PutMetricAlarmCommand`.
  - **Free tier note**: CloudWatch basic alarms (standard resolution, 5-min period) are free up to 10 alarms. The `AlarmActions`/`OKActions` themselves cost nothing — SNS notifications are free for HTTPS endpoints. This stays within free tier.
- On `delete`: No change (deleting the alarm automatically stops actions).
- On `toggle`: No change (enable/disable alarm actions already works).

**5. Update `useAlertRules` Hook**

- Add `AlertHistoryEntry` interface with fields: `id`, `alert_name`, `metric`, `threshold`, `current_value`, `state_value`, `severity`, `event_type`, `notification_results`, `created_at`.
- Add `fetchHistory(limit?: number)` function querying `alert_history` ordered by `created_at DESC`, default limit 50.
- Export `history`, `historyLoading`, `fetchHistory`.

**6. Update `Alerts.tsx` UI**

- Add a 5th tab: **"History"** between "Alert Rules" and "Notifications".
- Tab grid changes from `grid-cols-4` to `grid-cols-5`.
- History tab content:
  - Table with columns: Time, Alert Name, Metric, State, Severity, Event Type, Channels
  - Event type badges: `triggered` (red), `resolved` (green), `acknowledged` (gray)
  - `state_value` shown as a secondary badge (e.g., `ALARM`, `OK`)
  - Channel delivery status icons from `notification_results` (checkmark/x per channel)
  - Pagination: "Load More" button
- Update "This Month" stat card to query `alert_history` count where `created_at >= start of current month`.
- Replace the `localStorage`-based dismiss with a database-backed acknowledge: clicking dismiss on an active alert inserts an `event_type: 'acknowledged'` row into `alert_history`.

**7. Refactor `send-alert-notification`**

- Extract the core dispatch logic (decrypt webhooks, send to SES/Slack/Discord/webhook) into a shared helper file: `supabase/functions/_shared/dispatch-notification.ts`.
- Both `send-alert-notification` (manual test sends from UI) and `sns-webhook` (automated SNS triggers) import and use this shared helper.
- This eliminates code duplication and ensures consistent notification formatting.

### Technical Details

- **SNS signature validation** is mandatory security. The implementation will:
  1. Validate `SigningCertURL` is from `sns.<region>.amazonaws.com`
  2. Fetch the PEM certificate
  3. Construct the string-to-sign per AWS spec (fields vary by message type)
  4. Verify the Base64-decoded `Signature` against the string using the certificate's public key
  5. Reject the request with 403 if validation fails
- **Topic name sanitization**: SNS topic names allow `[a-zA-Z0-9_-]` and max 256 chars. UUID `substring(0,8)` produces 8 hex chars — safe. Full format: `CloudHub-a1b2c3d4` (16 chars).
- **Free tier compliance**: CloudWatch provides 10 free standard-resolution alarms. `AlarmActions` pointing to SNS HTTPS endpoints incur no additional cost. SNS HTTPS deliveries are free (first 100,000/month). No paid metrics are involved in the alarm setup.
- **Budget alerts**: Budget notifications use a different mechanism (`NotificationsWithSubscribers` on the budget itself). Wiring budgets to the same SNS topic is possible but requires `budgets:CreateBudgetAction` — left as a future enhancement. For now, only CloudWatch alarms get SNS actions.
- **Duplicate RLS policies on `alert_rules`**: There are duplicate SELECT, UPDATE, and DELETE policies. These are harmless (OR'd together) but could be cleaned up in a future migration.

