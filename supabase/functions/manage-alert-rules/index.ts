import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CloudWatchClient, PutMetricAlarmCommand, DeleteAlarmsCommand, EnableAlarmActionsCommand, DisableAlarmActionsCommand } from "npm:@aws-sdk/client-cloudwatch";
import { BudgetsClient, CreateBudgetCommand, DeleteBudgetCommand } from "npm:@aws-sdk/client-budgets";

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

async function handleCreate(supabaseClient: any, user: any, body: any) {
  const { name, metric, threshold, duration, severity, comparison_operator } = body;
  const creds = await getAWSCredentials(supabaseClient, user.id);
  const config = metricMapping[metric] || { namespace: 'AWS/EC2', metricName: metric, type: 'cloudwatch' };
  const comp = comparison_operator || 'GreaterThanThreshold';
  const alarmName = `CloudHub-${user.id.substring(0, 8)}-${name.replace(/\s+/g, '-')}`;

  if (config.type === 'budget') {
    // Create AWS Budget alert -- must use us-east-1
    const budgetsClient = new BudgetsClient({
      region: 'us-east-1',
      credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
    });

    // Get AWS account ID from STS (fallback to user id prefix)
    let accountId: string;
    try {
      const { STSClient, GetCallerIdentityCommand } = await import("npm:@aws-sdk/client-sts");
      const sts = new STSClient({
        region: creds.region || 'us-east-1',
        credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
      });
      const identity = await sts.send(new GetCallerIdentityCommand({}));
      accountId = identity.Account!;
    } catch (e) {
      throw new Error('Could not determine AWS account ID. Ensure sts:GetCallerIdentity permission is granted.');
    }

    const budgetName = alarmName;
    const thresholdNum = parseFloat(threshold);

    await budgetsClient.send(new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        BudgetLimit: { Amount: String(thresholdNum), Unit: 'USD' },
        TimeUnit: 'MONTHLY',
        BudgetType: 'COST',
      },
      NotificationsWithSubscribers: [{
        Notification: {
          NotificationType: 'ACTUAL',
          ComparisonOperator: 'GREATER_THAN',
          Threshold: 80,
          ThresholdType: 'PERCENTAGE',
        },
        Subscribers: [{ SubscriptionType: 'SNS', Address: 'arn:aws:sns:us-east-1:placeholder' }],
      }],
    }));

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
  const cloudwatchClient = new CloudWatchClient({
    region: creds.region || 'us-east-1',
    credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
  });

  await cloudwatchClient.send(new PutMetricAlarmCommand({
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
  }));

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

async function handleDelete(supabaseClient: any, user: any, ruleId: string) {
  const creds = await getAWSCredentials(supabaseClient, user.id);
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
          region: creds.region || 'us-east-1',
          credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
        });
        const identity = await sts.send(new GetCallerIdentityCommand({}));
        const budgetsClient = new BudgetsClient({
          region: 'us-east-1',
          credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
        });
        await budgetsClient.send(new DeleteBudgetCommand({
          AccountId: identity.Account!,
          BudgetName: rule.cloudwatch_alarm_name,
        }));
        console.log(`Deleted AWS Budget: ${rule.cloudwatch_alarm_name}`);
      } else {
        const cw = new CloudWatchClient({
          region: creds.region || 'us-east-1',
          credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
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

async function handleToggle(supabaseClient: any, user: any, ruleId: string) {
  const creds = await getAWSCredentials(supabaseClient, user.id);
  const { data: rule, error: fetchError } = await supabaseClient
    .from('alert_rules').select('*').eq('id', ruleId).single();

  if (fetchError || !rule) throw new Error('Alert rule not found');

  const newEnabled = !rule.enabled;
  const config = metricMapping[rule.metric];

  // Only toggle CW alarms (budgets don't support enable/disable)
  if (rule.cloudwatch_alarm_name && config?.type !== 'budget') {
    try {
      const cw = new CloudWatchClient({
        region: creds.region || 'us-east-1',
        credentials: { accessKeyId: creds.access_key_id, secretAccessKey: creds.secret_access_key },
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabaseClient, user } = await getAuthenticatedUser(req);
    const body = await req.json();
    const { action, ruleId } = body;
    console.log(`Managing alert rule: action=${action}, ruleId=${ruleId}, name=${body.name}`);

    let result: any;

    switch (action) {
      case 'create':
        result = await handleCreate(supabaseClient, user, body);
        break;
      case 'delete':
        result = await handleDelete(supabaseClient, user, ruleId);
        break;
      case 'toggle':
        result = await handleToggle(supabaseClient, user, ruleId);
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
