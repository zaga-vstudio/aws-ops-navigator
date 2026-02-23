import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  EC2Client, CreateVpcCommand, DeleteVpcCommand, CreateSubnetCommand,
  DeleteSubnetCommand, ModifyVpcAttributeCommand, CreateTagsCommand,
  CreateRouteTableCommand, CreateRouteCommand, AssociateRouteTableCommand,
  ModifySubnetAttributeCommand, DescribeInternetGatewaysCommand,
  CreateInternetGatewayCommand, AttachInternetGatewayCommand
} from "npm:@aws-sdk/client-ec2";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VPCActionRequest {
  action: 'create-vpc' | 'delete-vpc' | 'create-subnet' | 'delete-subnet';
  cidrBlock?: string; name?: string; enableDnsHostnames?: boolean; enableDnsSupport?: boolean;
  vpcId?: string; subnetCidrBlock?: string; availabilityZone?: string; subnetName?: string;
  subnetId?: string; roleName?: string; subnetType?: 'public' | 'private';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: VPCActionRequest = await req.json();
    const { action, roleName } = body;

    console.log(`User ${user.id} requesting VPC action: ${action}`);

    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { access_key_id, secret_access_key, region } = credentials[0];

    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, user.id, user.email || '',
      { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
      region || 'us-east-1', roleName
    );

    const ec2Client = new EC2Client({
      region: region || 'us-east-1',
      credentials: awsCreds,
    });

    let result;

    switch (action) {
      case 'create-vpc': {
        const { cidrBlock = '10.0.0.0/16', name, enableDnsHostnames = true, enableDnsSupport = true } = body;
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!cidrRegex.test(cidrBlock)) {
          return new Response(JSON.stringify({ error: 'Invalid CIDR block format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const vpcResult = await ec2Client.send(new CreateVpcCommand({
          CidrBlock: cidrBlock,
          TagSpecifications: name ? [{ ResourceType: 'vpc', Tags: [{ Key: 'Name', Value: name }] }] : undefined,
        }));
        const vpcId = vpcResult.Vpc?.VpcId;
        if (vpcId && enableDnsHostnames) await ec2Client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsHostnames: { Value: true } }));
        if (vpcId && enableDnsSupport) await ec2Client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsSupport: { Value: true } }));
        result = vpcResult;
        break;
      }
      case 'delete-vpc': {
        const { vpcId } = body;
        if (!vpcId) return new Response(JSON.stringify({ error: 'VPC ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await ec2Client.send(new DeleteVpcCommand({ VpcId: vpcId }));
        break;
      }
      case 'create-subnet': {
        const { vpcId, subnetCidrBlock, availabilityZone, subnetName, subnetType = 'private' } = body;
        if (!vpcId || !subnetCidrBlock) return new Response(JSON.stringify({ error: 'VPC ID and subnet CIDR block are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const createSubnetParams: any = { VpcId: vpcId, CidrBlock: subnetCidrBlock };
        if (availabilityZone) createSubnetParams.AvailabilityZone = availabilityZone;
        if (subnetName) createSubnetParams.TagSpecifications = [{ ResourceType: 'subnet', Tags: [{ Key: 'Name', Value: subnetName }] }];
        const subnetResult = await ec2Client.send(new CreateSubnetCommand(createSubnetParams));
        const newSubnetId = subnetResult.Subnet?.SubnetId;

        if (newSubnetId && subnetType === 'public') {
          // 1. Find or create an Internet Gateway for this VPC
          const igwDesc = await ec2Client.send(new DescribeInternetGatewaysCommand({
            Filters: [{ Name: 'attachment.vpc-id', Values: [vpcId!] }]
          }));
          let igwId = igwDesc.InternetGateways?.[0]?.InternetGatewayId;
          if (!igwId) {
            const newIgw = await ec2Client.send(new CreateInternetGatewayCommand({}));
            igwId = newIgw.InternetGateway?.InternetGatewayId;
            if (igwId) await ec2Client.send(new AttachInternetGatewayCommand({ InternetGatewayId: igwId, VpcId: vpcId }));
          }

          // 2. Create a dedicated route table with IGW route
          const rtResult = await ec2Client.send(new CreateRouteTableCommand({ VpcId: vpcId }));
          const rtId = rtResult.RouteTable?.RouteTableId;
          if (rtId && igwId) {
            await ec2Client.send(new CreateRouteCommand({
              RouteTableId: rtId, DestinationCidrBlock: '0.0.0.0/0', GatewayId: igwId
            }));
            await ec2Client.send(new AssociateRouteTableCommand({ RouteTableId: rtId, SubnetId: newSubnetId }));
            // Tag the route table
            await ec2Client.send(new CreateTagsCommand({
              Resources: [rtId],
              Tags: [{ Key: 'Name', Value: `${subnetName || newSubnetId}-public-rt` }]
            }));
          }

          // 3. Enable auto-assign public IP
          await ec2Client.send(new ModifySubnetAttributeCommand({
            SubnetId: newSubnetId, MapPublicIpOnLaunch: { Value: true }
          }));
        }

        result = subnetResult;
        break;
      }
      case 'delete-subnet': {
        const { subnetId } = body;
        if (!subnetId) return new Response(JSON.stringify({ error: 'Subnet ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        result = await ec2Client.send(new DeleteSubnetCommand({ SubnetId: subnetId }));
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, action, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('VPC action error:', error);
    const isClientError = error?.$metadata?.httpStatusCode === 400 || 
      ['DependencyViolation', 'InvalidParameterValue', 'InvalidVpcID.NotFound', 'InvalidSubnetID.NotFound'].includes(error?.name);
    const status = isClientError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to execute VPC action', code: error.name || 'UnknownError' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
