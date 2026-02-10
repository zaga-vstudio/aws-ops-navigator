import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EC2Client,
  DescribeRouteTablesCommand,
  DescribeNetworkAclsCommand,
  DescribeNatGatewaysCommand,
  DescribeInternetGatewaysCommand,
  DescribeFlowLogsCommand,
  DescribeAccountAttributesCommand,
  DescribeAddressesCommand,
} from "npm:@aws-sdk/client-ec2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { access_key_id, secret_access_key, region } = credentials[0];
    const awsRegion = region || 'us-east-1';

    const ec2Client = new EC2Client({
      region: awsRegion,
      credentials: { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
    });

    // Fetch all advanced VPC data in parallel
    const [
      routeTablesRes,
      naclsRes,
      natGatewaysRes,
      igwsRes,
      flowLogsRes,
      accountAttrsRes,
      eipsRes,
    ] = await Promise.allSettled([
      ec2Client.send(new DescribeRouteTablesCommand({})),
      ec2Client.send(new DescribeNetworkAclsCommand({})),
      ec2Client.send(new DescribeNatGatewaysCommand({ Filter: [{ Name: 'state', Values: ['available', 'pending'] }] })),
      ec2Client.send(new DescribeInternetGatewaysCommand({})),
      ec2Client.send(new DescribeFlowLogsCommand({})),
      ec2Client.send(new DescribeAccountAttributesCommand({ AttributeNames: ['vpc-max-security-groups-per-interface', 'max-instances'] })),
      ec2Client.send(new DescribeAddressesCommand({})),
    ]);

    // Process route tables
    const routeTables = routeTablesRes.status === 'fulfilled'
      ? (routeTablesRes.value.RouteTables || []).map((rt: any) => ({
          id: rt.RouteTableId,
          vpcId: rt.VpcId,
          name: rt.Tags?.find((t: any) => t.Key === 'Name')?.Value || rt.RouteTableId,
          associations: (rt.Associations || []).map((a: any) => ({
            id: a.RouteTableAssociationId,
            subnetId: a.SubnetId || null,
            main: a.Main || false,
          })),
          routes: (rt.Routes || []).map((r: any) => ({
            destinationCidr: r.DestinationCidrBlock || r.DestinationIpv6CidrBlock || '',
            gatewayId: r.GatewayId || null,
            natGatewayId: r.NatGatewayId || null,
            instanceId: r.InstanceId || null,
            vpcPeeringConnectionId: r.VpcPeeringConnectionId || null,
            state: r.State || 'active',
            origin: r.Origin || 'unknown',
          })),
        }))
      : [];

    // Process NACLs
    const nacls = naclsRes.status === 'fulfilled'
      ? (naclsRes.value.NetworkAcls || []).map((nacl: any) => ({
          id: nacl.NetworkAclId,
          vpcId: nacl.VpcId,
          isDefault: nacl.IsDefault || false,
          name: nacl.Tags?.find((t: any) => t.Key === 'Name')?.Value || nacl.NetworkAclId,
          associations: (nacl.Associations || []).map((a: any) => ({
            id: a.NetworkAclAssociationId,
            subnetId: a.SubnetId,
          })),
          entries: (nacl.Entries || []).map((e: any) => ({
            ruleNumber: e.RuleNumber,
            protocol: e.Protocol,
            ruleAction: e.RuleAction,
            egress: e.Egress,
            cidrBlock: e.CidrBlock || e.Ipv6CidrBlock || '',
            portRange: e.PortRange ? { from: e.PortRange.From, to: e.PortRange.To } : null,
          })),
        }))
      : [];

    // Process NAT Gateways
    const natGateways = natGatewaysRes.status === 'fulfilled'
      ? (natGatewaysRes.value.NatGateways || []).map((ng: any) => ({
          id: ng.NatGatewayId,
          vpcId: ng.VpcId,
          subnetId: ng.SubnetId,
          state: ng.State,
          name: ng.Tags?.find((t: any) => t.Key === 'Name')?.Value || ng.NatGatewayId,
        }))
      : [];

    // Process Internet Gateways
    const internetGateways = igwsRes.status === 'fulfilled'
      ? (igwsRes.value.InternetGateways || []).map((igw: any) => ({
          id: igw.InternetGatewayId,
          attachments: (igw.Attachments || []).map((a: any) => ({
            vpcId: a.VpcId,
            state: a.State,
          })),
          name: igw.Tags?.find((t: any) => t.Key === 'Name')?.Value || igw.InternetGatewayId,
        }))
      : [];

    // Process Flow Logs
    const flowLogs = flowLogsRes.status === 'fulfilled'
      ? (flowLogsRes.value.FlowLogs || []).map((fl: any) => ({
          id: fl.FlowLogId,
          resourceId: fl.ResourceId,
          resourceType: fl.ResourceType,
          trafficType: fl.TrafficType,
          logStatus: fl.FlowLogStatus,
          logDestination: fl.LogDestination,
          logDestinationType: fl.LogDestinationType,
          creationTime: fl.CreationTime?.toISOString(),
        }))
      : [];

    // Process quotas
    const eipCount = eipsRes.status === 'fulfilled' ? (eipsRes.value.Addresses || []).length : 0;

    const result = {
      routeTables,
      nacls,
      natGateways,
      internetGateways,
      flowLogs,
      quotas: {
        eipsUsed: eipCount,
        eipsLimit: 5, // Default AWS limit
        natGatewaysUsed: natGateways.length,
        natGatewaysLimit: 5, // Default per-AZ limit
      },
    };

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('VPC advanced data error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch VPC advanced data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
