import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CloudWatchClient, PutMetricAlarmCommand, DeleteAlarmsCommand, EnableAlarmActionsCommand, DisableAlarmActionsCommand } from "npm:@aws-sdk/client-cloudwatch";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { action, ruleId, name, metric, threshold, duration, severity, enabled } = await req.json();
    console.log(`Managing alert rule: action=${action}, ruleId=${ruleId}, name=${name}`);

    // Get AWS credentials
    const { data: credentials, error: credError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      throw new Error('AWS credentials not configured');
    }

    const { access_key_id, secret_access_key, region } = credentials[0];
    
    const cloudwatchClient = new CloudWatchClient({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId: access_key_id,
        secretAccessKey: secret_access_key,
      },
    });

    let result: any = {};

    switch (action) {
      case 'create': {
        // Create CloudWatch alarm
        const alarmName = `CloudHub-${user.id.substring(0, 8)}-${name.replace(/\s+/g, '-')}`;
        
        // Map metric name to CloudWatch namespace and metric
        const metricMapping: Record<string, { namespace: string; metricName: string; dimensions?: any[] }> = {
          'CPUUtilization': { namespace: 'AWS/EC2', metricName: 'CPUUtilization' },
          'MemoryUtilization': { namespace: 'CWAgent', metricName: 'mem_used_percent' },
          'DiskUtilization': { namespace: 'CWAgent', metricName: 'disk_used_percent' },
          'NetworkIn': { namespace: 'AWS/EC2', metricName: 'NetworkIn' },
          'NetworkOut': { namespace: 'AWS/EC2', metricName: 'NetworkOut' },
        };

        const metricConfig = metricMapping[metric] || { namespace: 'AWS/EC2', metricName: metric };
        
        const putAlarmCommand = new PutMetricAlarmCommand({
          AlarmName: alarmName,
          AlarmDescription: `CloudHub alert: ${name} - ${metric} > ${threshold}`,
          MetricName: metricConfig.metricName,
          Namespace: metricConfig.namespace,
          Statistic: 'Average',
          Period: (duration || 5) * 60, // Convert minutes to seconds
          EvaluationPeriods: 1,
          Threshold: parseFloat(threshold),
          ComparisonOperator: 'GreaterThanThreshold',
          TreatMissingData: 'notBreaching',
        });

        await cloudwatchClient.send(putAlarmCommand);
        console.log(`Created CloudWatch alarm: ${alarmName}`);

        // Save to database
        const { data: rule, error: insertError } = await supabaseClient
          .from('alert_rules')
          .insert({
            user_id: user.id,
            name,
            metric,
            threshold: parseFloat(threshold),
            duration: duration || 5,
            severity: severity || 'warning',
            enabled: true,
            cloudwatch_alarm_name: alarmName,
          })
          .select()
          .single();

        if (insertError) {
          // Cleanup CloudWatch alarm if DB insert fails
          await cloudwatchClient.send(new DeleteAlarmsCommand({ AlarmNames: [alarmName] }));
          throw insertError;
        }

        result = { success: true, rule, message: 'Alert rule created successfully' };
        break;
      }

      case 'delete': {
        // Get the rule to find CloudWatch alarm name
        const { data: rule, error: fetchError } = await supabaseClient
          .from('alert_rules')
          .select('*')
          .eq('id', ruleId)
          .single();

        if (fetchError || !rule) {
          throw new Error('Alert rule not found');
        }

        // Delete CloudWatch alarm
        if (rule.cloudwatch_alarm_name) {
          try {
            await cloudwatchClient.send(new DeleteAlarmsCommand({ 
              AlarmNames: [rule.cloudwatch_alarm_name] 
            }));
            console.log(`Deleted CloudWatch alarm: ${rule.cloudwatch_alarm_name}`);
          } catch (e) {
            console.warn(`Could not delete CloudWatch alarm: ${e.message}`);
          }
        }

        // Delete from database
        const { error: deleteError } = await supabaseClient
          .from('alert_rules')
          .delete()
          .eq('id', ruleId);

        if (deleteError) throw deleteError;

        result = { success: true, message: 'Alert rule deleted successfully' };
        break;
      }

      case 'toggle': {
        // Get the rule
        const { data: rule, error: fetchError } = await supabaseClient
          .from('alert_rules')
          .select('*')
          .eq('id', ruleId)
          .single();

        if (fetchError || !rule) {
          throw new Error('Alert rule not found');
        }

        const newEnabled = !rule.enabled;

        // Enable/disable CloudWatch alarm actions
        if (rule.cloudwatch_alarm_name) {
          try {
            if (newEnabled) {
              await cloudwatchClient.send(new EnableAlarmActionsCommand({ 
                AlarmNames: [rule.cloudwatch_alarm_name] 
              }));
            } else {
              await cloudwatchClient.send(new DisableAlarmActionsCommand({ 
                AlarmNames: [rule.cloudwatch_alarm_name] 
              }));
            }
          } catch (e) {
            console.warn(`Could not toggle CloudWatch alarm: ${e.message}`);
          }
        }

        // Update database
        const { data: updatedRule, error: updateError } = await supabaseClient
          .from('alert_rules')
          .update({ enabled: newEnabled })
          .eq('id', ruleId)
          .select()
          .single();

        if (updateError) throw updateError;

        result = { success: true, rule: updatedRule, message: `Alert rule ${newEnabled ? 'enabled' : 'disabled'}` };
        break;
      }

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
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
