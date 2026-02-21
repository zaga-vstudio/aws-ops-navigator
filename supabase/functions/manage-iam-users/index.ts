import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { IAMClient, CreateUserCommand, DeleteUserCommand, CreateAccessKeyCommand, DeleteAccessKeyCommand, UpdateAccessKeyCommand, ListAccessKeysCommand } from "npm:@aws-sdk/client-iam@3.451.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IAMUserRequest {
  action: 'create' | 'delete' | 'rotate_key' | 'disable_key';
  userName?: string;
  accessKeyId?: string;
  reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestData: IAMUserRequest = await req.json();
    console.log('IAM user management request:', requestData);

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabase.rpc('get_user_aws_credentials', {
      user_id_param: user.id
    });

    if (credError || !credentials || credentials.length === 0) {
      console.error('Error fetching credentials:', credError);
      return new Response(JSON.stringify({ error: 'AWS credentials not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = credentials[0];
    const iamClient = new IAMClient({
      region: 'us-east-1', // IAM is global
      credentials: {
        accessKeyId: creds.access_key_id,
        secretAccessKey: creds.secret_access_key,
      },
    });

    // Determine change type
    let changeType: 'iam_user_create' | 'iam_user_delete' | 'iam_key_rotation';
    if (requestData.action === 'create') {
      changeType = 'iam_user_create';
    } else if (requestData.action === 'delete') {
      changeType = 'iam_user_delete';
    } else {
      changeType = 'iam_key_rotation';
    }

    // Create approval request
    const { data: approval, error: approvalError } = await supabase
      .from('security_change_approvals')
      .insert({
        user_id: user.id,
        change_type: changeType,
        change_details: requestData,
        reason: requestData.reason,
        status: 'pending'
      })
      .select()
      .single();

    if (approvalError) {
      console.error('Error creating approval:', approvalError);
      return new Response(JSON.stringify({ error: 'Failed to create approval request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-approve and execute
    try {
      let result: any;

      switch (requestData.action) {
        case 'create':
          if (!requestData.userName) {
            throw new Error('Username is required for create action');
          }
          const createCommand = new CreateUserCommand({
            UserName: requestData.userName,
          });
          result = await iamClient.send(createCommand);
          console.log('Created IAM user:', result);
          break;

        case 'delete':
          if (!requestData.userName) {
            throw new Error('Username is required for delete action');
          }
          // First, list and delete all access keys
          const listKeysCommand = new ListAccessKeysCommand({
            UserName: requestData.userName,
          });
          const keysResponse = await iamClient.send(listKeysCommand);
          
          for (const key of keysResponse.AccessKeyMetadata || []) {
            await iamClient.send(new DeleteAccessKeyCommand({
              UserName: requestData.userName,
              AccessKeyId: key.AccessKeyId,
            }));
          }

          const deleteCommand = new DeleteUserCommand({
            UserName: requestData.userName,
          });
          result = await iamClient.send(deleteCommand);
          console.log('Deleted IAM user:', result);
          break;

        case 'rotate_key':
          if (!requestData.userName || !requestData.accessKeyId) {
            throw new Error('Username and AccessKeyId are required for key rotation');
          }
          // Create new key
          const newKeyCommand = new CreateAccessKeyCommand({
            UserName: requestData.userName,
          });
          const newKey = await iamClient.send(newKeyCommand);
          
          // Delete old key
          const deleteKeyCommand = new DeleteAccessKeyCommand({
            UserName: requestData.userName,
            AccessKeyId: requestData.accessKeyId,
          });
          await iamClient.send(deleteKeyCommand);
          
          result = { newAccessKey: newKey.AccessKey, oldKeyDeleted: true };
          console.log('Rotated access key for user');
          break;

        case 'disable_key':
          if (!requestData.userName || !requestData.accessKeyId) {
            throw new Error('Username and AccessKeyId are required for disabling key');
          }
          const disableKeyCommand = new UpdateAccessKeyCommand({
            UserName: requestData.userName,
            AccessKeyId: requestData.accessKeyId,
            Status: 'Inactive',
          });
          result = await iamClient.send(disableKeyCommand);
          console.log('Disabled access key');
          break;
      }

      // Update approval status
      await supabase
        .from('security_change_approvals')
        .update({
          status: 'executed',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          executed_at: new Date().toISOString(),
          execution_result: { success: true, result }
        })
        .eq('id', approval.id);

      // Send notifications
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (notifPrefs?.encrypted_webhook_url && notifPrefs?.webhook_nonce) {
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        const { data: decryptedUrl } = await serviceClient.rpc('decrypt_secret', { 
          encrypted_data: notifPrefs.encrypted_webhook_url, nonce: notifPrefs.webhook_nonce 
        });
        if (decryptedUrl) {
          fetch(decryptedUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'iam_user_modified',
              action: requestData.action,
              userName: requestData.userName,
              timestamp: new Date().toISOString()
            })
          }).catch(err => console.error('Notification webhook failed:', err));
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        approvalId: approval.id,
        message: `IAM ${requestData.action} completed successfully`,
        result
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Error executing IAM operation:', error);

      await supabase
        .from('security_change_approvals')
        .update({
          status: 'failed',
          execution_result: { success: false, error: error.message }
        })
        .eq('id', approval.id);

      return new Response(JSON.stringify({ 
        error: 'Failed to execute IAM operation', 
        details: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
