import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dispatchNotification } from "../_shared/dispatch-notification.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-amz-sns-message-type, x-amz-sns-message-id, x-amz-sns-topic-arn, x-amz-sns-subscription-arn',
};

// --- ASN.1 / X.509 helpers ---

function parseASN1Length(data: Uint8Array, offset: number): { length: number; nextOffset: number } {
  const firstByte = data[offset];
  if (firstByte < 0x80) {
    return { length: firstByte, nextOffset: offset + 1 };
  }
  const numBytes = firstByte & 0x7f;
  let length = 0;
  for (let i = 0; i < numBytes; i++) {
    length = (length << 8) | data[offset + 1 + i];
  }
  return { length, nextOffset: offset + 1 + numBytes };
}

function parseASN1Element(data: Uint8Array, offset: number): { tag: number; contents: Uint8Array; fullBytes: Uint8Array; nextOffset: number } {
  const tag = data[offset];
  const { length, nextOffset: contentStart } = parseASN1Length(data, offset + 1);
  const contents = data.slice(contentStart, contentStart + length);
  const fullBytes = data.slice(offset, contentStart + length);
  return { tag, contents, fullBytes, nextOffset: contentStart + length };
}

function extractSPKIFromCert(certDer: Uint8Array): Uint8Array {
  // Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
  const cert = parseASN1Element(certDer, 0);
  // TBSCertificate is the first element inside the certificate SEQUENCE
  const tbs = parseASN1Element(cert.contents, 0);

  // Walk TBSCertificate fields:
  // [0] version (optional, context-specific tag 0xA0), serialNumber, sigAlg, issuer, validity, subject, subjectPublicKeyInfo
  let pos = 0;
  let fieldIndex = 0;
  const spkiIndex = 6; // subjectPublicKeyInfo is at index 6 (counting version as index 0)

  while (pos < tbs.contents.length) {
    const element = parseASN1Element(tbs.contents, pos);

    // If first element is context-specific [0] (version), it counts as field 0
    // If first element is NOT context-specific, version is absent — adjust target
    if (fieldIndex === 0 && (element.tag & 0xa0) !== 0xa0) {
      // No version field; subjectPublicKeyInfo is at field index 5 instead
      if (fieldIndex === spkiIndex - 1) {
        return element.fullBytes;
      }
    }

    if (fieldIndex === spkiIndex) {
      return element.fullBytes;
    }

    fieldIndex++;
    pos = element.nextOffset;
  }

  throw new Error('Could not find SubjectPublicKeyInfo in certificate');
}

// --- SNS String-to-Sign Builder ---

function buildStringToSign(message: Record<string, any>, messageType: string): string {
  const fields: string[] = [];
  if (messageType === 'Notification') {
    fields.push('Message', 'MessageId');
    if (message.Subject) fields.push('Subject');
    fields.push('Timestamp', 'TopicArn', 'Type');
  } else {
    fields.push('Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type');
  }
  let str = '';
  for (const field of fields) {
    if (message[field] !== undefined) {
      str += field + '\n' + message[field] + '\n';
    }
  }
  return str;
}

// --- SNS Signature Validation ---

function validateCertUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.match(/^sns\.[a-z0-9-]+\.amazonaws\.com$/)) return false;
    return true;
  } catch {
    return false;
  }
}

async function verifySnsSignature(message: Record<string, any>, messageType: string): Promise<boolean> {
  const certUrl = message.SigningCertURL;
  if (!certUrl || !validateCertUrl(certUrl)) {
    console.error('Invalid SigningCertURL:', certUrl);
    return false;
  }

  try {
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

    // Extract SPKI public key from the X.509 certificate
    const spkiDer = extractSPKIFromCert(certDer);

    const key = await crypto.subtle.importKey(
      'spki',
      spkiDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
      false,
      ['verify']
    );

    const stringToSign = buildStringToSign(message, messageType);
    const data = new TextEncoder().encode(stringToSign);
    const signature = Uint8Array.from(atob(message.Signature), c => c.charCodeAt(0));

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    return valid;
  } catch (e) {
    console.error('SNS signature verification error:', e);
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
