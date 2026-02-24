import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { resolveCredentials } from "./resolve-credentials.ts";

export interface AlertNotification {
  alertName: string;
  metric: string;
  threshold: number;
  currentValue?: number;
  severity: string;
  resourceId?: string;
  roleName?: string;
}

export interface DispatchResult {
  [channel: string]: { success: boolean; error?: string; messageId?: string };
}

/**
 * Dispatches alert notifications to all configured channels (email, slack, discord, webhook).
 * Uses service role client to decrypt webhook URLs.
 *
 * @param userId - The user to notify
 * @param userEmail - The user's email address
 * @param alert - The alert notification payload
 * @param roleName - Optional role name for STS AssumeRole when sending SES email
 */
export async function dispatchNotification(
  userId: string,
  userEmail: string | null,
  alert: AlertNotification,
  roleName?: string
): Promise<DispatchResult> {
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Get notification preferences
  const { data: preferences, error: prefError } = await serviceClient
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (prefError || !preferences) {
    console.error('Notification preferences not found for user:', userId);
    return {};
  }

  const decryptWebhook = async (encrypted: any, nonce: any): Promise<string | null> => {
    if (!encrypted || !nonce) return null;
    const { data, error } = await serviceClient.rpc('decrypt_secret', { encrypted_data: encrypted, nonce });
    if (error) { console.error('Decrypt error:', error); return null; }
    return data;
  };

  const slackWebhook = await decryptWebhook(preferences.encrypted_slack_webhook, preferences.webhook_nonce);
  const discordWebhook = await decryptWebhook(preferences.encrypted_discord_webhook, preferences.webhook_nonce);
  const webhookUrl = await decryptWebhook(preferences.encrypted_webhook_url, preferences.webhook_nonce);

  const results: DispatchResult = {};

  // Send Email via SES if enabled
  if (preferences.email_enabled && userEmail) {
    try {
      // Create a user-scoped client to call get_user_aws_credentials
      const { data: credentials } = await serviceClient
        .rpc('get_user_aws_credentials', { user_id_param: userId });

      if (credentials && credentials.length > 0) {
        const { access_key_id, secret_access_key, region } = credentials[0];

        // Need a user-scoped supabase client for resolveCredentials (it queries cloudhub_roles with RLS)
        // Since we're in service role context, create a minimal client
        const { credentials: awsCreds } = await resolveCredentials(
          serviceClient, userId, userEmail,
          { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
          region || 'us-east-1', roleName
        );

        const sesClient = new SESClient({
          region: region || 'us-east-1',
          credentials: awsCreds,
        });

        let senderEmail = Deno.env.get('SES_SENDER_EMAIL') || `noreply@cloudhub.app`;
        if (preferences.ses_sender_email) {
          senderEmail = preferences.ses_sender_email;
        }

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
                ${alert.currentValue != null ? `<tr><td style="padding: 8px 0; font-weight: bold;">Current Value:</td><td>${alert.currentValue}</td></tr>` : ''}
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
          Destination: { ToAddresses: [userEmail] },
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
            ...(alert.currentValue != null ? [{ title: 'Current Value', value: String(alert.currentValue), short: true }] : []),
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
            ...(alert.currentValue != null ? [{ name: 'Current Value', value: String(alert.currentValue), inline: true }] : []),
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

  return results;
}
