import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  IAMClient,
  CreateRoleCommand,
  DeleteRoleCommand,
  PutRolePolicyCommand,
  DeleteRolePolicyCommand,
  ListRolePoliciesCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
} from "npm:@aws-sdk/client-iam@3.451.0";
import {
  STSClient,
  GetCallerIdentityCommand,
} from "npm:@aws-sdk/client-sts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SERVICE_ACTIONS: Record<string, { read: string[]; write: string[] }> = {
  ec2: {
    read: ["ec2:Describe*"],
    write: ["ec2:RunInstances", "ec2:TerminateInstances", "ec2:StartInstances", "ec2:StopInstances"],
  },
  vpc: {
    read: ["ec2:DescribeVpcs", "ec2:DescribeSubnets", "ec2:DescribeSecurityGroups", "ec2:DescribeRouteTables"],
    write: ["ec2:ModifyVpcAttribute", "ec2:CreateSubnet", "ec2:DeleteSubnet"],
  },
  security_groups: {
    read: ["ec2:DescribeSecurityGroups", "ec2:DescribeSecurityGroupRules"],
    write: ["ec2:CreateSecurityGroup", "ec2:AuthorizeSecurityGroupIngress", "ec2:AuthorizeSecurityGroupEgress", "ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress"],
  },
  rds: {
    read: ["rds:Describe*"],
    write: ["rds:CreateDBInstance", "rds:DeleteDBInstance", "rds:ModifyDBInstance"],
  },
  cloudwatch: {
    read: ["cloudwatch:Describe*", "cloudwatch:GetMetricData", "cloudwatch:ListMetrics"],
    write: ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms"],
  },
};

const ROLE_NAME_RE = /^[a-zA-Z0-9_-]+$/;

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
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;
    console.log("manage-cloudhub-roles:", { action, userId: user.id });

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabase.rpc(
      "get_user_aws_credentials",
      { user_id_param: user.id }
    );
    if (credError || !credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: "AWS credentials not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = credentials[0];
    const awsCreds = {
      accessKeyId: creds.access_key_id,
      secretAccessKey: creds.secret_access_key,
    };

    const iamClient = new IAMClient({ region: "us-east-1", credentials: awsCreds });
    const stsClient = new STSClient({ region: creds.region || "us-east-1", credentials: awsCreds });

    // ── CREATE ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const { roleName, description, maxSessionDuration, permissions } = body;

      if (!roleName || !ROLE_NAME_RE.test(roleName)) {
        return new Response(JSON.stringify({ error: "Invalid role name. Use alphanumeric, hyphens, underscores only." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const duration = Math.max(900, Math.min(3600, maxSessionDuration || 900));
      const fullRoleName = `CloudHub-Project-${roleName}`;

      // Get admin identity
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      const accountId = identity.Account!;
      const adminArn = identity.Arn!;

      // Trust policy
      const trustPolicy = {
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: { AWS: adminArn },
          Action: "sts:AssumeRole",
          Condition: {
            StringEquals: { "sts:ExternalId": `cloudhub-${user.id}` },
          },
        }],
      };

      // Tags
      const tags = [
        { Key: "ManagedBy", Value: "CloudHub" },
        { Key: "CloudHubUserId", Value: user.id },
        { Key: "CloudHubUserEmail", Value: user.email || "unknown" },
        { Key: "Environment", Value: "production" },
      ];

      // Create IAM Role
      const createResult = await iamClient.send(new CreateRoleCommand({
        RoleName: fullRoleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: description || `CloudHub managed role: ${roleName}`,
        MaxSessionDuration: duration,
        Tags: tags,
      }));

      const roleArn = createResult.Role?.Arn;
      if (!roleArn) throw new Error("Failed to create IAM role - no ARN returned");

      // Attach inline policies for selected services
      const appliedPolicies: string[] = [];
      if (permissions && Array.isArray(permissions)) {
        for (const perm of permissions) {
          const serviceDef = SERVICE_ACTIONS[perm.service];
          if (!serviceDef) continue;

          const actions: string[] = [];
          if (perm.read) actions.push(...serviceDef.read);
          if (perm.write) actions.push(...serviceDef.write);
          if (actions.length === 0) continue;

          const policyDoc = {
            Version: "2012-10-17",
            Statement: [{ Effect: "Allow", Action: actions, Resource: "*" }],
          };

          const polName = `CloudHub-Scoped-${perm.service}-${roleName}`;
          await iamClient.send(new PutRolePolicyCommand({
            RoleName: fullRoleName,
            PolicyName: polName,
            PolicyDocument: JSON.stringify(policyDoc),
          }));
          appliedPolicies.push(polName);
        }
      }

      // Save to database
      const { error: dbError } = await supabase.from("cloudhub_roles").insert({
        user_id: user.id,
        role_name: roleName,
        role_arn: roleArn,
        description: description || null,
        max_session_duration_seconds: duration,
      });
      if (dbError) throw new Error(`Database save failed: ${dbError.message}`);

      // Audit log
      await supabase.from("role_audit_log").insert({
        user_id: user.id,
        action: "created",
        role_name: roleName,
        role_arn: roleArn,
        details: { permissions, tags, trustPolicy: trustPolicy, appliedPolicies, adminArn, accountId },
      });

      return new Response(JSON.stringify({ success: true, roleArn, roleName: fullRoleName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { roleId, deleteFromAWS } = body;
      if (!roleId) {
        return new Response(JSON.stringify({ error: "roleId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch role from DB
      const { data: role, error: roleError } = await supabase
        .from("cloudhub_roles")
        .select("*")
        .eq("id", roleId)
        .eq("user_id", user.id)
        .single();

      if (roleError || !role) {
        return new Response(JSON.stringify({ error: "Role not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fullRoleName = `CloudHub-Project-${role.role_name}`;
      let awsDeleteDetails: any = { deleteFromAWS };

      if (deleteFromAWS) {
        try {
          // 1. List and delete inline policies
          const inlinePolicies = await iamClient.send(new ListRolePoliciesCommand({ RoleName: fullRoleName }));
          const deletedInline: string[] = [];
          for (const polName of inlinePolicies.PolicyNames || []) {
            await iamClient.send(new DeleteRolePolicyCommand({ RoleName: fullRoleName, PolicyName: polName }));
            deletedInline.push(polName);
          }

          // 2. List and detach managed policies
          const managedPolicies = await iamClient.send(new ListAttachedRolePoliciesCommand({ RoleName: fullRoleName }));
          const detachedManaged: string[] = [];
          for (const pol of managedPolicies.AttachedPolicies || []) {
            if (pol.PolicyArn) {
              await iamClient.send(new DetachRolePolicyCommand({ RoleName: fullRoleName, PolicyArn: pol.PolicyArn }));
              detachedManaged.push(pol.PolicyArn);
            }
          }

          // 3. Delete the role
          await iamClient.send(new DeleteRoleCommand({ RoleName: fullRoleName }));

          awsDeleteDetails = { deleteFromAWS: true, deletedInline, detachedManaged, awsDeleted: true };
        } catch (awsErr: any) {
          console.error("AWS role deletion error:", awsErr);
          awsDeleteDetails = { deleteFromAWS: true, awsDeleted: false, error: awsErr.message };
        }
      }

      // Remove from DB regardless
      const { error: delError } = await supabase
        .from("cloudhub_roles")
        .delete()
        .eq("id", roleId);

      if (delError) throw new Error(`DB delete failed: ${delError.message}`);

      // Audit log
      await supabase.from("role_audit_log").insert({
        user_id: user.id,
        action: "deleted",
        role_name: role.role_name,
        role_arn: role.role_arn,
        details: awsDeleteDetails,
      });

      return new Response(JSON.stringify({ success: true, ...awsDeleteDetails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── LIST AUDIT LOG ──────────────────────────────────────────────────────
    if (action === "listAuditLog") {
      const { data, error } = await supabase
        .from("role_audit_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify({ auditLog: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("manage-cloudhub-roles error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
