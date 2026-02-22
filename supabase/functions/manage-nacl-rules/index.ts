import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EC2Client,
  CreateNetworkAclEntryCommand,
  DeleteNetworkAclEntryCommand,
  ReplaceNetworkAclEntryCommand,
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

    const validateRuleParams = (params: any) => {
      const { networkAclId, ruleNumber, protocol, cidrBlock, ruleAction, egress } = params;
      if (!networkAclId || typeof networkAclId !== 'string') throw new Error('networkAclId is required');
      if (ruleNumber == null || ruleNumber < 1 || ruleNumber > 32766) throw new Error('ruleNumber must be between 1 and 32766');
      if (!protocol || typeof protocol !== 'string') throw new Error('protocol is required');
      if (!cidrBlock || typeof cidrBlock !== 'string') throw new Error('cidrBlock is required');
      if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidrBlock) && !/^:.*\/\d{1,3}$/.test(cidrBlock)) {
        throw new Error('Invalid CIDR block format');
      }
      if (!['allow', 'deny'].includes(ruleAction)) throw new Error('ruleAction must be allow or deny');
      if (typeof egress !== 'boolean') throw new Error('egress must be a boolean');
    };

    if (action === 'create') {
      const { networkAclId, ruleNumber, protocol, cidrBlock, ruleAction, egress, fromPort, toPort } = body;
      validateRuleParams(body);
      const params: any = {
        NetworkAclId: networkAclId, RuleNumber: ruleNumber, Protocol: protocol,
        CidrBlock: cidrBlock, RuleAction: ruleAction, Egress: egress,
      };
      if (protocol !== '-1' && fromPort != null && toPort != null) {
        params.PortRange = { From: fromPort, To: toPort };
      }
      await ec2Client.send(new CreateNetworkAclEntryCommand(params));
      return new Response(JSON.stringify({ success: true, message: 'NACL rule created' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'update') {
      const { networkAclId, ruleNumber, protocol, cidrBlock, ruleAction, egress, fromPort, toPort } = body;
      validateRuleParams(body);
      const params: any = {
        NetworkAclId: networkAclId, RuleNumber: ruleNumber, Protocol: protocol,
        CidrBlock: cidrBlock, RuleAction: ruleAction, Egress: egress,
      };
      if (protocol !== '-1' && fromPort != null && toPort != null) {
        params.PortRange = { From: fromPort, To: toPort };
      }
      await ec2Client.send(new ReplaceNetworkAclEntryCommand(params));
      return new Response(JSON.stringify({ success: true, message: 'NACL rule updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else if (action === 'delete') {
      const { networkAclId, ruleNumber, egress } = body;
      if (!networkAclId) throw new Error('networkAclId is required');
      if (ruleNumber == null) throw new Error('ruleNumber is required');
      if (typeof egress !== 'boolean') throw new Error('egress must be a boolean');
      await ec2Client.send(new DeleteNetworkAclEntryCommand({
        NetworkAclId: networkAclId, RuleNumber: ruleNumber, Egress: egress,
      }));
      return new Response(JSON.stringify({ success: true, message: 'NACL rule deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    console.error('NACL rule management error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to manage NACL rule' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
