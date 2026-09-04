import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";
import { STSClient, GetCallerIdentityCommand, AssumeRoleCommand } from "npm:@aws-sdk/client-sts";
import { IAMClient, ListAttachedRolePoliciesCommand } from "npm:@aws-sdk/client-iam@3.451.0";
import {
  resolveClientCredentials,
  validateAuditorRoleArn,
  validateClientRoleArn,
} from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@/-]+$/;

const ClientPayload = z.object({
  name: z.string().min(1).max(120),
  contact_email: z.string().email().max(255).optional().nullable(),
  aws_account_id: z.string().regex(/^\d{12}$/).optional().nullable(),
  role_arn: z.string().regex(ARN_RE).optional().nullable(),
  default_region: z.string().min(2).max(32).optional(),
  policy_scope: z.enum(["full_readonly", "security_only"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("create"), client: ClientPayload }),
  z.object({ action: z.literal("update"), clientId: z.string().uuid(), client: ClientPayload.partial() }),
  z.object({ action: z.literal("delete"), clientId: z.string().uuid() }),
  z.object({ action: z.literal("rotate_external_id"), clientId: z.string().uuid() }),
  z.object({ action: z.literal("test_connection"), clientId: z.string().uuid() }),
  z.object({ action: z.literal("get_auditor") }),
  z.object({ action: z.literal("save_auditor"), auditorRoleArn: z.string().regex(ARN_RE) }),
  z.object({ action: z.literal("verify_auditor") }),
  z.object({ action: z.literal("access_log"), clientId: z.string().uuid().optional() }),
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const body = parsed.data;
    console.log("manage-clients:", { action: body.action, userId: user.id });

    const getAdminCreds = async () => {
      const { data, error } = await supabase.rpc("get_user_aws_credentials", {
        user_id_param: user.id,
      });
      if (error || !data || data.length === 0) throw new Error("AWS credentials not found");
      return {
        accessKeyId: data[0].access_key_id as string,
        secretAccessKey: data[0].secret_access_key as string,
        region: (data[0].region as string) || "us-east-1",
      };
    };

    switch (body.action) {
      case "list": {
        const { data, error } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ success: true, clients: data });
      }

      case "create": {
        const { data, error } = await supabase
          .from("clients")
          .insert({ ...body.client, owner_id: user.id })
          .select()
          .single();
        if (error) throw error;
        return json({ success: true, client: data });
      }

      case "update": {
        const patch = { ...body.client };
        // Any change to the role invalidates the previous verification
        const resetStatus = "role_arn" in patch || "aws_account_id" in patch;
        const { data, error } = await supabase
          .from("clients")
          .update(resetStatus ? { ...patch, connection_status: "pending", last_error: null } : patch)
          .eq("id", body.clientId)
          .select()
          .single();
        if (error) throw error;
        return json({ success: true, client: data });
      }

      case "delete": {
        const { error } = await supabase.from("clients").delete().eq("id", body.clientId);
        if (error) throw error;
        return json({ success: true });
      }

      case "rotate_external_id": {
        const { data, error } = await supabase
          .from("clients")
          .update({
            external_id: crypto.randomUUID(),
            connection_status: "pending",
            last_error: null,
            last_verified_at: null,
          })
          .eq("id", body.clientId)
          .select()
          .single();
        if (error) throw error;
        return json({ success: true, client: data });
      }

      case "get_auditor": {
        const { data, error } = await supabase
          .from("auditor_identity")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (error) throw error;
        return json({ success: true, auditor: data });
      }

      case "save_auditor": {
        const { data, error } = await supabase
          .from("auditor_identity")
          .upsert(
            {
              owner_id: user.id,
              auditor_role_arn: body.auditorRoleArn,
              verified: false,
              last_error: null,
              last_verified_at: null,
            },
            { onConflict: "owner_id" }
          )
          .select()
          .single();
        if (error) throw error;
        return json({ success: true, auditor: data });
      }

      case "verify_auditor": {
        const { data: identity, error: identityError } = await supabase
          .from("auditor_identity")
          .select("auditor_role_arn")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (identityError) throw identityError;
        if (!identity?.auditor_role_arn) {
          return json({ error: "No auditor role configured" }, 400);
        }

        const admin = await getAdminCreds();
        const sts = new STSClient({
          region: admin.region,
          credentials: {
            accessKeyId: admin.accessKeyId,
            secretAccessKey: admin.secretAccessKey,
          },
        });

        try {
          const me = await sts.send(new GetCallerIdentityCommand({}));
          if (!me.Account) throw new Error("Could not determine your AWS account ID");
          validateAuditorRoleArn(identity.auditor_role_arn, me.Account);

          const assumed = await sts.send(
            new AssumeRoleCommand({
              RoleArn: identity.auditor_role_arn,
              RoleSessionName: `clodaro-auditor-verify-${Date.now()}`,
              DurationSeconds: 900,
            })
          );
          if (!assumed.Credentials?.SessionToken) {
            throw new Error("Auditor role session is incomplete");
          }

          await supabase
            .from("auditor_identity")
            .update({
              verified: true,
              aws_account_id: me.Account,
              last_verified_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("owner_id", user.id);

          return json({ success: true, verified: true, awsAccountId: me.Account });
        } catch (e) {
          const message = (e as Error).message || "Verification failed";
          await supabase
            .from("auditor_identity")
            .update({ verified: false, last_error: message.slice(0, 500) })
            .eq("owner_id", user.id);
          return json({ success: false, verified: false, error: message }, 400);
        }
      }

      case "test_connection": {
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, name, role_arn, aws_account_id, default_region, policy_scope")
          .eq("id", body.clientId)
          .maybeSingle();
        if (clientError) throw clientError;
        if (!client) return json({ error: "Client not found" }, 404);
        if (!client.role_arn) return json({ error: "This client has no role ARN yet" }, 400);

        const admin = await getAdminCreds();

        try {
          const resolved = await resolveClientCredentials(
            supabase,
            user.id,
            user.email ?? "",
            { accessKeyId: admin.accessKeyId, secretAccessKey: admin.secretAccessKey },
            { clientId: client.id, operation: "test_connection", region: client.default_region }
          );

          const clientSts = new STSClient({
            region: resolved.region,
            credentials: resolved.credentials,
          });
          const identity = await clientSts.send(new GetCallerIdentityCommand({}));

          validateClientRoleArn(
            client.role_arn,
            client.aws_account_id,
            (await new STSClient({
              region: admin.region,
              credentials: {
                accessKeyId: admin.accessKeyId,
                secretAccessKey: admin.secretAccessKey,
              },
            }).send(new GetCallerIdentityCommand({}))).Account ?? ""
          );

          // Best-effort policy check — the client role may not allow iam:List*
          let attachedPolicies: string[] | null = null;
          try {
            const roleName = client.role_arn.split("/").pop()!;
            const iam = new IAMClient({ region: resolved.region, credentials: resolved.credentials });
            const policies = await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }));
            attachedPolicies = (policies.AttachedPolicies ?? [])
              .map((p) => p.PolicyName ?? "")
              .filter(Boolean);
          } catch (_) {
            attachedPolicies = null;
          }

          const expectedPolicies =
            client.policy_scope === "security_only"
              ? ["SecurityAudit"]
              : ["SecurityAudit", "ViewOnlyAccess"];
          const missingPolicies = attachedPolicies
            ? expectedPolicies.filter((p) => !attachedPolicies!.includes(p))
            : [];

          await supabase
            .from("clients")
            .update({
              connection_status: "connected",
              last_verified_at: new Date().toISOString(),
              last_error: null,
              aws_account_id: client.aws_account_id ?? identity.Account ?? null,
            })
            .eq("id", client.id);

          return json({
            success: true,
            awsAccountId: identity.Account,
            assumedArn: identity.Arn,
            sessionExpiry: resolved.expiry,
            attachedPolicies,
            missingPolicies,
          });
        } catch (e) {
          const message = (e as Error).message || "Connection test failed";
          await supabase
            .from("clients")
            .update({ connection_status: "failed", last_error: message.slice(0, 500) })
            .eq("id", client.id);
          return json({ success: false, error: message }, 400);
        }
      }

      case "access_log": {
        let query = supabase
          .from("assume_role_audit")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (body.clientId) query = query.eq("client_id", body.clientId);
        const { data, error } = await query;
        if (error) throw error;
        return json({ success: true, events: data });
      }
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("manage-clients error:", (e as Error).message);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});
