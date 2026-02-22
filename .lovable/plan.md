

## IAM User Permission Management (Revised)

### Overview
Add a "Manage Permissions" dialog to IAM users in `/security` that assigns scoped inline IAM policies using condition-based restrictions where needed. Follows a governance model: admins create VPCs, scoped users operate within them.

### Changes

**1. New Edge Function: `supabase/functions/manage-iam-permissions/index.ts`**

Handles three actions: `listPolicies`, `applyPermissions`, `listManagedPolicies`.

Core design principles:
- **Hardcoded action allowlists per service** -- the frontend sends service toggles (read/write booleans + resource scopes), NOT raw IAM actions. The backend maps these to a fixed set of actions.
- **Privilege escalation blocklist** -- rejects any request if the computed actions somehow include `iam:*`, `iam:AttachUserPolicy`, `iam:PutUserPolicy`, `iam:PassRole`, `sts:AssumeRole`, or any `iam:` prefix.
- **Condition-based scoping** for EC2 create actions (`ec2:RunInstances`, `ec2:CreateSecurityGroup`) that don't support resource-level restrictions. Uses `ec2:Vpc` condition key to scope to a specific VPC.
- **No `ec2:CreateVpc`** is ever granted -- VPC creation is admin-only.
- **Policy naming**: `CloudHub-Scoped-<Service>-<UserName>` (deterministic, overwrites cleanly on re-save).
- **ARN validation**: validates format of VPC IDs, instance IDs, and ARN patterns before generating policy JSON.

Service action mappings:

| Service | Read Actions | Write Actions | Scoping Model |
|---|---|---|---|
| EC2 | `ec2:Describe*` | `ec2:RunInstances`, `ec2:TerminateInstances`, `ec2:StartInstances`, `ec2:StopInstances` | Write actions use `ec2:Vpc` condition key |
| VPC | `ec2:DescribeVpcs`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups`, `ec2:DescribeRouteTables` | `ec2:ModifyVpcAttribute`, `ec2:CreateSubnet`, `ec2:DeleteSubnet` | Resource ARN for modify/subnet actions |
| Security Groups | `ec2:DescribeSecurityGroups`, `ec2:DescribeSecurityGroupRules` | `ec2:CreateSecurityGroup`, `ec2:AuthorizeSecurityGroupIngress/Egress`, `ec2:RevokeSecurityGroupIngress/Egress` | `ec2:Vpc` condition for create; resource ARN for modify |
| RDS | `rds:Describe*` | `rds:CreateDBInstance`, `rds:DeleteDBInstance`, `rds:ModifyDBInstance` | Resource ARN scoping |
| CloudWatch | `cloudwatch:Describe*`, `cloudwatch:GetMetricData`, `cloudwatch:ListMetrics` | `cloudwatch:PutMetricAlarm`, `cloudwatch:DeleteAlarms` | Resource ARN scoping |

Conflict detection: the `listManagedPolicies` action calls `ListAttachedUserPolicies` to detect if the user already has AWS managed policies like `AdministratorAccess`.

**2. New Component: `src/components/ManageIAMPermissionsDialog.tsx`**

A dialog with:
- **Service permission cards** (EC2, VPC, RDS, CloudWatch, Security Groups) each with Read/Write Switch toggles
- **Resource scope section** per card: text input for VPC IDs / resource ARNs, plus a dropdown of known resources from `awsData` (VPCs, EC2 instances, RDS databases)
- **ARN validation** on input (regex for `vpc-`, `i-`, `arn:aws:` patterns; checks subnet belongs to selected VPC if both provided)
- **Policy JSON preview**: expandable `<Collapsible>` section showing the exact IAM policy JSON that will be submitted. Includes a "Copy to Clipboard" button.
- **Warning banner**: if any policy statement has `"Resource": "*"` without conditions, a yellow warning is shown.
- **Managed policy conflict warning**: on load, if the user has broad managed policies attached, a banner says "This user already has broader permissions via attached managed policies. Scoped policies may not restrict effective access."
- **Confirmation step**: before applying, shows a summary of what will be created/updated/removed.

**3. Updated: `src/pages/Security.tsx`**
- Import `ManageIAMPermissionsDialog`
- Add state: `permissionsDialogOpen`, `permissionsDialogUser`
- Add a "Permissions" button (Shield icon) in the IAM Users table Actions column, between View and Manage
- Pass VPCs, EC2 instances, and RDS databases from `awsData` to the dialog

**4. Updated: `supabase/config.toml`**
- Add `[functions.manage-iam-permissions]` with `verify_jwt = true`

### Technical Details

**Condition-based scoping example** (EC2 RunInstances scoped to a VPC):
```json
{
  "Effect": "Allow",
  "Action": ["ec2:RunInstances"],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "ec2:Vpc": "arn:aws:ec2:us-east-1:123456789012:vpc/vpc-abc123"
    }
  }
}
```

Actions like `ec2:Describe*` always use `"Resource": "*"` (AWS requirement -- Describe calls don't support resource-level restriction). Write actions that support resource ARNs use them directly; those that don't (like `RunInstances`, `CreateSecurityGroup`) use condition keys instead.

**Privilege escalation protection** -- the edge function:
1. Only accepts service names (`ec2`, `vpc`, `rds`, `cloudwatch`, `security_groups`) and booleans, never raw IAM action strings from the client
2. Maps to hardcoded action arrays server-side
3. Validates the final computed action list against a blocklist before calling `PutUserPolicy`
4. Blocks: `iam:*`, `iam:AttachUserPolicy`, `iam:PutUserPolicy`, `iam:PassRole`, `sts:AssumeRole`

**Policy naming**: `CloudHub-Scoped-EC2-john_doe` -- deterministic so repeated saves overwrite the same policy. When both read and write are disabled for a service, `DeleteUserPolicy` removes it.

**ARN validation rules**:
- VPC IDs must match `/^vpc-[a-z0-9]+$/`
- EC2 instance IDs must match `/^i-[a-z0-9]+$/`
- Full ARNs must match `/^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/`
- Invalid inputs rejected with clear error messages before policy generation

**Required AWS permissions** on the parent account: `iam:PutUserPolicy`, `iam:DeleteUserPolicy`, `iam:ListUserPolicies`, `iam:GetUserPolicy`, `iam:ListAttachedUserPolicies`.

**JWT protection**: `verify_jwt = true` in config.toml. All requests require an authenticated Supabase session. The edge function verifies `supabase.auth.getUser()` before proceeding.

No database migrations needed.

### Governance Model

```text
Admin Account
  |-- Creates VPC (vpc-abc123)
  |-- Creates IAM User (project-user-1)
  |-- Assigns scoped permissions:
       EC2: read + write (scoped to vpc-abc123 via condition)
       Security Groups: read + write (scoped to vpc-abc123)
       RDS: read + write
       CloudWatch: read only
       VPC: read only (no CreateVpc)
```

### Limitations Documented in UI
- `Describe*` actions always apply to all resources (AWS limitation)
- VPC creation is not available to scoped users
- Condition-based scoping depends on the AWS service supporting the relevant condition keys
- Managed policies attached outside this tool may grant broader access than the scoped inline policies

