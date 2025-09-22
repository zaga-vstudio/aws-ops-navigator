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
    
    // Import AWS SDK components
    const { S3Client, ListBucketsCommand } = await import('https://esm.sh/@aws-sdk/client-s3@3.451.0');
    
    const s3Client = new S3Client({
      region: 'us-east-1', // Use a default region for validation
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    try {
      // Test the credentials with a simple API call
      await s3Client.send(new ListBucketsCommand({}));
      console.log('AWS credentials validated successfully');
    } catch (awsError) {
      console.error('AWS credential validation failed:', awsError);
      throw new Error('Invalid AWS credentials. Please check your Access Key ID and Secret Access Key.');
    }

    // If validation successful, encrypt and store the credentials
    // Note: In a production environment, you would want to use proper encryption
    // For this demo, we'll store them directly (Supabase handles basic encryption at rest)
    
    // Check if user already has AWS configuration
    const { data: existingConfig, error: selectError } = await supabase
      .from('aws_configurations')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking existing config:', selectError);
      throw selectError;
    }

    if (existingConfig) {
      // Update existing configuration
      const { error: updateError } = await supabase
        .from('aws_configurations')
        .update({
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating AWS config:', updateError);
        throw updateError;
      }
    } else {
      // Create new configuration
      const { error: insertError } = await supabase
        .from('aws_configurations')
        .insert({
          user_id: user.id,
          access_key_id: accessKeyId,
          secret_access_key: secretAccessKey,
          aws_region: 'us-east-1',
          configuration_name: 'Default',
        });

      if (insertError) {
        console.error('Error inserting AWS config:', insertError);
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