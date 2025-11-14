import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { EC2Client, AuthorizeSecurityGroupIngressCommand, AuthorizeSecurityGroupEgressCommand, RevokeSecurityGroupIngressCommand, RevokeSecurityGroupEgressCommand, DescribeSecurityGroupsCommand } from "npm:@aws-sdk/client-ec2@3.451.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityGroupRuleRequest {
  groupId: string;
  action: 'add' | 'remove';
  ruleType: 'ingress' | 'egress';
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  cidrIp?: string;
  sourceGroupId?: string;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestData: SecurityGroupRuleRequest = await req.json();
    console.log('Security group rule request:', requestData);

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabase.rpc('get_user_aws_credentials', {
      user_id_param: user.id
    });

    if (credError || !credentials || credentials.length === 0) {
      console.error('Error fetching credentials:', credError);
      return new Response(JSON.stringify({ error: 'AWS credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = credentials[0];
    const ec2Client = new EC2Client({
      region: creds.region || 'us-east-1',
      credentials: {
        accessKeyId: creds.access_key_id,
        secretAccessKey: creds.secret_access_key,
      },
    });

    // Create approval request first
    const { data: approval, error: approvalError } = await supabase
      .from('security_change_approvals')
      .insert({
        user_id: user.id,
        change_type: 'security_group_rule',
        change_details: requestData,
        reason: requestData.reason,
        status: 'pending'
      })
      .select()
      .single();

    if (approvalError) {
      console.error('Error creating approval:', approvalError);
      return new Response(JSON.stringify({ error: 'Failed to create approval request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-approve and execute (in production, you'd have a separate approval flow)
    try {
      let command;
      const ipPermission: any = {
        IpProtocol: requestData.ipProtocol,
      };

      if (requestData.fromPort !== undefined) {
        ipPermission.FromPort = requestData.fromPort;
      }
      if (requestData.toPort !== undefined) {
        ipPermission.ToPort = requestData.toPort;
      }
      if (requestData.cidrIp) {
        ipPermission.IpRanges = [{ CidrIp: requestData.cidrIp }];
      }
      if (requestData.sourceGroupId) {
        ipPermission.UserIdGroupPairs = [{ GroupId: requestData.sourceGroupId }];
      }

      if (requestData.action === 'add') {
        if (requestData.ruleType === 'ingress') {
          command = new AuthorizeSecurityGroupIngressCommand({
            GroupId: requestData.groupId,
            IpPermissions: [ipPermission]
          });
        } else {
          command = new AuthorizeSecurityGroupEgressCommand({
            GroupId: requestData.groupId,
            IpPermissions: [ipPermission]
          });
        }
      } else {
        if (requestData.ruleType === 'ingress') {
          command = new RevokeSecurityGroupIngressCommand({
            GroupId: requestData.groupId,
            IpPermissions: [ipPermission]
          });
        } else {
          command = new RevokeSecurityGroupEgressCommand({
            GroupId: requestData.groupId,
            IpPermissions: [ipPermission]
          });
        }
      }

      const result = await ec2Client.send(command);
      console.log('Security group rule operation result:', result);

      // Update approval status
      await supabase
        .from('security_change_approvals')
        .update({
          status: 'executed',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          execution_result: { success: true, result }
        })
        .eq('id', approval.id);

      // Send notifications if configured
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (notifPrefs?.webhook_url) {
        fetch(notifPrefs.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'security_group_modified',
            groupId: requestData.groupId,
            action: requestData.action,
            ruleType: requestData.ruleType,
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.error('Notification webhook failed:', err));
      }

      return new Response(JSON.stringify({ 
        success: true, 
        approvalId: approval.id,
        message: 'Security group rule updated successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Error executing security group change:', error);

      // Update approval status to failed
      await supabase
        .from('security_change_approvals')
        .update({
          status: 'failed',
          execution_result: { success: false, error: error.message }
        })
        .eq('id', approval.id);

      return new Response(JSON.stringify({ 
        error: 'Failed to update security group', 
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
