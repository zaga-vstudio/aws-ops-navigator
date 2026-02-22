import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  IAMClient,
  PutUserPolicyCommand,
  DeleteUserPolicyCommand,
  ListUserPoliciesCommand,
  GetUserPolicyCommand,
  ListAttachedUserPoliciesCommand,
} from "npm:@aws-sdk/client-iam@3.451.0";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Hardcoded action allowlists ──────────────────────────────────────────────

const SERVICE_ACTIONS: Record<
  string,
  {
    read: string[];
    write: string[];
    // Actions that need condition-based VPC scoping instead of resource ARNs
    conditionScoped?: string[];
  }
> = {
  ec2: {
    read: ["ec2:Describe*"],
    write: [
      "ec2:RunInstances",
      "ec2:TerminateInstances",
      "ec2:StartInstances",
      "ec2:StopInstances",
    ],
    conditionScoped: ["ec2:RunInstances"],
  },
  vpc: {
    read: [
      "ec2:DescribeVpcs",
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeRouteTables",
    ],
    write: [
      "ec2:ModifyVpcAttribute",
      "ec2:CreateSubnet",
      "ec2:DeleteSubnet",
    ],
  },
  security_groups: {
    read: [
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSecurityGroupRules",
    ],
    write: [
      "ec2:CreateSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupEgress",
    ],
    conditionScoped: ["ec2:CreateSecurityGroup"],
  },
  rds: {
    read: ["rds:Describe*"],
    write: [
      "rds:CreateDBInstance",
      "rds:DeleteDBInstance",
      "rds:ModifyDBInstance",
    ],
  },
  cloudwatch: {
    read: [
      "cloudwatch:Describe*",
      "cloudwatch:GetMetricData",
      "cloudwatch:ListMetrics",
    ],
    write: ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms"],
  },
};

// ── Privilege escalation blocklist ───────────────────────────────────────────

const BLOCKED_ACTION_PREFIXES = ["iam:"];
const BLOCKED_ACTIONS = [
  "iam:*",
  "iam:AttachUserPolicy",
  "iam:PutUserPolicy",
  "iam:PassRole",
  "sts:AssumeRole",
];

function validateNoEscalation(actions: string[]) {
  for (const action of actions) {
    if (BLOCKED_ACTIONS.includes(action)) {
      throw new Error(`Blocked action detected: ${action}`);
    }
    for (const prefix of BLOCKED_ACTION_PREFIXES) {
      if (action.startsWith(prefix)) {
        throw new Error(`Blocked action prefix detected: ${action}`);
      }
    }
  }
}

// ── ARN / ID validation ─────────────────────────────────────────────────────

const VPC_ID_RE = /^vpc-[a-z0-9]+$/;
const INSTANCE_ID_RE = /^i-[a-z0-9]+$/;
const ARN_RE = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;

function validateResourceId(id: string): boolean {
  return VPC_ID_RE.test(id) || INSTANCE_ID_RE.test(id) || ARN_RE.test(id);
}

// ── Policy document builder ─────────────────────────────────────────────────

interface ServicePermission {
  service: string;
  read: boolean;
  write: boolean;
  resourceArns?: string[];
  vpcIds?: string[];
}

function buildPolicyDocument(
  perm: ServicePermission,
  region: string,
  accountId: string
) {
  const serviceDef = SERVICE_ACTIONS[perm.service];
  if (!serviceDef) throw new Error(`Unknown service: ${perm.service}`);

  const statements: any[] = [];

  // Read actions — always Resource: "*" (AWS requirement for Describe*)
  if (perm.read) {
    const readActions = serviceDef.read;
    validateNoEscalation(readActions);
    statements.push({
      Effect: "Allow",
      Action: readActions,
      Resource: "*",
    });
  }

  if (perm.write) {
    const writeActions = serviceDef.write;
    validateNoEscalation(writeActions);

    const conditionScoped = serviceDef.conditionScoped || [];
    const arnScopedActions = writeActions.filter(
      (a) => !conditionScoped.includes(a)
    );
    const conditionActions = writeActions.filter((a) =>
      conditionScoped.includes(a)
    );

    // ARN-scoped write actions
    if (arnScopedActions.length > 0) {
      const resource =
        perm.resourceArns && perm.resourceArns.length > 0
          ? perm.resourceArns
          : "*";
      statements.push({
        Effect: "Allow",
        Action: arnScopedActions,
        Resource: resource,
      });
    }

    // Condition-scoped write actions (e.g. RunInstances, CreateSecurityGroup)
    if (conditionActions.length > 0) {
      const vpcArns = (perm.vpcIds || []).map(
        (id) => `arn:aws:ec2:${region}:${accountId}:vpc/${id}`
      );

      if (vpcArns.length > 0) {
        statements.push({
          Effect: "Allow",
          Action: conditionActions,
          Resource: "*",
          Condition: {
            StringEquals: {
              "ec2:Vpc": vpcArns.length === 1 ? vpcArns[0] : vpcArns,
            },
          },
        });
      } else {
        // No VPC scoping — still Resource: "*" but no condition
        statements.push({
          Effect: "Allow",
          Action: conditionActions,
          Resource: "*",
        });
      }
    }
  }

  return {
    Version: "2012-10-17",
    Statement: statements,
  };
}

function policyName(service: string, userName: string) {
  const serviceLabel =
    service === "security_groups"
      ? "SecurityGroups"
      : service.charAt(0).toUpperCase() + service.slice(1).toUpperCase();
  return `CloudHub-Scoped-${serviceLabel}-${userName}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userName, permissions, region: reqRegion, roleName } = body;
    console.log("manage-iam-permissions request:", { action, userName });

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabase.rpc(
      "get_user_aws_credentials",
      { user_id_param: user.id }
    );
    if (credError || !credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: "AWS credentials not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const creds = credentials[0];
    const awsRegion = reqRegion || creds.region || "us-east-1";

    const { credentials: awsCreds } = await resolveCredentials(
      supabase, user.id, user.email || '',
      { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
      awsRegion, roleName
    );

    const iamClient = new IAMClient({
      region: "us-east-1", // IAM is global
      credentials: awsCreds,
    });

    // ── listPolicies ────────────────────────────────────────────────────────
    if (action === "listPolicies") {
      if (!userName)
        return new Response(
          JSON.stringify({ error: "userName required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      const listCmd = new ListUserPoliciesCommand({ UserName: userName });
      const listResult = await iamClient.send(listCmd);
      const policyNames = listResult.PolicyNames || [];

      const policies: Record<string, any> = {};
      for (const name of policyNames) {
        if (name.startsWith("CloudHub-Scoped-")) {
          const getCmd = new GetUserPolicyCommand({
            UserName: userName,
            PolicyName: name,
          });
          const getResult = await iamClient.send(getCmd);
          policies[name] = JSON.parse(
            decodeURIComponent(getResult.PolicyDocument || "{}")
          );
        }
      }

      return new Response(JSON.stringify({ policies }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── listManagedPolicies ─────────────────────────────────────────────────
    if (action === "listManagedPolicies") {
      if (!userName)
        return new Response(
          JSON.stringify({ error: "userName required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );

      const listCmd = new ListAttachedUserPoliciesCommand({
        UserName: userName,
      });
      const result = await iamClient.send(listCmd);
      const managedPolicies = (result.AttachedPolicies || []).map((p) => ({
        policyName: p.PolicyName,
        policyArn: p.PolicyArn,
      }));

      return new Response(JSON.stringify({ managedPolicies }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── applyPermissions ────────────────────────────────────────────────────
    if (action === "applyPermissions") {
      if (!userName || !permissions) {
        return new Response(
          JSON.stringify({ error: "userName and permissions required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Validate resource IDs
      for (const perm of permissions as ServicePermission[]) {
        if (!SERVICE_ACTIONS[perm.service]) {
          return new Response(
            JSON.stringify({ error: `Unknown service: ${perm.service}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        for (const arn of perm.resourceArns || []) {
          if (!validateResourceId(arn)) {
            return new Response(
              JSON.stringify({
                error: `Invalid resource identifier: ${arn}`,
              }),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }
        for (const vid of perm.vpcIds || []) {
          if (!VPC_ID_RE.test(vid)) {
            return new Response(
              JSON.stringify({ error: `Invalid VPC ID: ${vid}` }),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }
        }
      }

      // We need an account ID for ARN construction.
      // Extract from existing creds ARN or caller identity if available.
      // For simplicity, accept it from the request body.
      const accountId = body.accountId || "000000000000";

      const results: Record<string, string> = {};

      for (const perm of permissions as ServicePermission[]) {
        const polName = policyName(perm.service, userName);

        if (!perm.read && !perm.write) {
          // Remove policy
          try {
            await iamClient.send(
              new DeleteUserPolicyCommand({
                UserName: userName,
                PolicyName: polName,
              })
            );
            results[perm.service] = "removed";
          } catch (e: any) {
            if (e.name === "NoSuchEntityException") {
              results[perm.service] = "already_absent";
            } else {
              throw e;
            }
          }
          continue;
        }

        const doc = buildPolicyDocument(perm, awsRegion, accountId);

        await iamClient.send(
          new PutUserPolicyCommand({
            UserName: userName,
            PolicyName: polName,
            PolicyDocument: JSON.stringify(doc),
          })
        );
        results[perm.service] = "applied";
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("manage-iam-permissions error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
