import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CloudWatchClient, PutMetricAlarmCommand, DeleteAlarmsCommand, EnableAlarmActionsCommand, DisableAlarmActionsCommand } from "npm:@aws-sdk/client-cloudwatch";
import { BudgetsClient, CreateBudgetCommand, DeleteBudgetCommand } from "npm:@aws-sdk/client-budgets";
import { SNSClient, CreateTopicCommand, SubscribeCommand, GetTopicAttributesCommand } from "npm:@aws-sdk/client-sns";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const metricMapping: Record<string, { namespace: string; metricName: string; type: 'cloudwatch' | 'budget' }> = {
  CPUUtilization:       { namespace: 'AWS/EC2',  metricName: 'CPUUtilization',       type: 'cloudwatch' },
  NetworkIn:            { namespace: 'AWS/EC2',  metricName: 'NetworkIn',             type: 'cloudwatch' },
  NetworkOut:           { namespace: 'AWS/EC2',  metricName: 'NetworkOut',            type: 'cloudwatch' },
  DatabaseConnections:  { namespace: 'AWS/RDS',  metricName: 'DatabaseConnections',  type: 'cloudwatch' },
  ReadLatency:          { namespace: 'AWS/RDS',  metricName: 'ReadLatency',           type: 'cloudwatch' },
  WriteLatency:         { namespace: 'AWS/RDS',  metricName: 'WriteLatency',          type: 'cloudwatch' },
  FreeStorageSpace:     { namespace: 'AWS/RDS',  metricName: 'FreeStorageSpace',      type: 'cloudwatch' },
  VolumeReadOps:        { namespace: 'AWS/EBS',  metricName: 'VolumeReadOps',         type: 'cloudwatch' },
  VolumeWriteOps:       { namespace: 'AWS/EBS',  metricName: 'VolumeWriteOps',        type: 'cloudwatch' },
  MemoryUtilization:    { namespace: 'CWAgent',  metricName: 'mem_used_percent',      type: 'cloudwatch' },
  DiskUtilization:      { namespace: 'CWAgent',  metricName: 'disk_used_percent',     type: 'cloudwatch' },
  MonthlyBudget:        { namespace: '',          metricName: '',                      type: 'budget' },
  ServiceBudget:        { namespace: '',          metricName: '',                      type: 'budget' },
};

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('No authorization header');

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  return { supabaseClient, user };
}

async function getAWSCredentials(supabaseClient: any, userId: string) {
  const { data: credentials, error } = await supabaseClient
    .rpc('get_user_aws_credentials', { user_id_param: userId });

  if (error || !credentials || credentials.length === 0) {
    throw new Error('AWS credentials not configured');
  }
  return credentials[0];
}

async function getResolvedAWSCreds(supabaseClient: any, user: any, roleName?: string) {
  const creds = await getAWSCredentials(supabaseClient, user.id);
  const { credentials: awsCreds } = await resolveCredentials(
    supabaseClient, user.id, user.email || '',
    { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
    creds.region || 'us-east-1', roleName
  );
  return { awsCreds, region: creds.region || 'us-east-1' };
}

async function handleCreate(supabaseClient: any, user: any, body: any) {
  const { name, metric, threshold, duration, severity, comparison_operator, roleName } = body;
  const { awsCreds, region } = await getResolvedAWSCreds(supabaseClient, user, roleName);
  const config = metricMapping[metric] || { namespace: 'AWS/EC2', metricName: metric, type: 'cloudwatch' };
  const comp = comparison_operator || 'GreaterThanThreshold';
  const alarmName = `CloudHub-${user.id.substring(0, 8)}-${name.replace(/\s+/g, '-')}`;

  if (config.type === 'budget') {
    const budgetsClient = new BudgetsClient({
      region: 'us-east-1',
      credentials: awsCreds,
    });

    let accountId: string;
    try {
      const { STSClient, GetCallerIdentityCommand } = await import("npm:@aws-sdk/client-sts");
      const sts = new STSClient({
        region: region,
        credentials: awsCreds,
      });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account!;
    } catch (e) {
      throw new Error('Could not determine AWS account ID. Ensure sts:GetCallerIdentity permission is granted.');
    }

    // Fetch user's SNS topic ARN for budget notifications
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: prefs } = await serviceClient
      .from('notification_preferences')
      .select('sns_topic_arn')
      .eq('user_id', user.id)
      .single();

    const budgetName = alarmName;
    const thresholdNum = parseFloat(threshold);

    const budgetParams: any = {
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        BudgetLimit: { Amount: String(thresholdNum), Unit: 'USD' },
        TimeUnit: 'MONTHLY',
        BudgetType: 'COST',
      },
    };

    // Only add notification subscribers if we have a valid SNS topic
    if (prefs?.sns_topic_arn) {
      budgetParams.NotificationsWithSubscribers = [{
        Notification: {
          NotificationType: 'ACTUAL',
          ComparisonOperator: 'GREATER_THAN',
          Threshold: 80,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [{ SubscriptionType: 'SNS', Address: prefs.sns_topic_arn }],
      }];
    }

    await budgetsClient.send(new CreateBudgetCommand(budgetParams));

    console.log(`Created AWS Budget: ${budgetName}`);

    const { data: rule, error: insertError } = await supabaseClient
      .from('alert_rules')
      .insert({
        user_id: user.id, name, metric, threshold: thresholdNum,
        duration: duration || 5, severity: severity || 'warning',
        enabled: true, cloudwatch_alarm_name: budgetName,
        comparison_operator: comp,
      })
      .select().single();

    if (insertError) {
      try { await budgetsClient.send(new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName })); } catch (_) {}
      throw insertError;
    }

    return { success: true, rule, message: 'Budget alert created successfully' };
  }

  // CloudWatch alarm path

  // Ensure user has an SNS topic for alarm actions
  let topicArn: string | null = null;
  try {
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if topic already exists
    const { data: prefs } = await serviceClient
      .from('notification_preferences')
      .select('sns_topic_arn')
      .eq('user_id', user.id)
      .single();

    if (prefs?.sns_topic_arn) {
      // Verify it still exists
      const snsClient = new SNSClient({ region, credentials: awsCreds });
      try {
        await snsClient.send(new GetTopicAttributesCommand({ TopicArn: prefs.sns_topic_arn }));
        topicArn = prefs.sns_topic_arn;
      } catch {
        // Topic doesn't exist, recreate below
      }
    }

    if (!topicArn) {
      const snsClient = new SNSClient({ region, credentials: awsCreds });
      const userPrefix = user.id.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 8);
      const topicName = `CloudHub-${userPrefix}`;

      const createResult = await snsClient.send(new CreateTopicCommand({
        Name: topicName,
        Tags: [
          { Key: 'CloudHubUser', Value: user.id },
          { Key: 'ManagedBy', Value: 'CloudHub' },
        ],
      }));

      topicArn = createResult.TopicArn || null;

      if (topicArn) {
        // Subscribe the webhook
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const webhookEndpoint = `${supabaseUrl}/functions/v1/sns-webhook`;
        await snsClient.send(new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: 'https',
          Endpoint: webhookEndpoint,
        }));

        // Store topic ARN
        await serviceClient
          .from('notification_preferences')
          .upsert(
            { user_id: user.id, sns_topic_arn: topicArn },
            { onConflict: 'user_id' }
          );

        console.log('Created SNS topic and subscribed webhook:', topicArn);
      }
    }
  } catch (e) {
    console.warn('Failed to set up SNS topic (alarm will work without notifications):', e.message);
  }

  const cloudwatchClient = new CloudWatchClient({
    region,
    credentials: awsCreds,
  });

  const alarmParams: any = {
    AlarmName: alarmName,
    AlarmDescription: `CloudHub alert: ${name} - ${metric} ${comp} ${threshold}`,
    MetricName: config.metricName,
    Namespace: config.namespace,
    Statistic: 'Average',
    Period: (duration || 5) * 60,
    EvaluationPeriods: 1,
    Threshold: parseFloat(threshold),
    ComparisonOperator: comp,
    TreatMissingData: 'notBreaching',
  };

  // Wire SNS topic for alarm and OK actions
  if (topicArn) {
    alarmParams.AlarmActions = [topicArn];
    alarmParams.OKActions = [topicArn];
  }

  await cloudwatchClient.send(new PutMetricAlarmCommand(alarmParams));

  console.log(`Created CloudWatch alarm: ${alarmName}`);

  const { data: rule, error: insertError } = await supabaseClient
    .from('alert_rules')
    .insert({
      user_id: user.id, name, metric, threshold: parseFloat(threshold),
      duration: duration || 5, severity: severity || 'warning',
      enabled: true, cloudwatch_alarm_name: alarmName,
      comparison_operator: comp,
    })
    .select().single();

  if (insertError) {
    await cloudwatchClient.send(new DeleteAlarmsCommand({ AlarmNames: [alarmName] }));
    throw insertError;
  }

  return { success: true, rule, message: 'Alert rule created successfully' };
}

async function handleDelete(supabaseClient: any, user: any, ruleId: string, roleName?: string) {
  const { awsCreds, region } = await getResolvedAWSCreds(supabaseClient, user, roleName);
  const { data: rule, error: fetchError } = await supabaseClient
    .from('alert_rules').select('*').eq('id', ruleId).single();

  if (fetchError || !rule) throw new Error('Alert rule not found');

  const config = metricMapping[rule.metric];
  const isBudget = config?.type === 'budget';

  if (rule.cloudwatch_alarm_name) {
    try {
      if (isBudget) {
        const { STSClient, GetCallerIdentityCommand } = await import("npm:@aws-sdk/client-sts");
        const sts = new STSClient({
          region,
          credentials: awsCreds,
        });
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        const budgetsClient = new BudgetsClient({
          region: 'us-east-1',
          credentials: awsCreds,
        });
        await budgetsClient.send(new DeleteBudgetCommand({
          AccountId: identity.Account!,
          BudgetName: rule.cloudwatch_alarm_name,
        }));
        console.log(`Deleted AWS Budget: ${rule.cloudwatch_alarm_name}`);
      } else {
        const cw = new CloudWatchClient({
          region,
          credentials: awsCreds,
        });
        await cw.send(new DeleteAlarmsCommand({ AlarmNames: [rule.cloudwatch_alarm_name] }));
        console.log(`Deleted CloudWatch alarm: ${rule.cloudwatch_alarm_name}`);
      }
    } catch (e) {
      console.warn(`Could not delete alarm/budget: ${e.message}`);
    }
  }

  const { error: deleteError } = await supabaseClient
    .from('alert_rules').delete().eq('id', ruleId);
  if (deleteError) throw deleteError;

  return { success: true, message: 'Alert rule deleted successfully' };
}

async function handleToggle(supabaseClient: any, user: any, ruleId: string, roleName?: string) {
  const { awsCreds, region } = await getResolvedAWSCreds(supabaseClient, user, roleName);
  const { data: rule, error: fetchError } = await supabaseClient
    .from('alert_rules').select('*').eq('id', ruleId).single();

  if (fetchError || !rule) throw new Error('Alert rule not found');

  const newEnabled = !rule.enabled;
  const config = metricMapping[rule.metric];

  if (rule.cloudwatch_alarm_name && config?.type !== 'budget') {
    try {
      const cw = new CloudWatchClient({
        region,
        credentials: awsCreds,
      });
      if (newEnabled) {
        await cw.send(new EnableAlarmActionsCommand({ AlarmNames: [rule.cloudwatch_alarm_name] }));
      } else {
        await cw.send(new DisableAlarmActionsCommand({ AlarmNames: [rule.cloudwatch_alarm_name] }));
      }
    } catch (e) {
      console.warn(`Could not toggle CloudWatch alarm: ${e.message}`);
    }
  }

  const { data: updatedRule, error: updateError } = await supabaseClient
    .from('alert_rules').update({ enabled: newEnabled }).eq('id', ruleId).select().single();
  if (updateError) throw updateError;

  return { success: true, rule: updatedRule, message: `Alert rule ${newEnabled ? 'enabled' : 'disabled'}` };
}

async function handleUpdate(supabaseClient: any, user: any, body: any) {
  const { ruleId, threshold, duration, severity, comparison_operator, roleName } = body;
  if (!ruleId) throw new Error('ruleId is required');

  const { awsCreds, region } = await getResolvedAWSCreds(supabaseClient, user, roleName);

  const { data: rule, error: fetchError } = await supabaseClient
    .from('alert_rules').select('*').eq('id', ruleId).single();
  if (fetchError || !rule) throw new Error('Alert rule not found');

  const config = metricMapping[rule.metric] || { namespace: 'AWS/EC2', metricName: rule.metric, type: 'cloudwatch' };
  const newThreshold = parseFloat(threshold);
  const newDuration = parseInt(duration) || rule.duration;
  const newComp = comparison_operator || rule.comparison_operator;
  const newSeverity = severity || rule.severity;

  if (config.type === 'budget' && rule.cloudwatch_alarm_name) {
    // Delete + recreate budget with new limit
    try {
      const { STSClient, GetCallerIdentityCommand } = await import("npm:@aws-sdk/client-sts");
      const sts = new STSClient({ region, credentials: awsCreds });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      const accountId = identity.Account!;
      const budgetsClient = new BudgetsClient({ region: 'us-east-1', credentials: awsCreds });

      try {
        await budgetsClient.send(new DeleteBudgetCommand({ AccountId: accountId, BudgetName: rule.cloudwatch_alarm_name }));
      } catch (e) {
        console.warn(`Could not delete old budget: ${e.message}`);
      }

      // Fetch SNS topic for budget notifications
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: prefs } = await serviceClient
        .from('notification_preferences')
        .select('sns_topic_arn')
        .eq('user_id', user.id)
        .single();

      const budgetParams: any = {
        AccountId: accountId,
        Budget: {
          BudgetName: rule.cloudwatch_alarm_name,
          BudgetLimit: { Amount: String(newThreshold), Unit: 'USD' },
          TimeUnit: 'MONTHLY',
          BudgetType: 'COST',
        },
      };

      if (prefs?.sns_topic_arn) {
        budgetParams.NotificationsWithSubscribers = [{
          Notification: {
            NotificationType: 'ACTUAL',
            ComparisonOperator: 'GREATER_THAN',
            Threshold: 80,
            ThresholdType: 'PERCENTAGE',
          },
          Subscribers: [{ SubscriptionType: 'SNS', Address: prefs.sns_topic_arn }],
        }];
      }

      await budgetsClient.send(new CreateBudgetCommand(budgetParams));
      console.log(`Updated AWS Budget: ${rule.cloudwatch_alarm_name}`);
    } catch (e) {
      console.warn(`Could not update budget: ${e.message}`);
    }
  } else if (rule.cloudwatch_alarm_name) {
    // Update CloudWatch alarm in place via PutMetricAlarm
    // CRITICAL: Fetch SNS topic ARN so PutMetricAlarm doesn't strip AlarmActions
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: prefs } = await serviceClient
      .from('notification_preferences')
      .select('sns_topic_arn')
      .eq('user_id', user.id)
      .single();

    const cw = new CloudWatchClient({ region, credentials: awsCreds });
    const alarmParams: any = {
      AlarmName: rule.cloudwatch_alarm_name,
      AlarmDescription: `CloudHub alert: ${rule.name} - ${rule.metric} ${newComp} ${newThreshold}`,
      MetricName: config.metricName,
      Namespace: config.namespace,
      Statistic: 'Average',
      Period: newDuration * 60,
      EvaluationPeriods: 1,
      Threshold: newThreshold,
      ComparisonOperator: newComp,
      TreatMissingData: 'notBreaching',
    };

    // Preserve SNS topic wiring
    if (prefs?.sns_topic_arn) {
      alarmParams.AlarmActions = [prefs.sns_topic_arn];
      alarmParams.OKActions = [prefs.sns_topic_arn];
    }

    await cw.send(new PutMetricAlarmCommand(alarmParams));
    console.log(`Updated CloudWatch alarm: ${rule.cloudwatch_alarm_name} (SNS actions preserved: ${!!prefs?.sns_topic_arn})`);
  }

  const { data: updatedRule, error: updateError } = await supabaseClient
    .from('alert_rules')
    .update({ threshold: newThreshold, duration: newDuration, severity: newSeverity, comparison_operator: newComp })
    .eq('id', ruleId)
    .select()
    .single();

  if (updateError) throw updateError;

  return { success: true, rule: updatedRule, message: 'Alert rule updated successfully' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabaseClient, user } = await getAuthenticatedUser(req);
    const body = await req.json();
    const { action, ruleId, roleName } = body;
    console.log(`Managing alert rule: action=${action}, ruleId=${ruleId}, name=${body.name}`);

    let result: any;

    switch (action) {
      case 'create':
        result = await handleCreate(supabaseClient, user, body);
        break;
      case 'delete':
        result = await handleDelete(supabaseClient, user, ruleId, roleName);
        break;
      case 'toggle':
        result = await handleToggle(supabaseClient, user, ruleId, roleName);
        break;
      case 'update':
        result = await handleUpdate(supabaseClient, user, body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error managing alert rule:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
