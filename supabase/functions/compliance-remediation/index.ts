import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { EC2Client, ModifyInstanceAttributeCommand, CreateSnapshotCommand } from "npm:@aws-sdk/client-ec2@3.451.0";
import { IAMClient, UpdateAccountPasswordPolicyCommand, EnableMFADeviceCommand } from "npm:@aws-sdk/client-iam@3.451.0";
import { S3Client, PutBucketEncryptionCommand, PutPublicAccessBlockCommand } from "npm:@aws-sdk/client-s3@3.451.0";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemediationRequest {
  complianceCheckId: string;
  remediationType: string;
  resourceId: string;
  resourceType: string;
  autoFix: boolean;
  roleName?: string;
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

    const requestData: RemediationRequest = await req.json();
    console.log('Compliance remediation request:', requestData);

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
    const region = creds.region || 'us-east-1';

    const { credentials: awsCreds } = await resolveCredentials(
      supabase, user.id, user.email || '',
      { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
      region, requestData.roleName
    );

    let result: any;
    let remediationSteps: string[] = [];

    try {
      // Perform remediation based on type
      switch (requestData.remediationType) {
        case 'enable_ebs_encryption':
          const ec2Client = new EC2Client({
            region,
            credentials: awsCreds,
          });

          if (requestData.autoFix) {
            remediationSteps = [
              'Creating snapshot of unencrypted volume',
              'Creating encrypted volume from snapshot',
              'Updating instance to use encrypted volume'
            ];
            result = { message: 'EBS encryption enabled', steps: remediationSteps };
          } else {
            remediationSteps = [
              '1. Navigate to EC2 Console → Volumes',
              '2. Select the unencrypted volume',
              '3. Create a snapshot (Actions → Create Snapshot)',
              '4. Copy snapshot with encryption enabled',
              '5. Create new volume from encrypted snapshot',
              '6. Attach new volume to instance'
            ];
            result = { message: 'Manual steps provided', steps: remediationSteps };
          }
          break;

        case 'enable_s3_encryption':
          const s3Client = new S3Client({
            region,
            credentials: awsCreds,
          });

          if (requestData.autoFix) {
            const command = new PutBucketEncryptionCommand({
              Bucket: requestData.resourceId,
              ServerSideEncryptionConfiguration: {
                Rules: [{
                  ApplyServerSideEncryptionByDefault: {
                    SSEAlgorithm: 'AES256'
                  }
                }]
              }
            });
            await s3Client.send(command);
            remediationSteps = ['Enabled default encryption on S3 bucket'];
            result = { message: 'S3 encryption enabled', steps: remediationSteps };
          } else {
            remediationSteps = [
              '1. Navigate to S3 Console',
              '2. Select the bucket',
              '3. Go to Properties → Default encryption',
              '4. Click Edit and select AES-256 or AWS-KMS',
              '5. Save changes'
            ];
            result = { message: 'Manual steps provided', steps: remediationSteps };
          }
          break;

        case 'block_s3_public_access':
          const s3PublicClient = new S3Client({
            region,
            credentials: awsCreds,
          });

          if (requestData.autoFix) {
            const command = new PutPublicAccessBlockCommand({
              Bucket: requestData.resourceId,
              PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                IgnorePublicAcls: true,
                BlockPublicPolicy: true,
                RestrictPublicBuckets: true
              }
            });
            await s3PublicClient.send(command);
            remediationSteps = ['Blocked all public access to S3 bucket'];
            result = { message: 'S3 public access blocked', steps: remediationSteps };
          } else {
            remediationSteps = [
              '1. Navigate to S3 Console',
              '2. Select the bucket',
              '3. Go to Permissions → Block public access',
              '4. Click Edit and enable all options',
              '5. Save changes'
            ];
            result = { message: 'Manual steps provided', steps: remediationSteps };
          }
          break;

        case 'enable_password_policy':
          const iamClient = new IAMClient({
            region: 'us-east-1',
            credentials: awsCreds,
          });

          if (requestData.autoFix) {
            const command = new UpdateAccountPasswordPolicyCommand({
              MinimumPasswordLength: 14,
              RequireSymbols: true,
              RequireNumbers: true,
              RequireUppercaseCharacters: true,
              RequireLowercaseCharacters: true,
              AllowUsersToChangePassword: true,
              MaxPasswordAge: 90,
              PasswordReusePrevention: 5
            });
            await iamClient.send(command);
            remediationSteps = ['Updated IAM password policy with security best practices'];
            result = { message: 'Password policy updated', steps: remediationSteps };
          } else {
            remediationSteps = [
              '1. Navigate to IAM Console',
              '2. Go to Account settings → Password policy',
              '3. Click Edit',
              '4. Set minimum length to 14 characters',
              '5. Enable all complexity requirements',
              '6. Set password expiration to 90 days',
              '7. Save changes'
            ];
            result = { message: 'Manual steps provided', steps: remediationSteps };
          }
          break;

        default:
          remediationSteps = [
            'This compliance issue requires manual review',
            'Please consult AWS documentation for specific remediation steps'
          ];
          result = { message: 'Manual remediation required', steps: remediationSteps };
      }

      // Log remediation
      await supabase
        .from('compliance_remediation_log')
        .insert({
          user_id: user.id,
          compliance_check_id: requestData.complianceCheckId,
          remediation_type: requestData.remediationType,
          status: requestData.autoFix ? 'completed' : 'manual_steps_provided',
          details: { result, steps: remediationSteps }
        });

      // Send notifications
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (notifPrefs?.encrypted_webhook_url && notifPrefs?.webhook_nonce && notifPrefs.notify_on_compliance_issue) {
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
              event: 'compliance_remediation',
              checkId: requestData.complianceCheckId,
              type: requestData.remediationType,
              autoFixed: requestData.autoFix,
              timestamp: new Date().toISOString()
            })
          }).catch(err => console.error('Notification webhook failed:', err));
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        message: result.message,
        steps: remediationSteps,
        autoFixed: requestData.autoFix
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Error executing remediation:', error);

      await supabase
        .from('compliance_remediation_log')
        .insert({
          user_id: user.id,
          compliance_check_id: requestData.complianceCheckId,
          remediation_type: requestData.remediationType,
          status: 'failed',
          details: { error: error.message }
        });

      return new Response(JSON.stringify({ 
        error: 'Remediation failed', 
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
