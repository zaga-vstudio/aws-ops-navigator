import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EC2Client,
  CreateNetworkInsightsPathCommand,
  StartNetworkInsightsAnalysisCommand,
  DescribeNetworkInsightsAnalysesCommand,
  DeleteNetworkInsightsPathCommand,
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

    if (action === 'analyze') {
      const { sourceId, destinationId, protocol = 'tcp', destinationPort = 443 } = body;

      if (!sourceId || !destinationId) {
        return new Response(JSON.stringify({ error: 'Source and destination are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Create the network insights path
      const pathResult = await ec2Client.send(new CreateNetworkInsightsPathCommand({
        Source: sourceId,
        Destination: destinationId,
        Protocol: protocol,
        DestinationPort: destinationPort,
        TagSpecifications: [{
          ResourceType: 'network-insights-path',
          Tags: [{ Key: 'ManagedBy', Value: 'CloudHub' }],
        }],
      }));

      const pathId = pathResult.NetworkInsightsPath?.NetworkInsightsPathId;
      if (!pathId) {
        return new Response(JSON.stringify({ error: 'Failed to create analysis path' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Start the analysis
      const analysisResult = await ec2Client.send(new StartNetworkInsightsAnalysisCommand({
        NetworkInsightsPathId: pathId,
      }));

      const analysisId = analysisResult.NetworkInsightsAnalysis?.NetworkInsightsAnalysisId;

      // Poll for results (max 30 seconds)
      let analysis = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const descResult = await ec2Client.send(new DescribeNetworkInsightsAnalysesCommand({
          NetworkInsightsAnalysisIds: [analysisId!],
        }));
        const a = descResult.NetworkInsightsAnalyses?.[0];
        if (a?.Status === 'succeeded' || a?.Status === 'failed') {
          analysis = a;
          break;
        }
      }

      // Cleanup the path
      try {
        await ec2Client.send(new DeleteNetworkInsightsPathCommand({
          NetworkInsightsPathId: pathId,
        }));
      } catch (e) {
        console.warn('Failed to cleanup path:', e);
      }

      if (!analysis) {
        return new Response(JSON.stringify({ error: 'Analysis timed out' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const result = {
        id: analysis.NetworkInsightsAnalysisId,
        status: analysis.Status,
        reachable: analysis.NetworkPathFound || false,
        explanations: (analysis.Explanations || []).map((e: any) => ({
          component: e.Component?.Id || 'Unknown',
          componentArn: e.Component?.Arn,
          direction: e.Direction,
          explanation: e.ExplanationCode || 'No explanation',
          resourceId: e.Subnet?.Id || e.SecurityGroup?.Id || e.RouteTable?.Id || e.Acl?.Id || '',
          resourceType: e.Subnet ? 'Subnet' : e.SecurityGroup ? 'SecurityGroup' : e.RouteTable ? 'RouteTable' : e.Acl ? 'NACL' : 'Unknown',
        })),
        forwardPath: (analysis.ForwardPathComponents || []).map((c: any) => ({
          sequenceNumber: c.SequenceNumber,
          component: c.Component?.Id || 'Unknown',
          componentArn: c.Component?.Arn,
          inboundHeader: c.InboundHeader ? {
            sourceAddress: c.InboundHeader.SourceAddresses?.join(', '),
            destAddress: c.InboundHeader.DestinationAddresses?.join(', '),
            protocol: c.InboundHeader.Protocol,
          } : null,
        })),
      };

      return new Response(JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Reachability analyzer error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to run reachability analysis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
