import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  EC2Client, 
  CreateVpcCommand,
  DeleteVpcCommand,
  CreateSubnetCommand,
  DeleteSubnetCommand,
  ModifyVpcAttributeCommand,
  CreateTagsCommand
} from "npm:@aws-sdk/client-ec2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VPCActionRequest {
  action: 'create-vpc' | 'delete-vpc' | 'create-subnet' | 'delete-subnet';
  // For create-vpc
  cidrBlock?: string;
  name?: string;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
  // For delete-vpc
  vpcId?: string;
  // For create-subnet
  subnetCidrBlock?: string;
  availabilityZone?: string;
  subnetName?: string;
  // For delete-subnet
  subnetId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} requesting VPC action`);

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      console.error('Credentials error:', credError);
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_key_id, secret_access_key, region } = credentials[0];

    const ec2Client = new EC2Client({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId: access_key_id,
        secretAccessKey: secret_access_key,
      },
    });

    const body: VPCActionRequest = await req.json();
    const { action } = body;

    console.log(`Executing VPC action: ${action}`);

    let result;

    switch (action) {
      case 'create-vpc': {
        const {
          cidrBlock = '10.0.0.0/16',
          name,
          enableDnsHostnames = true,
          enableDnsSupport = true,
        } = body;

        // Validate CIDR block format
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!cidrRegex.test(cidrBlock)) {
          return new Response(
            JSON.stringify({ error: 'Invalid CIDR block format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Creating VPC with CIDR:', cidrBlock);
        
        // Create the VPC
        const createVpcCommand = new CreateVpcCommand({
          CidrBlock: cidrBlock,
          TagSpecifications: name ? [
            {
              ResourceType: 'vpc',
              Tags: [{ Key: 'Name', Value: name }]
            }
          ] : undefined,
        });
        
        const vpcResult = await ec2Client.send(createVpcCommand);
        const vpcId = vpcResult.Vpc?.VpcId;
        
        console.log('VPC created:', vpcId);

        // Enable DNS hostnames if requested
        if (vpcId && enableDnsHostnames) {
          await ec2Client.send(new ModifyVpcAttributeCommand({
            VpcId: vpcId,
            EnableDnsHostnames: { Value: true },
          }));
          console.log('DNS hostnames enabled for VPC:', vpcId);
        }

        // Enable DNS support if requested
        if (vpcId && enableDnsSupport) {
          await ec2Client.send(new ModifyVpcAttributeCommand({
            VpcId: vpcId,
            EnableDnsSupport: { Value: true },
          }));
          console.log('DNS support enabled for VPC:', vpcId);
        }

        result = vpcResult;
        break;
      }

      case 'delete-vpc': {
        const { vpcId } = body;
        if (!vpcId) {
          return new Response(
            JSON.stringify({ error: 'VPC ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Deleting VPC:', vpcId);
        const deleteCommand = new DeleteVpcCommand({ VpcId: vpcId });
        result = await ec2Client.send(deleteCommand);
        console.log('VPC deleted:', vpcId);
        break;
      }

      case 'create-subnet': {
        const { vpcId, subnetCidrBlock, availabilityZone, subnetName } = body;
        
        if (!vpcId || !subnetCidrBlock) {
          return new Response(
            JSON.stringify({ error: 'VPC ID and subnet CIDR block are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Creating subnet in VPC:', vpcId);
        
        const createSubnetParams: any = {
          VpcId: vpcId,
          CidrBlock: subnetCidrBlock,
        };

        if (availabilityZone) {
          createSubnetParams.AvailabilityZone = availabilityZone;
        }

        if (subnetName) {
          createSubnetParams.TagSpecifications = [
            {
              ResourceType: 'subnet',
              Tags: [{ Key: 'Name', Value: subnetName }]
            }
          ];
        }

        const createSubnetCommand = new CreateSubnetCommand(createSubnetParams);
        result = await ec2Client.send(createSubnetCommand);
        console.log('Subnet created:', result.Subnet?.SubnetId);
        break;
      }

      case 'delete-subnet': {
        const { subnetId } = body;
        if (!subnetId) {
          return new Response(
            JSON.stringify({ error: 'Subnet ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Deleting subnet:', subnetId);
        const deleteSubnetCommand = new DeleteSubnetCommand({ SubnetId: subnetId });
        result = await ec2Client.send(deleteSubnetCommand);
        console.log('Subnet deleted:', subnetId);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, action, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('VPC action error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to execute VPC action',
        code: error.name || 'UnknownError'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
