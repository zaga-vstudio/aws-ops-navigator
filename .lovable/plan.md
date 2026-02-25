

## Plan: Add Test Button to Alerts Page + Fix SNS Subscription for Real Alerts

### Two Issues

1. **Test button is on the wrong page** — it's in `NotificationPreferencesDialog` (Security page), not in `NotificationChannelDialog` (Alerts page).

2. **Real CloudWatch alerts still don't reach Discord** — The `sns-webhook` edge function has **zero logs ever**. This means the SNS subscription from AWS to the webhook endpoint was never confirmed. When `manage-sns-topic` called `SubscribeCommand`, AWS sent a `SubscriptionConfirmation` POST to the webhook. If the function wasn't deployed at that moment, the confirmation was lost and the subscription remains in `PendingConfirmation` state forever. No amount of CloudWatch alarm firing will trigger a notification through a pending subscription.

### Changes

**1. Add "Send Test" button to `NotificationChannelDialog.tsx`**

Add a test button in the dialog footer that calls `supabase.functions.invoke('test-notification', { body: { channel: channel.type } })`. Shows loading state and toast with success/failure. Import `Send` from lucide-react and `supabase` client.

**2. Add SNS re-subscription logic to `test-notification/index.ts`**

Before dispatching the test notification, the function will:
- Fetch the user's `sns_topic_arn` from `notification_preferences`
- If a topic ARN exists, use the SNS SDK to list subscriptions for that topic (`ListSubscriptionsByTopicCommand`)
- Check if any subscription with the `sns-webhook` endpoint is in `PendingConfirmation` state
- If so, re-subscribe by calling `SubscribeCommand` again — AWS will re-send the `SubscriptionConfirmation` POST to the (now deployed) `sns-webhook` function, which will confirm it
- Log the subscription status for debugging

This approach reuses the existing `test-notification` function so clicking "Send Test" on any channel also heals the SNS subscription as a side effect.

**3. Re-deploy `sns-webhook` and `test-notification`**

Both functions must be deployed so that:
- `test-notification` can trigger the re-subscription
- `sns-webhook` can receive and confirm the `SubscriptionConfirmation` POST from AWS

### Technical Details

The SNS re-subscription flow in `test-notification`:

```text
test-notification called
  → fetch notification_preferences.sns_topic_arn
  → if topic ARN exists:
      → get AWS credentials via resolve-credentials
      → ListSubscriptionsByTopic(topicArn)
      → for each subscription where Endpoint matches sns-webhook URL:
          → if SubscriptionArn === 'PendingConfirmation':
              → Subscribe(topicArn, 'https', webhookEndpoint)
              → log "Re-subscribed SNS endpoint"
  → proceed with dispatchNotification (existing logic)
```

The `sns-webhook` function already handles `SubscriptionConfirmation` messages correctly (lines 139-153) — it fetches the `SubscribeURL` to confirm. So once the re-subscription triggers a new confirmation POST, it will be confirmed automatically.

### Files Modified

| File | Change |
|---|---|
| `src/components/NotificationChannelDialog.tsx` | Add "Send Test" button with loading/toast |
| `supabase/functions/test-notification/index.ts` | Add SNS subscription health check before dispatching |

