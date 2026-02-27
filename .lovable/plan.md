

## Problem

The `sns-webhook` edge function crashes with `ReferenceError: buildStringToSign is not defined` (line 114). The recent ASN.1/SPKI fix was deployed but the `buildStringToSign` function — which constructs the canonical string that AWS SNS signs — was never added to the file. Every incoming SNS notification (including your CPU > 1% alarm) hits this error and returns 403.

## Fix

Add the missing `buildStringToSign` function to `supabase/functions/sns-webhook/index.ts`. This function builds the canonical string-to-sign per the [AWS SNS signature spec](https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html):

- For `Notification` messages: `Message`, `MessageId`, `Subject` (if present), `Timestamp`, `TopicArn`, `Type`
- For `SubscriptionConfirmation` / `UnsubscribeConfirmation`: `Message`, `MessageId`, `SubscribeURL`, `Timestamp`, `Token`, `TopicArn`, `Type`

Each field is added as `FieldName\nFieldValue\n`.

### Changes

**`supabase/functions/sns-webhook/index.ts`** — Insert the `buildStringToSign` function before `verifySnsSignature` (around line 80):

```typescript
function buildStringToSign(message: Record<string, any>, messageType: string): string {
  const fields: string[] = [];
  if (messageType === 'Notification') {
    fields.push('Message', 'MessageId');
    if (message.Subject) fields.push('Subject');
    fields.push('Timestamp', 'TopicArn', 'Type');
  } else {
    // SubscriptionConfirmation or UnsubscribeConfirmation
    fields.push('Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type');
  }
  let str = '';
  for (const field of fields) {
    if (message[field] !== undefined) {
      str += field + '\n' + message[field] + '\n';
    }
  }
  return str;
}
```

Then redeploy the `sns-webhook` function.

