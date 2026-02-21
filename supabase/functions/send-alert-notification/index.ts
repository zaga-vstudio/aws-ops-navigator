import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertNotification {
  alertName: string;
  metric: string;
  threshold: number;
  currentValue?: number;
  severity: string;
  resourceId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const alert: AlertNotification = await req.json();
    console.log('Processing alert notification:', alert);

    // Get notification preferences
    const { data: preferences, error: prefError } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (prefError || !preferences) {
      throw new Error('Notification preferences not found');
    }

    // Decrypt webhook URLs using service role client
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const decryptWebhook = async (encrypted: any, nonce: any): Promise<string | null> => {
      if (!encrypted || !nonce) return null;
      const { data, error } = await serviceClient.rpc('decrypt_secret', { encrypted_data: encrypted, nonce });
      if (error) { console.error('Decrypt error:', error); return null; }
      return data;
    };

    const slackWebhook = await decryptWebhook(preferences.encrypted_slack_webhook, preferences.webhook_nonce);
    const discordWebhook = await decryptWebhook(preferences.encrypted_discord_webhook, preferences.webhook_nonce);
    const webhookUrl = await decryptWebhook(preferences.encrypted_webhook_url, preferences.webhook_nonce);

    const results: Record<string, any> = {};

    // Send Email via SES if enabled
    if (preferences.email_enabled && user.email) {
      try {
        const { data: credentials } = await supabaseClient
          .rpc('get_user_aws_credentials', { user_id_param: user.id });

        if (credentials && credentials.length > 0) {
          const { access_key_id, secret_access_key, region } = credentials[0];
          
          const sesClient = new SESClient({
            region: region || 'us-east-1',
            credentials: {
              accessKeyId: access_key_id,
              secretAccessKey: secret_access_key,
            },
          });

          const senderEmail = Deno.env.get('SES_SENDER_EMAIL') || `noreply@cloudhub.app`;
          const severityColor = alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';

          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">⚠️ CloudHub Alert: ${alert.alertName}</h1>
              </div>
              <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; font-weight: bold;">Metric:</td><td>${alert.metric}</td></tr>
                  <tr><td style="padding: 8px 0; font-weight: bold;">Threshold:</td><td>${alert.threshold}</td></tr>
                  ${alert.currentValue ? `<tr><td style="padding: 8px 0; font-weight: bold;">Current Value:</td><td>${alert.currentValue}</td></tr>` : ''}
                  <tr><td style="padding: 8px 0; font-weight: bold;">Severity:</td><td style="color: ${severityColor}; font-weight: bold;">${alert.severity.toUpperCase()}</td></tr>
                  ${alert.resourceId ? `<tr><td style="padding: 8px 0; font-weight: bold;">Resource:</td><td>${alert.resourceId}</td></tr>` : ''}
                </table>
                <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
                  This alert was triggered by CloudHub monitoring. Log in to your dashboard for more details.
                </p>
              </div>
            </div>
          `;

          const command = new SendEmailCommand({
            Source: senderEmail,
            Destination: { ToAddresses: [user.email] },
            Message: {
              Subject: { Data: `[${alert.severity.toUpperCase()}] ${alert.alertName}`, Charset: 'UTF-8' },
              Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
            },
          });

          const result = await sesClient.send(command);
          results.email = { success: true, messageId: result.MessageId };
          console.log('Email sent:', result.MessageId);
        }
      } catch (e) {
        console.error('Email send failed:', e);
        results.email = { success: false, error: e.message };
      }
    }

    // Send Slack notification if configured
    if (slackWebhook) {
      try {
        const slackPayload = {
          text: `🚨 *CloudHub Alert: ${alert.alertName}*`,
          attachments: [{
            color: alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good',
            fields: [
              { title: 'Metric', value: alert.metric, short: true },
              { title: 'Threshold', value: String(alert.threshold), short: true },
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
              ...(alert.currentValue ? [{ title: 'Current Value', value: String(alert.currentValue), short: true }] : []),
            ],
          }],
        };

        const slackRes = await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        });

        results.slack = { success: slackRes.ok };
        console.log('Slack notification sent:', slackRes.ok);
      } catch (e) {
        console.error('Slack send failed:', e);
        results.slack = { success: false, error: e.message };
      }
    }

    // Send Discord notification if configured
    if (discordWebhook) {
      try {
        const discordPayload = {
          embeds: [{
            title: `⚠️ CloudHub Alert: ${alert.alertName}`,
            color: alert.severity === 'critical' ? 0xdc2626 : alert.severity === 'warning' ? 0xf59e0b : 0x3b82f6,
            fields: [
              { name: 'Metric', value: alert.metric, inline: true },
              { name: 'Threshold', value: String(alert.threshold), inline: true },
              { name: 'Severity', value: alert.severity.toUpperCase(), inline: true },
              ...(alert.currentValue ? [{ name: 'Current Value', value: String(alert.currentValue), inline: true }] : []),
            ],
            timestamp: new Date().toISOString(),
          }],
        };

        const discordRes = await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
        });

        results.discord = { success: discordRes.ok };
        console.log('Discord notification sent:', discordRes.ok);
      } catch (e) {
        console.error('Discord send failed:', e);
        results.discord = { success: false, error: e.message };
      }
    }

    // Send custom webhook if configured
    if (webhookUrl) {
      try {
        const webhookRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'alert', alert, timestamp: new Date().toISOString() }),
        });

        results.webhook = { success: webhookRes.ok };
        console.log('Webhook notification sent:', webhookRes.ok);
      } catch (e) {
        console.error('Webhook send failed:', e);
        results.webhook = { success: false, error: e.message };
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending alert notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
