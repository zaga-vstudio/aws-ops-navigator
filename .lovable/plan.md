

## Create Security Group from the Security Page

### What This Adds
A "Create Security Group" button on the Security Groups tab in `/security`, opening a dialog where you can specify a name, description, and VPC, then create the group in your AWS account.

### Changes

**1. New Edge Function: `supabase/functions/create-security-group/index.ts`**
- Accepts `groupName`, `description`, and `vpcId` in the request body
- Authenticates the user and retrieves their AWS credentials
- Calls the AWS `CreateSecurityGroupCommand` from `@aws-sdk/client-ec2`
- Returns the newly created Security Group ID
- Logs the action for audit purposes

**2. New Component: `src/components/CreateSecurityGroupDialog.tsx`**
- Dialog with fields for:
  - **Group Name** (required, validated: alphanumeric, hyphens, underscores)
  - **Description** (required, min 10 characters)
  - **VPC** (dropdown populated from existing VPCs in `awsData`)
- Validates inputs with Zod (following the pattern used in `ManageSecurityGroupDialog`)
- Calls the new edge function on submit
- Shows success/error toast and triggers data refetch on success

**3. Updated Page: `src/pages/Security.tsx`**
- Add a "Create Security Group" button (with a `+` icon) in the Security Groups `CardHeader`, similar to how the IAM Users tab already has a "Create User" button
- Wire the button to open the new `CreateSecurityGroupDialog`
- Pass VPC list from `awsData` and `refetch` callback to the dialog

### Technical Details

The edge function follows the same pattern as `manage-security-groups/index.ts`:
- CORS headers
- Supabase auth check
- AWS credentials retrieval via `get_user_aws_credentials` RPC
- Uses `CreateSecurityGroupCommand` with `GroupName`, `Description`, and `VpcId` parameters

No database migrations are needed -- this only uses the existing AWS credentials infrastructure and the existing edge function patterns.

