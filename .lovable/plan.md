

# SES Email Setup Section in Settings

Add a guided SES configuration section to the **AWS Config** tab in Settings that helps users verify their SES setup, configure a sender email, and send a test email -- all from within CloudHub.

## What the User Will See

A new "Email Notifications (SES)" card in the AWS Config tab with three steps:

1. **Check SES Status** -- A button that calls AWS SES to report:
   - Whether the account is in sandbox or production mode
   - List of verified email addresses/domains
   - Current sender email setting

2. **Set Sender Email** -- An input field to enter and save a verified sender email address (stored as the `SES_SENDER_EMAIL` secret). Includes a dropdown of verified identities fetched from SES for convenience.

3. **Send Test Email** -- A button that sends a test alert email to the logged-in user's email address using the existing `send-ses-email` edge function, confirming the full pipeline works.

A status indicator shows the overall readiness: all-green when SES is in production mode, a sender email is set, and a test email succeeds.

## Implementation

### 1. New Edge Function: `ses-status`

**File:** `supabase/functions/ses-status/index.ts`

Uses the user's stored AWS credentials to call:
- `GetAccountCommand` -- returns sandbox/production status and sending limits
- `ListIdentitiesCommand` + `GetIdentityVerificationAttributesCommand` -- returns verified emails/domains

Returns a JSON response with:
```json
{
  "sandboxMode": true,
  "verifiedIdentities": [
    { "identity": "user@example.com", "status": "Success" }
  ],
  "sendingLimits": { "max24HourSend": 200, "maxSendRate": 1, "sentLast24Hours": 5 }
}
```

### 2. New Component: `SESSetupCard`

**File:** `src/components/SESSetupCard.tsx`

A self-contained card component with:
- **Status Section**: Shows sandbox vs production, verified identities list, sending quota. Fetched on mount via the `ses-status` edge function.
- **Sender Email Input**: Text field pre-populated with current `SES_SENDER_EMAIL` if set. Saves to the `notification_preferences` table in a new `ses_sender_email` column.
- **Test Email Button**: Calls `send-ses-email` with a test payload to the user's own email.
- **Setup Guide**: Collapsible section with quick links to the AWS SES console for domain verification and production access request.

### 3. Database Migration

Add a `ses_sender_email` column to `notification_preferences`:
```sql
ALTER TABLE notification_preferences 
  ADD COLUMN IF NOT EXISTS ses_sender_email text DEFAULT NULL;
```

This stores the user's chosen verified sender email. The edge functions will read this value instead of relying solely on the `SES_SENDER_EMAIL` environment variable, making it per-user configurable.

### 4. Update Settings Page

**File:** `src/pages/Settings.tsx`

Add the `<SESSetupCard />` component inside the "AWS Config" tab, below the existing Cost & Billing section, separated by a `<Separator />`.

### 5. Update Edge Functions

**Files:** `supabase/functions/send-ses-email/index.ts` and `supabase/functions/send-alert-notification/index.ts`

Update both to check for a per-user `ses_sender_email` from `notification_preferences` before falling back to the `SES_SENDER_EMAIL` env var.

## File Summary

| File | Action |
|---|---|
| `supabase/functions/ses-status/index.ts` | Create -- new edge function |
| `src/components/SESSetupCard.tsx` | Create -- new UI component |
| `src/pages/Settings.tsx` | Edit -- add SESSetupCard to AWS Config tab |
| `supabase/functions/send-ses-email/index.ts` | Edit -- read per-user sender email |
| `supabase/functions/send-alert-notification/index.ts` | Edit -- read per-user sender email |
| Database migration | Add `ses_sender_email` column to `notification_preferences` |
| `supabase/config.toml` | Add `[functions.ses-status]` with `verify_jwt = false` |

