import {
  STSClient,
  AssumeRoleCommand,
  GetCallerIdentityCommand,
} from "npm:@aws-sdk/client-sts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface ResolvedCredentials {
  credentials: AWSCredentials;
  isAssumed: boolean;
  expiry?: string;
}

/**
 * Validates that a role ARN matches the expected format, account ID, and role name exactly.
 * Prevents bypass via prefix/suffix tricks (e.g. "evil-CloudHub-Project-x").
 */
function validateRoleArn(
  roleArn: string,
  expectedRoleName: string,
  expectedAccountId: string
): void {
  const arnRegex = /^arn:aws:iam::(\d{12}):role\/(.+)$/;
  const match = roleArn.match(arnRegex);

  if (!match) {
    throw new Error("Role ARN does not match expected format");
  }

  const [, accountId, rolePath] = match;

  if (accountId !== expectedAccountId) {
    throw new Error("Role ARN account ID mismatch");
  }

  const expectedFullRoleName = `CloudHub-Project-${expectedRoleName}`;
  if (rolePath !== expectedFullRoleName) {
    throw new Error("Role ARN does not match expected role name");
  }
}

/**
 * Resolves AWS credentials — either direct admin credentials or temporary
 * credentials obtained via STS AssumeRole with hardened validation.
 *
 * Flow when roleName is provided:
 *   1. Query cloudhub_roles by user_id + role_name → get role_arn
 *   2. Call sts:GetCallerIdentity → get accountId
 *   3. validateRoleArn(role_arn, roleName, accountId)
 *   4. Call sts:AssumeRole with validated ARN + session tags
 *
 * When roleName is absent, returns admin credentials directly.
 */
export async function resolveCredentials(
  supabaseClient: SupabaseClient,
  userId: string,
  userEmail: string,
  adminCreds: { accessKeyId: string; secretAccessKey: string },
  region: string,
  roleName?: string
): Promise<ResolvedCredentials> {
  // No role requested — use admin credentials directly
  if (!roleName) {
    return { credentials: adminCreds, isAssumed: false };
  }

  // 1. Server-side lookup — never trust frontend ARN
  const { data: role, error: roleError } = await supabaseClient
    .from("cloudhub_roles")
    .select("role_arn, max_session_duration_seconds")
    .eq("user_id", userId)
    .eq("role_name", roleName)
    .single();

  if (roleError || !role) {
    throw new Error("Role not found or access denied");
  }

  // 2. Discover admin account ID via GetCallerIdentity
  const stsClient = new STSClient({
    region: region || "us-east-1",
    credentials: {
      accessKeyId: adminCreds.accessKeyId,
      secretAccessKey: adminCreds.secretAccessKey,
    },
  });

  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
  const accountId = identity.Account;
  if (!accountId) {
    throw new Error("Failed to determine AWS account ID");
  }

  // 3. Hardened ARN validation — strict regex + account + exact role name
  validateRoleArn(role.role_arn, roleName, accountId);

  // 4. AssumeRole with session tags for CloudTrail attribution
  const assumed = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: role.role_arn,
      RoleSessionName: `cloudhub-${userId.slice(0, 8)}-${Date.now()}`,
      DurationSeconds: role.max_session_duration_seconds || 900,
      ExternalId: `cloudhub-${userId}`,
      Tags: [
        { Key: "CloudHubUser", Value: userId },
        { Key: "CloudHubUserEmail", Value: userEmail || "unknown" },
        { Key: "CloudHubRole", Value: roleName },
      ],
    })
  );

  if (
    !assumed.Credentials?.AccessKeyId ||
    !assumed.Credentials?.SecretAccessKey ||
    !assumed.Credentials?.SessionToken
  ) {
    throw new Error("STS AssumeRole returned incomplete credentials");
  }

  return {
    credentials: {
      accessKeyId: assumed.Credentials.AccessKeyId,
      secretAccessKey: assumed.Credentials.SecretAccessKey,
      sessionToken: assumed.Credentials.SessionToken,
    },
    isAssumed: true,
    expiry: assumed.Credentials.Expiration?.toISOString(),
  };
}
