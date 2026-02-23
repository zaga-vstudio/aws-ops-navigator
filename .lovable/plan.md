

## Add Security Group Configuration for RDS Databases

Currently, the RDS database management does not expose security group information -- neither when creating new instances nor when viewing existing ones. This plan adds security group selection during creation and displays associated security groups in the database list.

### Changes Required

**1. Backend: Include security group data in RDS response**
- File: `supabase/functions/aws-dashboard-data/index.ts`
- Update the `RDSDatabase` interface to add `vpcSecurityGroups` field (array of `{ id: string, status: string }`)
- Update the `getRDSDatabases` function to extract `VpcSecurityGroups` from each `dbInstance` response and map them into the new field

**2. Frontend: Update RDSDatabase type**
- File: `src/hooks/useAWSData.tsx`
- Add `vpcSecurityGroups?: { id: string; status: string }[]` to the `RDSDatabase` interface

**3. Frontend: Show security groups in the RDS table**
- File: `src/pages/RDSDatabases.tsx`
- Add a "Security Groups" column to the table
- Display each security group ID as a clickable badge that can be cross-referenced with the Security page
- Show a count badge if multiple groups are associated

**4. Frontend: Add security group selection to CreateRDSDialog**
- File: `src/components/CreateRDSDialog.tsx`
- Accept `securityGroups` as a new prop (from `awsData.securityGroups`)
- Add a multi-select section in the Networking area (below Subnets) allowing users to pick one or more security groups filtered by the selected VPC
- Pass selected security group IDs to the edge function

**5. Backend: Accept security group IDs when creating RDS**
- File: `supabase/functions/manage-rds-instances/index.ts`
- Add `vpcSecurityGroupIds` to the `RDSActionRequest` interface
- Pass `VpcSecurityGroupIds` to the `CreateDBInstanceCommand` params when provided

### Technical Details

- The AWS `DescribeDBInstances` response already includes `VpcSecurityGroups` on each instance, so no additional API calls are needed
- The `CreateDBInstanceCommand` supports a `VpcSecurityGroupIds` parameter natively
- Security groups will be filtered by the selected VPC in the create dialog, matching the existing pattern for subnet filtering

