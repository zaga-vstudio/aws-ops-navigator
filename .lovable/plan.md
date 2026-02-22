

## Add VPC and Subnet Selection to EC2 Launch Dialog

Currently, instances are always launched into the default VPC with no control over placement. This plan adds VPC and Subnet dropdowns so you can choose exactly where your instance lands, plus automatically filters security groups to match the selected VPC.

### What Changes

**1. LaunchEC2Dialog.tsx - Add VPC/Subnet/Security Group selectors**

- Accept VPCs, Subnets, and Security Groups as props (from the AWSDataContext already available on the EC2 page)
- Add a **"Networking"** section after Instance Type with:
  - **VPC dropdown**: Lists all VPCs by name/ID, defaults to the default VPC
  - **Subnet dropdown**: Filters to show only subnets belonging to the selected VPC, with labels showing name, AZ, and available IPs
  - **Security Group dropdown**: Filters to show only security groups belonging to the selected VPC, allows selecting one or more
- When a VPC is selected, the subnet and security group lists automatically update
- Pass `subnetId` and `securityGroupIds` to the launch params (the edge function already supports these fields)

**2. EC2Instances.tsx - Pass data to the dialog**

- Pass `vpcs`, `subnets`, and `securityGroups` from the AWS data context into the `LaunchEC2Dialog` component

**3. Update the permissions info text**

- Remove the line saying "launched in your default VPC" since users now choose

### Technical Details

- The `manage-ec2-instances` edge function already accepts `subnetId` and `securityGroupIds` in the launch params -- no backend changes needed
- The `handleLaunch` function will include `subnetId` and `securityGroupIds` in the request body
- New state variables: `selectedVpcId`, `selectedSubnetId`, `selectedSecurityGroupIds`
- Subnet list will show Public/Private indicators based on route table data (if available) or just the subnet name and AZ

