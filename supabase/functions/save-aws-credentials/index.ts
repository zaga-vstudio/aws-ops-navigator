import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the user from the request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { accessKeyId, secretAccessKey, region } = await req.json();

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Access Key ID and Secret Access Key are required');
    }

    console.log('Received AWS credentials for user:', user.id);
    console.log('Access Key ID:', accessKeyId ? `${accessKeyId.substring(0, 4)}***${accessKeyId.substring(accessKeyId.length - 4)}` : 'undefined');
    console.log('Region:', region || 'us-east-1');

    // IMPORTANT: We do NOT call AWS STS here because the Node credential
    // provider chain tries to access the local filesystem (fs.readFile),
    // which is not supported in Supabase Edge Functions (Deno).
    //
    // Instead, we:
    // - Validate presence/format on the client
    // - Store the credentials encrypted in the database
    // - Let the aws-dashboard-data function surface any AWS auth errors
    console.log('Skipping live AWS validation in save-aws-credentials; proceeding to encrypt & store.');

    // Check if user already has AWS credentials
    const { data: existingConfig, error: selectError } = await supabase
      .from('user_aws_credentials')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking existing config:', selectError);
      throw selectError;
    }

    // Encrypt the credentials using the database function
    console.log('Encrypting AWS Access Key ID...');
    const { data: encryptedAccessKey, error: encryptAccessKeyError } = await supabase
      .rpc('encrypt_secret', { secret: accessKeyId });

    if (encryptAccessKeyError) {
      console.error('Error encrypting access key:', encryptAccessKeyError);
      throw new Error('Failed to encrypt credentials');
    }

    console.log('Encrypting AWS Secret Access Key...');
    const { data: encryptedSecretKey, error: encryptSecretKeyError } = await supabase
      .rpc('encrypt_secret', { secret: secretAccessKey });

    if (encryptSecretKeyError) {
      console.error('Error encrypting secret key:', encryptSecretKeyError);
      throw new Error('Failed to encrypt credentials');
    }

    const finalRegion = region || 'us-east-1';

    if (existingConfig) {
      // Update existing credentials with ONLY encrypted values
      const { error: updateError } = await supabase
        .from('user_aws_credentials')
        .update({
          encrypted_access_key: encryptedAccessKey,
          encrypted_secret_key: encryptedSecretKey,
          region: finalRegion,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating AWS credentials:', updateError);
        throw updateError;
      }
    } else {
      // Create new credentials with ONLY encrypted values
      const { error: insertError } = await supabase
        .from('user_aws_credentials')
        .insert({
          user_id: user.id,
          encrypted_access_key: encryptedAccessKey,
          encrypted_secret_key: encryptedSecretKey,
          region: finalRegion,
          is_active: true,
        });

      if (insertError) {
        console.error('Error inserting AWS credentials:', insertError);
        throw insertError;
      }
    }

    console.log('AWS credentials encrypted and stored successfully for user:', user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in save-aws-credentials function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
