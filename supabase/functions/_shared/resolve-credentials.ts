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

/** Service-role client used only for append-only audit inserts. */
function auditClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function logAssumeRole(row: Record<string, unknown>): Promise<void> {
  try {
    const client = auditClient();
    if (!client) return;
    await client.from("assume_role_audit").insert(row);
  } catch (e) {
    console.error("assume_role_audit insert failed", (e as Error).message);
  }
}

export interface ClientAssumeOptions {
  clientId: string;
  operation: string;
  region?: string;
}

/**
 * Two-hop cross-account chain for an external client account:
 *   1. Owner keys  -> AssumeRole(auditor_identity.auditor_role_arn)  [Clodaro-Auditor]
 *   2. Auditor session -> AssumeRole(clients.role_arn, ExternalId)   [client account]
 *
 * The client ARN is always looked up server-side; a frontend-supplied ARN is never used.
 * Every attempt (success or failure) writes a row to assume_role_audit.
 */
export async function resolveClientCredentials(
  supabaseClient: SupabaseClient,
  userId: string,
  userEmail: string,
  adminCreds: { accessKeyId: string; secretAccessKey: string },
  options: ClientAssumeOptions
): Promise<ResolvedCredentials & { region: string; clientName: string }> {
  const { clientId, operation } = options;

  const { data: client, error: clientError } = await supabaseClient
    .from("clients")
    .select("id, name, role_arn, external_id, aws_account_id, default_region")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Client not found or access denied");
  }
  if (!client.role_arn) {
    throw new Error("Client has no IAM role configured yet");
  }

  const region = options.region || client.default_region || "us-east-1";
  const base = {
    client_id: client.id,
    client_name_snapshot: client.name,
    actor_user_id: userId,
    actor_email: userEmail || null,
    role_arn: client.role_arn,
    external_id_used: client.external_id,
    region,
    operation,
  };

  const { data: identity, error: identityError } = await supabaseClient
    .from("auditor_identity")
    .select("auditor_role_arn, aws_account_id, verified")
    .eq("owner_id", userId)
    .maybeSingle();

  if (identityError || !identity?.auditor_role_arn) {
    await logAssumeRole({ ...base, outcome: "error", error_message: "Auditor identity not configured" });
    throw new Error("Auditor identity is not configured");
  }

  try {
    const ownerSts = new STSClient({
      region,
      credentials: {
        accessKeyId: adminCreds.accessKeyId,
        secretAccessKey: adminCreds.secretAccessKey,
      },
    });

    const ownerIdentity = await ownerSts.send(new GetCallerIdentityCommand({}));
    const ownerAccountId = ownerIdentity.Account;
    if (!ownerAccountId) throw new Error("Failed to determine auditor AWS account ID");

    validateAuditorRoleArn(identity.auditor_role_arn, ownerAccountId);
    validateClientRoleArn(client.role_arn, client.aws_account_id, ownerAccountId);

    // Hop 1 — assume the fixed Clodaro-Auditor role in the owner account
    const hop1 = await ownerSts.send(
      new AssumeRoleCommand({
        RoleArn: identity.auditor_role_arn,
        RoleSessionName: `clodaro-auditor-${Date.now()}`,
        DurationSeconds: 3600,
      })
    );

    if (
      !hop1.Credentials?.AccessKeyId ||
      !hop1.Credentials?.SecretAccessKey ||
      !hop1.Credentials?.SessionToken
    ) {
      throw new Error("Auditor role session is incomplete");
    }

    // Hop 2 — assume the client role from the auditor session
    const auditorSts = new STSClient({
      region,
      credentials: {
        accessKeyId: hop1.Credentials.AccessKeyId,
        secretAccessKey: hop1.Credentials.SecretAccessKey,
        sessionToken: hop1.Credentials.SessionToken,
      },
    });

    const hop2 = await auditorSts.send(
      new AssumeRoleCommand({
        RoleArn: client.role_arn,
        RoleSessionName: `clodaro-${client.id.slice(0, 8)}-${Date.now()}`,
        DurationSeconds: 3600,
        ExternalId: client.external_id,
        Tags: [
          { Key: "ClodaroActor", Value: userId },
          { Key: "ClodaroClient", Value: client.id },
        ],
      })
    );

    if (
      !hop2.Credentials?.AccessKeyId ||
      !hop2.Credentials?.SecretAccessKey ||
      !hop2.Credentials?.SessionToken
    ) {
      throw new Error("Client role session is incomplete");
    }

    const expiry = hop2.Credentials.Expiration?.toISOString();

    await logAssumeRole({
      ...base,
      auditor_role_arn: identity.auditor_role_arn,
      outcome: "success",
      session_expiry: expiry ?? null,
    });

    return {
      credentials: {
        accessKeyId: hop2.Credentials.AccessKeyId,
        secretAccessKey: hop2.Credentials.SecretAccessKey,
        sessionToken: hop2.Credentials.SessionToken,
      },
      isAssumed: true,
      expiry,
      region,
      clientName: client.name,
    };
  } catch (e) {
    const message = (e as Error).message || "AssumeRole failed";
    const denied = /AccessDenied|not authorized|InvalidClientTokenId/i.test(message);
    await logAssumeRole({
      ...base,
      auditor_role_arn: identity.auditor_role_arn,
      outcome: denied ? "denied" : "error",
      error_message: message.slice(0, 500),
    });
    throw e;
  }
}

/** The auditor role must live in the owner's own account. */
export function validateAuditorRoleArn(roleArn: string, ownerAccountId: string): void {
  const match = roleArn.match(/^arn:aws:iam::(\d{12}):role\/([\w+=,.@/-]+)$/);
  if (!match) throw new Error("Auditor role ARN has an invalid format");
  if (match[1] !== ownerAccountId) throw new Error("Auditor role ARN must belong to your own AWS account");
}

/** The client role must live in the client's account, never in the owner's. */
export function validateClientRoleArn(
  roleArn: string,
  expectedAccountId: string | null,
  ownerAccountId: string
): void {
  const match = roleArn.match(/^arn:aws:iam::(\d{12}):role\/([\w+=,.@/-]+)$/);
  if (!match) throw new Error("Client role ARN has an invalid format");
  const accountId = match[1];
  if (accountId === ownerAccountId) {
    throw new Error("Client role ARN cannot belong to your own AWS account");
  }
  if (expectedAccountId && accountId !== expectedAccountId) {
    throw new Error("Client role ARN does not match the registered AWS account ID");
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
  roleName?: string,
  clientId?: string
): Promise<ResolvedCredentials> {
  // External client account — cross-account two-hop chain
  if (clientId) {
    return await resolveClientCredentials(supabaseClient, userId, userEmail, adminCreds, {
      clientId,
      operation: "resolve_credentials",
      region,
    });
  }

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
