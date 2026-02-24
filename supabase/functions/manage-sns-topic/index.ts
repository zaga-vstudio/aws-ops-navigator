import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SNSClient, CreateTopicCommand, SubscribeCommand, GetTopicAttributesCommand } from "npm:@aws-sdk/client-sns";
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
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) || '';

    const body = await req.json();
    const { roleName } = body;

    // Check if user already has an SNS topic
    const { data: prefs } = await supabaseClient
      .from('notification_preferences')
      .select('sns_topic_arn')
      .eq('user_id', userId)
      .single();

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: userId });

    if (credError || !credentials || credentials.length === 0) {
      throw new Error('AWS credentials not configured');
    }

    const { access_key_id, secret_access_key, region } = credentials[0];
    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, userId, userEmail,
      { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
      region || 'us-east-1', roleName
    );

    const snsClient = new SNSClient({
      region: region || 'us-east-1',
      credentials: awsCreds,
    });

    // If topic ARN exists, verify it still exists in AWS
    if (prefs?.sns_topic_arn) {
      try {
        await snsClient.send(new GetTopicAttributesCommand({ TopicArn: prefs.sns_topic_arn }));
        console.log('Existing SNS topic verified:', prefs.sns_topic_arn);
        return new Response(JSON.stringify({
          success: true,
          topicArn: prefs.sns_topic_arn,
          message: 'Existing topic verified',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.warn('Existing topic not found, recreating:', e.message);
      }
    }

    // Create topic - sanitize name: [a-zA-Z0-9_-], max 256 chars
    const userPrefix = userId.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 8);
    const topicName = `CloudHub-${userPrefix}`;

    const createResult = await snsClient.send(new CreateTopicCommand({
      Name: topicName,
      Tags: [
        { Key: 'CloudHubUser', Value: userId },
        { Key: 'ManagedBy', Value: 'CloudHub' },
      ],
    }));

    const topicArn = createResult.TopicArn;
    if (!topicArn) {
      throw new Error('Failed to create SNS topic');
    }

    console.log('Created SNS topic:', topicArn);

    // Subscribe the sns-webhook edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookEndpoint = `${supabaseUrl}/functions/v1/sns-webhook`;

    await snsClient.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: webhookEndpoint,
    }));

    console.log('Subscribed webhook endpoint:', webhookEndpoint);

    // Store topic ARN in notification_preferences
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: upsertError } = await serviceClient
      .from('notification_preferences')
      .upsert(
        { user_id: userId, sns_topic_arn: topicArn },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('Failed to save topic ARN:', upsertError);
    }

    return new Response(JSON.stringify({
      success: true,
      topicArn,
      message: 'SNS topic created and webhook subscribed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error managing SNS topic:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to manage SNS topic' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
