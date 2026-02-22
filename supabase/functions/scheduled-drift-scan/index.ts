import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { EC2Client, DescribeInstancesCommand, DescribeSecurityGroupsCommand, DescribeVpcsCommand } from "npm:@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "npm:@aws-sdk/client-rds";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AWSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  sessionToken?: string;
}

// Simple hash function for configuration comparison
function hashConfig(config: any): string {
  const str = JSON.stringify(config, Object.keys(config).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Compare two configs and return differences
function findChanges(previous: any, current: any, path = ''): any[] {
  const changes: any[] = [];
  
  const allKeys = new Set([...Object.keys(previous || {}), ...Object.keys(current || {})]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const prevVal = previous?.[key];
    const currVal = current?.[key];
    
    if (typeof prevVal === 'object' && typeof currVal === 'object' && prevVal !== null && currVal !== null) {
      if (Array.isArray(prevVal) && Array.isArray(currVal)) {
        if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
          changes.push({ field: currentPath, previous: prevVal, current: currVal });
        }
      } else {
        changes.push(...findChanges(prevVal, currVal, currentPath));
      }
    } else if (prevVal !== currVal) {
      changes.push({ field: currentPath, previous: prevVal, current: currVal });
    }
  }
  
  return changes;
}

// Determine severity based on what changed
function determineSeverity(resourceType: string, changes: any[]): string {
  const criticalFields = ['securityGroups', 'ingressRules', 'egressRules', 'publiclyAccessible', 'iamInstanceProfile'];
  const warningFields = ['instanceType', 'vpcId', 'subnetId', 'engine', 'engineVersion'];
  
  for (const change of changes) {
    if (criticalFields.some(f => change.field.toLowerCase().includes(f.toLowerCase()))) {
      return 'critical';
    }
  }
  
  for (const change of changes) {
    if (warningFields.some(f => change.field.toLowerCase().includes(f.toLowerCase()))) {
      return 'warning';
    }
  }
  
  return 'info';
}

async function getEC2Resources(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeInstancesCommand({}));
  
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const nameTag = instance.Tags?.find(t => t.Key === 'Name');
      resources.push({
        resourceType: 'ec2',
        resourceId: instance.InstanceId,
        resourceName: nameTag?.Value || instance.InstanceId,
        configuration: {
          instanceType: instance.InstanceType,
          state: instance.State?.Name,
          vpcId: instance.VpcId,
          subnetId: instance.SubnetId,
          securityGroups: instance.SecurityGroups?.map(sg => sg.GroupId),
          publicIp: instance.PublicIpAddress,
          privateIp: instance.PrivateIpAddress,
          iamInstanceProfile: instance.IamInstanceProfile?.Arn,
          ebsOptimized: instance.EbsOptimized,
          monitoring: instance.Monitoring?.State,
        }
      });
    }
  }
  
  return resources;
}

async function getSecurityGroups(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeSecurityGroupsCommand({}));
  
  for (const sg of response.SecurityGroups || []) {
    resources.push({
      resourceType: 'security_group',
      resourceId: sg.GroupId,
      resourceName: sg.GroupName,
      configuration: {
        groupName: sg.GroupName,
        description: sg.Description,
        vpcId: sg.VpcId,
        ingressRules: sg.IpPermissions?.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          ipRanges: rule.IpRanges?.map(r => r.CidrIp),
          securityGroups: rule.UserIdGroupPairs?.map(g => g.GroupId),
        })),
        egressRules: sg.IpPermissionsEgress?.map(rule => ({
          protocol: rule.IpProtocol,
          fromPort: rule.FromPort,
          toPort: rule.ToPort,
          ipRanges: rule.IpRanges?.map(r => r.CidrIp),
          securityGroups: rule.UserIdGroupPairs?.map(g => g.GroupId),
        })),
      }
    });
  }
  
  return resources;
}

async function getRDSResources(rdsClient: RDSClient): Promise<any[]> {
  const resources: any[] = [];
  const response = await rdsClient.send(new DescribeDBInstancesCommand({}));
  
  for (const db of response.DBInstances || []) {
    resources.push({
      resourceType: 'rds',
      resourceId: db.DBInstanceIdentifier,
      resourceName: db.DBInstanceIdentifier,
      configuration: {
        engine: db.Engine,
        engineVersion: db.EngineVersion,
        instanceClass: db.DBInstanceClass,
        allocatedStorage: db.AllocatedStorage,
        publiclyAccessible: db.PubliclyAccessible,
        multiAz: db.MultiAZ,
        vpcSecurityGroups: db.VpcSecurityGroups?.map(sg => sg.VpcSecurityGroupId),
        storageEncrypted: db.StorageEncrypted,
        autoMinorVersionUpgrade: db.AutoMinorVersionUpgrade,
        deletionProtection: db.DeletionProtection,
      }
    });
  }
  
  return resources;
}

async function getVPCResources(ec2Client: EC2Client): Promise<any[]> {
  const resources: any[] = [];
  const response = await ec2Client.send(new DescribeVpcsCommand({}));
  
  for (const vpc of response.Vpcs || []) {
    const nameTag = vpc.Tags?.find(t => t.Key === 'Name');
    resources.push({
      resourceType: 'vpc',
      resourceId: vpc.VpcId,
      resourceName: nameTag?.Value || vpc.VpcId,
      configuration: {
        cidrBlock: vpc.CidrBlock,
        isDefault: vpc.IsDefault,
        state: vpc.State,
        enableDnsHostnames: vpc.Tags?.find(t => t.Key === 'EnableDnsHostnames')?.Value,
        enableDnsSupport: vpc.Tags?.find(t => t.Key === 'EnableDnsSupport')?.Value,
      }
    });
  }
  
  return resources;
}

async function sendDriftNotifications(
  supabase: any, 
  userId: string, 
  userEmail: string,
  preferences: any, 
  driftEvents: any[], 
  awsConfig: AWSConfig
) {
  const results: Record<string, any> = {};
  
  const criticalDrifts = driftEvents.filter(d => d.severity === 'critical');
  const warningDrifts = driftEvents.filter(d => d.severity === 'warning');
  
  const summaryText = `${driftEvents.length} drift event(s) detected: ${criticalDrifts.length} critical, ${warningDrifts.length} warning`;
  
  // Send Email via SES if enabled
  if (preferences.email_enabled && userEmail) {
    try {
      const sesClient = new SESClient({
        region: awsConfig.region || 'us-east-1',
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
          ...(awsConfig.sessionToken && { sessionToken: awsConfig.sessionToken }),
        },
      });

      const senderEmail = Deno.env.get('SES_SENDER_EMAIL') || `noreply@cloudhub.app`;
      const severityColor = criticalDrifts.length > 0 ? '#dc2626' : warningDrifts.length > 0 ? '#f59e0b' : '#3b82f6';

      const driftListHtml = driftEvents.slice(0, 10).map(d => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.resource_name || d.resource_id}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.resource_type}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: ${d.severity === 'critical' ? '#dc2626' : d.severity === 'warning' ? '#f59e0b' : '#3b82f6'}; font-weight: bold;">${d.severity.toUpperCase()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${d.changes?.length || 0} change(s)</td>
        </tr>
      `).join('');

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">🔄 CloudHub Drift Detection Alert</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; margin-bottom: 20px;">${summaryText}</p>
            <p style="color: #6b7280; margin-bottom: 15px;">Resources were modified outside of CloudHub (e.g., via AWS Console):</p>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 4px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Resource</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Type</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Severity</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Changes</th>
                </tr>
              </thead>
              <tbody>
                ${driftListHtml}
              </tbody>
            </table>
            ${driftEvents.length > 10 ? `<p style="color: #6b7280; margin-top: 10px;">... and ${driftEvents.length - 10} more</p>` : ''}
            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
              Log in to CloudHub to review and resolve these drift events.
            </p>
          </div>
        </div>
      `;

      const command = new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: [userEmail] },
        Message: {
          Subject: { Data: `[Drift Alert] ${summaryText}`, Charset: 'UTF-8' },
          Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
        },
      });

      const result = await sesClient.send(command);
      results.email = { success: true, messageId: result.MessageId };
      console.log('Drift email sent:', result.MessageId);
    } catch (e) {
      console.error('Email send failed:', e);
      results.email = { success: false, error: e.message };
    }
  }

  // Decrypt webhook URLs
  const decryptWebhook = async (encrypted: any, nonce: any): Promise<string | null> => {
    if (!encrypted || !nonce) return null;
    const { data, error } = await supabase.rpc('decrypt_secret', { encrypted_data: encrypted, nonce });
    if (error) { console.error('Decrypt error:', error); return null; }
    return data;
  };

  const slackWebhook = await decryptWebhook(preferences.encrypted_slack_webhook, preferences.webhook_nonce);
  const discordWebhook = await decryptWebhook(preferences.encrypted_discord_webhook, preferences.webhook_nonce);
  const webhookUrl = await decryptWebhook(preferences.encrypted_webhook_url, preferences.webhook_nonce);

  if (slackWebhook) {
    try {
      const slackPayload = {
        text: `🔄 *CloudHub Drift Alert*`,
        attachments: [{
          color: criticalDrifts.length > 0 ? 'danger' : warningDrifts.length > 0 ? 'warning' : 'good',
          text: summaryText,
          fields: driftEvents.slice(0, 5).map(d => ({
            title: d.resource_name || d.resource_id,
            value: `${d.resource_type} - ${d.severity.toUpperCase()} - ${d.changes?.length || 0} change(s)`,
            short: true,
          })),
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

  if (discordWebhook) {
    try {
      const discordPayload = {
        embeds: [{
          title: `🔄 CloudHub Drift Alert`,
          description: summaryText,
          color: criticalDrifts.length > 0 ? 0xdc2626 : warningDrifts.length > 0 ? 0xf59e0b : 0x3b82f6,
          fields: driftEvents.slice(0, 5).map(d => ({
            name: d.resource_name || d.resource_id,
            value: `${d.resource_type} - ${d.severity.toUpperCase()}`,
            inline: true,
          })),
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

  if (webhookUrl) {
    try {
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'drift_alert', 
          summary: summaryText,
          driftEvents: driftEvents.slice(0, 20),
          timestamp: new Date().toISOString() 
        }),
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

async function scanUserForDrift(supabase: any, userId: string, userEmail: string, preferences: any, roleName?: string) {
  console.log(`Scanning drift for user ${userId}`);
  
  // Get AWS credentials
  const { data: creds, error: credsError } = await supabase.rpc('get_user_aws_credentials', { user_id_param: userId });
  if (credsError || !creds || creds.length === 0) {
    console.log(`No AWS credentials for user ${userId}`);
    return { success: false, error: 'No AWS credentials' };
  }

  const region = creds[0].region || 'us-east-1';

  const { credentials: awsCreds } = await resolveCredentials(
    supabase, userId, userEmail,
    { accessKeyId: creds[0].access_key_id, secretAccessKey: creds[0].secret_access_key },
    region, roleName
  );

  const awsConfig: AWSConfig = {
    accessKeyId: awsCreds.accessKeyId,
    secretAccessKey: awsCreds.secretAccessKey,
    region,
    sessionToken: awsCreds.sessionToken,
  };

  const clientConfig = {
    region: awsConfig.region,
    credentials: {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey,
      ...(awsConfig.sessionToken && { sessionToken: awsConfig.sessionToken }),
    }
  };

  const ec2Client = new EC2Client(clientConfig);
  const rdsClient = new RDSClient(clientConfig);

  // Fetch current AWS resources
  const [ec2Resources, sgResources, rdsResources, vpcResources] = await Promise.all([
    getEC2Resources(ec2Client).catch(() => []),
    getSecurityGroups(ec2Client).catch(() => []),
    getRDSResources(rdsClient).catch(() => []),
    getVPCResources(ec2Client).catch(() => []),
  ]);

  const allResources = [...ec2Resources, ...sgResources, ...rdsResources, ...vpcResources];
  const newDriftEvents: any[] = [];

  // Get existing snapshots
  const { data: existingSnapshots } = await supabase
    .from('resource_snapshots')
    .select('*')
    .eq('user_id', userId);

  const snapshotMap = new Map(
    (existingSnapshots || []).map((s: any) => [`${s.resource_type}:${s.resource_id}`, s])
  );

  // Compare and detect drift
  for (const resource of allResources) {
    const key = `${resource.resourceType}:${resource.resourceId}`;
    const existingSnapshot = snapshotMap.get(key);
    const currentHash = hashConfig(resource.configuration);

    if (existingSnapshot) {
      if (existingSnapshot.snapshot_hash !== currentHash) {
        const changes = findChanges(existingSnapshot.configuration, resource.configuration);
        
        if (changes.length > 0) {
          const severity = determineSeverity(resource.resourceType, changes);
          
          // Check if we already have an unacknowledged drift event for this
          const { data: existingDrift } = await supabase
            .from('drift_events')
            .select('id')
            .eq('user_id', userId)
            .eq('resource_id', resource.resourceId)
            .eq('acknowledged', false)
            .single();

          if (!existingDrift) {
            const { data: driftEvent, error: driftError } = await supabase
              .from('drift_events')
              .insert({
                user_id: userId,
                resource_type: resource.resourceType,
                resource_id: resource.resourceId,
                resource_name: resource.resourceName,
                previous_hash: existingSnapshot.snapshot_hash,
                current_hash: currentHash,
                changes: changes,
                severity: severity,
              })
              .select()
              .single();

            if (!driftError && driftEvent) {
              newDriftEvents.push(driftEvent);
            }
          }
        }
      }
    } else {
      // New resource - create initial snapshot
      await supabase
        .from('resource_snapshots')
        .upsert({
          user_id: userId,
          resource_type: resource.resourceType,
          resource_id: resource.resourceId,
          snapshot_hash: currentHash,
          configuration: resource.configuration,
          source: 'scheduled_scan',
        }, {
          onConflict: 'user_id,resource_type,resource_id'
        });
    }
  }

  // Send notifications if new drift detected and notifications are enabled
  if (newDriftEvents.length > 0 && preferences.notify_on_drift) {
    await sendDriftNotifications(supabase, userId, userEmail, preferences, newDriftEvents, awsConfig);
  }

  // Update last scan time
  await supabase
    .from('notification_preferences')
    .update({ drift_scan_last_run: new Date().toISOString() })
    .eq('user_id', userId);

  return {
    success: true,
    resourcesScanned: allResources.length,
    newDriftCount: newDriftEvents.length,
  };
}

function shouldRunScan(lastRun: string | null, frequency: string): boolean {
  if (!lastRun) return true;
  
  const lastRunDate = new Date(lastRun);
  const now = new Date();
  const diffMs = now.getTime() - lastRunDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  switch (frequency) {
    case 'daily':
      return diffHours >= 24;
    case 'weekly':
      return diffHours >= 168;
    case 'monthly':
      return diffHours >= 720;
    default:
      return diffHours >= 24;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function can be called either:
    // 1. By a cron job (no auth, uses service role)
    // 2. By a user to trigger their own scan manually

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'scheduled';

    if (action === 'manual') {
      // Manual trigger by authenticated user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: authError } = await userSupabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const result = await scanUserForDrift(supabase, user.id, user.email || '', prefs || {}, body.roleName);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Scheduled scan - process all users with drift scanning enabled
    const { data: usersWithScanning, error: fetchError } = await supabase
      .from('notification_preferences')
      .select('user_id, drift_scan_enabled, drift_scan_frequency, drift_scan_last_run, notify_on_drift, email_enabled, encrypted_slack_webhook, encrypted_discord_webhook, encrypted_webhook_url, webhook_nonce')
      .eq('drift_scan_enabled', true);

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results: any[] = [];
    
    for (const prefs of usersWithScanning || []) {
      // Check if it's time to run based on frequency
      if (!shouldRunScan(prefs.drift_scan_last_run, prefs.drift_scan_frequency)) {
        console.log(`Skipping user ${prefs.user_id} - not time yet`);
        continue;
      }

      try {
        // Get user email from auth
        const { data: { user } } = await supabase.auth.admin.getUserById(prefs.user_id);
        const userEmail = user?.email || '';

        // Scheduled scans use admin creds (no roleName)
        const result = await scanUserForDrift(supabase, prefs.user_id, userEmail, prefs);
        results.push({ userId: prefs.user_id, ...result });
      } catch (e) {
        console.error(`Error scanning user ${prefs.user_id}:`, e);
        results.push({ userId: prefs.user_id, success: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      usersProcessed: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Scheduled drift scan error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
