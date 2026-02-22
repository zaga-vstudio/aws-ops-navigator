import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EC2Client,
  CreateFlowLogsCommand,
  DeleteFlowLogsCommand,
} from "npm:@aws-sdk/client-ec2";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

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

    const body = await req.json();
    const { action, roleName } = body;

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

    if (action === 'enable') {
      const { vpcId, trafficType = 'ALL' } = body;
      if (!vpcId) {
        return new Response(JSON.stringify({ error: 'VPC ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const result = await ec2Client.send(new CreateFlowLogsCommand({
        ResourceIds: [vpcId],
        ResourceType: 'VPC',
        TrafficType: trafficType,
        LogDestinationType: 'cloud-watch-logs',
        LogGroupName: `/aws/vpc/flowlogs/${vpcId}`,
        MaxAggregationInterval: 600,
        TagSpecifications: [{
          ResourceType: 'vpc-flow-log',
          Tags: [{ Key: 'ManagedBy', Value: 'CloudHub' }],
        }],
      }));

      return new Response(JSON.stringify({ success: true, flowLogIds: result.FlowLogIds }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'disable') {
      const { flowLogIds } = body;
      if (!flowLogIds || flowLogIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Flow Log IDs are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await ec2Client.send(new DeleteFlowLogsCommand({ FlowLogIds: flowLogIds }));

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Flow logs error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to manage flow logs' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
