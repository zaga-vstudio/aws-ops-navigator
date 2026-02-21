import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
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

    const { to, subject, htmlBody, textBody }: EmailRequest = await req.json();
    
    if (!to || !subject || !htmlBody) {
      throw new Error('Missing required fields: to, subject, htmlBody');
    }

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      throw new Error('AWS credentials not configured');
    }

    const { access_key_id, secret_access_key, region } = credentials[0];
    
    const sesClient = new SESClient({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId: access_key_id,
        secretAccessKey: secret_access_key,
      },
    });

    // Get per-user sender email from notification_preferences, then fallback to env var
    let senderEmail = Deno.env.get('SES_SENDER_EMAIL') || `noreply@${region}.amazonses.com`;
    const { data: prefs } = await supabaseClient
      .from('notification_preferences')
      .select('ses_sender_email')
      .eq('user_id', user.id)
      .single();
    if (prefs?.ses_sender_email) {
      senderEmail = prefs.ses_sender_email;
    }

    const command = new SendEmailCommand({
      Source: senderEmail,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    const result = await sesClient.send(command);
    console.log('Email sent successfully:', result.MessageId);

    return new Response(
      JSON.stringify({ success: true, messageId: result.MessageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
