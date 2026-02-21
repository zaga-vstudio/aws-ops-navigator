
# Complete the Webhook Save Flow

## Problem

When a user enters a Slack, Discord, or custom webhook URL in the channel configuration dialog and clicks "Save Changes", the URL is never actually encrypted and stored in the database. The `updateChannel` function in the hook only handles **disabling** (clearing the value) but has no code path to **encrypt and save** a new URL. This means webhooks can never be configured.

## Solution

Create a new edge function (`save-webhook`) that receives the plaintext webhook URL, encrypts it server-side using the existing `encrypt_secret` database function, and stores it in the `notification_preferences` table. Then update the frontend hook to call this edge function when saving a webhook URL.

## Changes

### 1. Create edge function: `save-webhook`

**File:** `supabase/functions/save-webhook/index.ts`

- Accepts `{ channelType, webhookUrl }` in the POST body
- Authenticates the user via the Authorization header
- Validates the URL format (must start with `https://`)
- Validates `channelType` is one of `slack`, `discord`, `webhook`
- Uses the service role client to call `encrypt_secret(webhookUrl)` to get the encrypted bytea value
- Updates the correct column (`encrypted_slack_webhook`, `encrypted_discord_webhook`, or `encrypted_webhook_url`) in `notification_preferences` for the authenticated user
- Returns success/failure

### 2. Add config entry

**File:** `supabase/config.toml`

- Add `[functions.save-webhook]` with `verify_jwt = true`

### 3. Update `useNotificationPreferences` hook

**File:** `src/hooks/useNotificationPreferences.tsx`

- In the `updateChannel` function, when `config.enabled` is `true` and a non-masked value is provided for slack/discord/webhook channels, call the `save-webhook` edge function instead of doing a direct table update
- Keep the existing "disable" path (clearing to null) as-is

### 4. Fix dialog masked value handling

**File:** `src/components/NotificationChannelDialog.tsx`

- When the channel config is the masked placeholder (`"••••••••"`), clear the input so the user sees an empty field with the placeholder hint, rather than editing the mask string
- This prevents accidentally sending the mask string as the webhook URL

## Technical Details

### Edge Function Flow

```text
Client (dialog) --> useNotificationPreferences.updateChannel()
  |-- if disabling: direct DB update (set field to null) [existing]
  |-- if enabling with new URL: supabase.functions.invoke("save-webhook", {
        body: { channelType: "slack", webhookUrl: "https://hooks.slack.com/..." }
      })
        --> Edge function authenticates user
        --> Calls encrypt_secret(webhookUrl) via service role
        --> Updates notification_preferences row
```

### Validation (edge function)

- `channelType` must be `slack | discord | webhook`
- `webhookUrl` must be a valid HTTPS URL
- User must be authenticated

| File | Action |
|---|---|
| `supabase/functions/save-webhook/index.ts` | Create -- encrypt and store webhook URLs server-side |
| `supabase/config.toml` | Edit -- add `save-webhook` function config |
| `src/hooks/useNotificationPreferences.tsx` | Edit -- call edge function when saving webhook URLs |
| `src/components/NotificationChannelDialog.tsx` | Edit -- clear masked placeholder on dialog open |
