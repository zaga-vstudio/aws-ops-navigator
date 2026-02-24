import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotification } from "../_shared/dispatch-notification.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-amz-sns-message-type, x-amz-sns-message-id, x-amz-sns-topic-arn, x-amz-sns-subscription-arn',
};

// --- SNS Signature Validation ---

function validateCertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTPS from an amazonaws.com SNS domain
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.match(/^sns\.[a-z0-9-]+\.amazonaws\.com$/)) return false;
    return true;
  } catch {
    return false;
  }
}

function buildStringToSign(message: Record<string, any>, messageType: string): string {
  // AWS SNS string-to-sign construction per AWS spec
  const fields: string[] = [];

  if (messageType === 'Notification') {
    fields.push('Message', message.Message);
    fields.push('MessageId', message.MessageId);
    if (message.Subject) {
      fields.push('Subject', message.Subject);
    }
    fields.push('Timestamp', message.Timestamp);
    fields.push('TopicArn', message.TopicArn);
    fields.push('Type', message.Type);
  } else {
    // SubscriptionConfirmation or UnsubscribeConfirmation
    fields.push('Message', message.Message);
    fields.push('MessageId', message.MessageId);
    fields.push('SubscribeURL', message.SubscribeURL);
    fields.push('Timestamp', message.Timestamp);
    fields.push('Token', message.Token);
    fields.push('TopicArn', message.TopicArn);
    fields.push('Type', message.Type);
  }

  return fields.join('\n') + '\n';
}

async function verifySnsSignature(message: Record<string, any>, messageType: string): Promise<boolean> {
  const certUrl = message.SigningCertURL;
  if (!certUrl || !validateCertUrl(certUrl)) {
    console.error('Invalid SigningCertURL:', certUrl);
    return false;
  }

  try {
    // Fetch the PEM certificate
    const certResponse = await fetch(certUrl);
    if (!certResponse.ok) {
      console.error('Failed to fetch signing certificate');
      return false;
    }
    const pemText = await certResponse.text();

    // Parse PEM to DER
    const pemBody = pemText
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
    const certDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    // Import the certificate's public key
    const cert = await crypto.subtle.importKey(
      'spki',
      certDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify']
    );

    // Build string to sign
    const stringToSign = buildStringToSign(message, messageType);
    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);

    // Decode signature
    const signature = Uint8Array.from(atob(message.Signature), c => c.charCodeAt(0));

    // Verify
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cert, signature, data);
    return valid;
  } catch (e) {
    console.error('SNS signature verification error:', e);
    // If crypto verification fails (e.g., cert format issues), 
    // try an X.509 parse approach - for now, log and reject
    return false;
  }
}

// --- Main Handler ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const message = JSON.parse(body);

    const messageType = req.headers.get('x-amz-sns-message-type') || message.Type;

    if (!messageType) {
      return new Response(JSON.stringify({ error: 'Missing SNS message type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate SNS signature
    const signatureVersion = message.SignatureVersion;
    if (signatureVersion === '1') {
      const valid = await verifySnsSignature(message, messageType);
      if (!valid) {
        console.error('SNS signature validation failed');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('SNS signature validated successfully');
    } else {
      console.warn('Unknown SignatureVersion:', signatureVersion, '- proceeding with caution');
    }

    // Handle SubscriptionConfirmation
    if (messageType === 'SubscriptionConfirmation') {
      const subscribeUrl = message.SubscribeURL;
      if (subscribeUrl) {
        console.log('Confirming SNS subscription...');
        const confirmRes = await fetch(subscribeUrl);
        console.log('Subscription confirmation status:', confirmRes.status);
        return new Response(JSON.stringify({ success: true, message: 'Subscription confirmed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'No SubscribeURL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle UnsubscribeConfirmation
    if (messageType === 'UnsubscribeConfirmation') {
      console.log('Received unsubscribe confirmation');
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle Notification
    if (messageType === 'Notification') {
      let alarmData: any;
      try {
        alarmData = JSON.parse(message.Message);
      } catch {
        console.error('Failed to parse SNS message body as JSON');
        return new Response(JSON.stringify({ error: 'Invalid message format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const alarmName = alarmData.AlarmName;
      const newStateValue = alarmData.NewStateValue; // ALARM, OK, INSUFFICIENT_DATA
      const trigger = alarmData.Trigger || {};

      console.log(`CloudWatch alarm: ${alarmName}, state: ${newStateValue}`);

      // Skip INSUFFICIENT_DATA - no notification needed
      if (newStateValue === 'INSUFFICIENT_DATA') {
        console.log('Skipping INSUFFICIENT_DATA state');
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Map state to event_type
      const eventType = newStateValue === 'ALARM' ? 'triggered' : 'resolved';

      // Look up the alert rule by cloudwatch_alarm_name
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: rule, error: ruleError } = await serviceClient
        .from('alert_rules')
        .select('id, user_id, name, metric, threshold, severity')
        .eq('cloudwatch_alarm_name', alarmName)
        .is('deleted_at', null)
        .single();

      if (ruleError || !rule) {
        console.error('Alert rule not found for alarm:', alarmName, ruleError);
        return new Response(JSON.stringify({ error: 'Alert rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user email for notifications
      const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(rule.user_id);
      const userEmail = authUser?.email || null;

      // Dispatch notifications
      let notificationResults = {};
      if (eventType === 'triggered') {
        notificationResults = await dispatchNotification(
          rule.user_id,
          userEmail,
          {
            alertName: rule.name,
            metric: rule.metric || trigger.MetricName || 'Unknown',
            threshold: rule.threshold || trigger.Threshold || 0,
            currentValue: undefined, // CloudWatch doesn't always include current value in alarm
            severity: rule.severity,
          }
        );
      }

      // Insert into alert_history
      const { error: insertError } = await serviceClient
        .from('alert_history')
        .insert({
          user_id: rule.user_id,
          alert_rule_id: rule.id,
          cloudwatch_alarm_name: alarmName,
          alert_name: rule.name,
          metric: rule.metric || trigger.MetricName || 'Unknown',
          threshold: rule.threshold || trigger.Threshold,
          current_value: null,
          state_value: newStateValue,
          severity: rule.severity,
          event_type: eventType,
          notification_results: notificationResults,
        });

      if (insertError) {
        console.error('Failed to insert alert history:', insertError);
      } else {
        console.log(`Alert history logged: ${eventType} for ${alarmName}`);
      }

      return new Response(JSON.stringify({
        success: true,
        eventType,
        alarmName,
        notificationResults,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unhandled message type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('SNS webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
