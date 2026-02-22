import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { EC2Client, CreateSecurityGroupCommand } from "npm:@aws-sdk/client-ec2@3.451.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { groupName, description, vpcId } = await req.json();

    if (!groupName || !description || !vpcId) {
      return new Response(JSON.stringify({ error: 'groupName, description, and vpcId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const command = new CreateSecurityGroupCommand({
      GroupName: groupName,
      Description: description,
      VpcId: vpcId,
    });

    const result = await ec2Client.send(command);
    console.log('Created security group:', result.GroupId);

    return new Response(JSON.stringify({
      success: true,
      groupId: result.GroupId,
      message: `Security group "${groupName}" created successfully`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error creating security group:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
