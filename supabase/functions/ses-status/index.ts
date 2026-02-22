import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, GetAccountCommand, ListIdentitiesCommand, GetIdentityVerificationAttributesCommand } from "npm:@aws-sdk/client-ses";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    // Parse body for roleName (POST) or use no role (GET)
    let roleName: string | undefined;
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        roleName = body.roleName;
      }
    } catch { /* no body */ }

    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: userId });

    if (credError || !credentials || credentials.length === 0) {
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_key_id, secret_access_key, region } = credentials[0];

    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, userId, '',
      { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
      region || 'us-east-1', roleName
    );

    const sesClient = new SESClient({
      region: region || 'us-east-1',
      credentials: awsCreds,
    });

    // Fetch account info and identities in parallel
    const [accountResult, identitiesResult] = await Promise.all([
      sesClient.send(new GetAccountCommand({})).catch(err => {
        console.error('GetAccount error:', err);
        return null;
      }),
      sesClient.send(new ListIdentitiesCommand({ MaxItems: 100 })).catch(err => {
        console.error('ListIdentities error:', err);
        return null;
      }),
    ]);

    let sandboxMode = true;
    let sendingLimits = { max24HourSend: 0, maxSendRate: 0, sentLast24Hours: 0 };

    if (accountResult) {
      const max24 = accountResult.MaxSendRate ?? 0;
      const max24Hour = accountResult.Max24HourSend ?? 200;
      sendingLimits = {
        max24HourSend: max24Hour,
        maxSendRate: max24,
        sentLast24Hours: accountResult.SentLast24Hours ?? 0,
      };
      sandboxMode = max24Hour <= 200;
    }

    let verifiedIdentities: { identity: string; status: string }[] = [];
    if (identitiesResult?.Identities && identitiesResult.Identities.length > 0) {
      const verificationResult = await sesClient.send(
        new GetIdentityVerificationAttributesCommand({
          Identities: identitiesResult.Identities,
        })
      );

      verifiedIdentities = identitiesResult.Identities.map(identity => ({
        identity,
        status: verificationResult.VerificationAttributes?.[identity]?.VerificationStatus ?? 'NotStarted',
      }));
    }

    const { data: prefs } = await supabaseClient
      .from('notification_preferences')
      .select('ses_sender_email')
      .eq('user_id', userId)
      .single();

    return new Response(
      JSON.stringify({
        sandboxMode,
        verifiedIdentities,
        sendingLimits,
        currentSenderEmail: prefs?.ses_sender_email || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking SES status:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check SES status. Please verify your AWS credentials.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
