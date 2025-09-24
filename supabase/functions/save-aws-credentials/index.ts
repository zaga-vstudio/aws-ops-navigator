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

    const { accessKeyId, secretAccessKey } = await req.json();

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Access Key ID and Secret Access Key are required');
    }

    // Validate AWS credentials by making a simple API call
    console.log('Validating AWS credentials...');
    
    // Debug: Log partial credentials (masked for security)
    console.log('Access Key ID:', accessKeyId ? `${accessKeyId.substring(0, 4)}***${accessKeyId.substring(accessKeyId.length - 4)}` : 'undefined');
    console.log('Secret Access Key:', secretAccessKey ? `${secretAccessKey.substring(0, 4)}***` : 'undefined');
    
    // Import AWS STS SDK components using npm: prefix for Deno compatibility
    const { STSClient, GetCallerIdentityCommand } = await import('npm:@aws-sdk/client-sts');
    
    const stsClient = new STSClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    try {
      // Test the credentials with STS GetCallerIdentity (lowest cost, most reliable test)
      const result = await stsClient.send(new GetCallerIdentityCommand({}));
      console.log('AWS credentials validated successfully. Account:', result.Account, 'User:', result.Arn);
    } catch (awsError: any) {
      console.error('AWS credential validation failed:', awsError);
      console.error('AWS Error Code:', awsError.name || awsError.code);
      console.error('AWS Error Message:', awsError.message);
      
      // Return specific AWS error codes for better frontend handling
      const errorCode = awsError.name || awsError.code || 'UnknownError';
      const errorMessage = awsError.message || 'Invalid AWS credentials. Please check your Access Key ID and Secret Access Key.';
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        errorCode: errorCode 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If validation successful, encrypt and store the credentials
    // Note: In a production environment, you would want to use proper encryption
    // For this demo, we'll store them directly (Supabase handles basic encryption at rest)
    
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

    if (existingConfig) {
      // Update existing credentials
      const { error: updateError } = await supabase
        .from('user_aws_credentials')
        .update({
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating AWS credentials:', updateError);
        throw updateError;
      }
    } else {
      // Create new credentials
      const { error: insertError } = await supabase
        .from('user_aws_credentials')
        .insert({
          user_id: user.id,
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
          region: 'us-east-1',
        });

      if (insertError) {
        console.error('Error inserting AWS credentials:', insertError);
        throw insertError;
      }
    }

    console.log('AWS credentials saved successfully for user:', user.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in save-aws-credentials function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});