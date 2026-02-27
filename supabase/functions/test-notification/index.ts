import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotification } from "../_shared/dispatch-notification.ts";
import {
  SNSClient,
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
} from "npm:@aws-sdk/client-sns";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function healSnsSubscription(userId: string, userClient: any) {
  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's SNS topic ARN
    const { data: prefs } = await serviceClient
      .from('notification_preferences')
      .select('sns_topic_arn')
      .eq('user_id', userId)
      .single();

    if (!prefs?.sns_topic_arn) {
      console.log('No SNS topic ARN configured, skipping health check');
      return;
    }

    console.log(`Checking SNS subscriptions for topic: ${prefs.sns_topic_arn}`);

    // Get AWS credentials
    const { data: creds } = await userClient.rpc('get_user_aws_credentials', {
      user_id_param: userId,
    });

    if (!creds || creds.length === 0) {
      console.log('No AWS credentials found, skipping SNS health check');
      return;
    }

    const { access_key_id, secret_access_key, region } = creds[0];

    // Extract region from topic ARN (arn:aws:sns:REGION:ACCOUNT:NAME)
    const arnParts = prefs.sns_topic_arn.split(':');
    const topicRegion = arnParts[3] || region || 'us-east-1';

    const snsClient = new SNSClient({
      region: topicRegion,
      credentials: {
        accessKeyId: access_key_id,
        secretAccessKey: secret_access_key,
      },
    });

    // List subscriptions for this topic
    const listResult = await snsClient.send(
      new ListSubscriptionsByTopicCommand({ TopicArn: prefs.sns_topic_arn })
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookEndpoint = `${supabaseUrl}/functions/v1/sns-webhook`;

    console.log(`Webhook endpoint: ${webhookEndpoint}`);
    console.log(`Found ${listResult.Subscriptions?.length || 0} subscriptions`);

    let hasPending = false;
    let hasConfirmed = false;

    for (const sub of listResult.Subscriptions || []) {
      if (sub.Endpoint === webhookEndpoint) {
        if (sub.SubscriptionArn === 'PendingConfirmation') {
          hasPending = true;
          console.log('Found PendingConfirmation subscription for sns-webhook');
        } else {
          hasConfirmed = true;
          console.log(`Found confirmed subscription: ${sub.SubscriptionArn}`);
        }
      }
    }

    if (hasPending && !hasConfirmed) {
      console.log('Re-subscribing sns-webhook endpoint to heal pending subscription...');
      const subscribeResult = await snsClient.send(
        new SubscribeCommand({
          TopicArn: prefs.sns_topic_arn,
          Protocol: 'https',
          Endpoint: webhookEndpoint,
          ReturnSubscriptionArn: true,
        })
      );
      console.log(`Re-subscribe result: ${subscribeResult.SubscriptionArn}`);
    } else if (!hasPending && !hasConfirmed) {
      console.log('No subscription found for sns-webhook, creating new one...');
      const subscribeResult = await snsClient.send(
        new SubscribeCommand({
          TopicArn: prefs.sns_topic_arn,
          Protocol: 'https',
          Endpoint: webhookEndpoint,
          ReturnSubscriptionArn: true,
        })
      );
      console.log(`New subscribe result: ${subscribeResult.SubscriptionArn}`);
    } else {
      console.log('SNS subscription is healthy (confirmed)');
    }
  } catch (error) {
    console.error('SNS health check error (non-fatal):', error.message);
  }
}

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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const channel = body.channel || 'all';

    console.log(`Test notification requested by ${user.id} for channel: ${channel}`);

    // Heal SNS subscription as a side effect
    await healSnsSubscription(user.id, supabaseClient);

    const testAlert = {
      alertName: '🧪 Test Notification',
      metric: 'TestMetric',
      threshold: 100,
      currentValue: 42,
      severity: 'info',
    };

    const results = await dispatchNotification(user.id, user.email || null, testAlert);

    if (channel !== 'all') {
      const channelResult = results[channel];
      if (!channelResult) {
        return new Response(
          JSON.stringify({ success: false, error: `Channel "${channel}" is not configured`, results: {} }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: channelResult.success, results: { [channel]: channelResult } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anySuccess = Object.values(results).some((r: any) => r.success);
    const noChannels = Object.keys(results).length === 0;

    return new Response(
      JSON.stringify({
        success: anySuccess,
        noChannels,
        results,
        message: noChannels
          ? 'No notification channels are configured'
          : anySuccess
            ? 'Test notification sent successfully'
            : 'All notification channels failed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending test notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
