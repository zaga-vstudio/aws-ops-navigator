

## Hardened ARN Validation for Role Resolution

### Problem

The current plan uses weak string validation:

```typescript
if (!role.role_arn.includes('CloudHub-Project-')) {
  throw new Error('Invalid role');
}
```

This is vulnerable to bypass -- a crafted ARN like `arn:aws:iam::123:role/evil-CloudHub-Project-x` would pass.

### Solution

Replace `.includes()` with strict ARN parsing and multi-field validation in `supabase/functions/_shared/resolve-credentials.ts`.

### Validation Logic

```typescript
function validateRoleArn(
  roleArn: string,
  expectedRoleName: string,
  expectedAccountId: string
): void {
  const arnRegex = /^arn:aws:iam::(\d{12}):role\/(.+)$/;
  const match = roleArn.match(arnRegex);

  if (!match) {
    throw new Error('Role ARN does not match expected format');
  }

  const [, accountId, rolePath] = match;

  if (accountId !== expectedAccountId) {
    throw new Error('Role ARN account ID mismatch');
  }

  const expectedFullRoleName = `CloudHub-Project-${expectedRoleName}`;
  if (rolePath !== expectedFullRoleName) {
    throw new Error('Role ARN does not match expected role name');
  }
}
```

### What Gets Validated

| Check | Rule |
|---|---|
| ARN format | Must match `arn:aws:iam::<12-digit>:role/<name>` exactly |
| Account ID | Must equal the account ID from `sts:GetCallerIdentity` (called once at startup or cached) |
| Role name | Must be exactly `CloudHub-Project-<roleName>` -- no prefix/suffix tricks |
| Source | ARN comes from `cloudhub_roles` DB table (server-side), never from frontend |

### Where `expectedAccountId` Comes From

The `resolveCredentials` helper will call `sts:GetCallerIdentity` using admin credentials to obtain the account ID. This value is then passed to `validateRoleArn`. The call happens once per edge function invocation (unavoidable in stateless functions, but lightweight).

```typescript
const identity = await stsClient.send(new GetCallerIdentityCommand({}));
const accountId = identity.Account!;
validateRoleArn(role.role_arn, roleName, accountId);
```

### Updated `resolveCredentials` Flow

```text
1. Receive roleName from request body
2. Query cloudhub_roles by user_id + role_name -> get role_arn
3. Call sts:GetCallerIdentity -> get accountId
4. validateRoleArn(role_arn, roleName, accountId)
   - Parse ARN with regex
   - Confirm accountId matches
   - Confirm role path is exactly CloudHub-Project-<roleName>
5. Call sts:AssumeRole with validated ARN + session tags
```

### Files Modified

Only `supabase/functions/_shared/resolve-credentials.ts` -- the `validateRoleArn` function is added and called before every `AssumeRole` invocation. No other files change beyond what the parent plan already specifies.

### Additional AWS Permission

- `sts:GetCallerIdentity` on the admin credentials (this is implicitly allowed for all IAM identities, no policy change needed).

