import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { CloudWatchClient, GetMetricStatisticsCommand, GetMetricDataCommand } from "npm:@aws-sdk/client-cloudwatch@3.451.0";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

interface MonitoringResult {
  cpu: MetricDataPoint[];
  networkIn: MetricDataPoint[];
  networkOut: MetricDataPoint[];
  diskReadOps?: MetricDataPoint[];
  diskWriteOps?: MetricDataPoint[];
  statusCheckFailed?: MetricDataPoint[];
  cachedAt?: string;
  fromCache: boolean;
  timeRange: string;
}

function getTimeRangeParams(timeRange: string): { startTime: Date; period: number; cacheTTLMinutes: number } {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return { startTime: new Date(now.getTime() - 60 * 60 * 1000), period: 300, cacheTTLMinutes: 5 };
    case '6h':
      return { startTime: new Date(now.getTime() - 6 * 60 * 60 * 1000), period: 900, cacheTTLMinutes: 10 };
    case '24h':
      return { startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), period: 3600, cacheTTLMinutes: 15 };
    case '7d':
      return { startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), period: 21600, cacheTTLMinutes: 30 };
    default:
      return { startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), period: 3600, cacheTTLMinutes: 15 };
  }
}

async function getCachedMetrics(supabase: any, userId: string, timeRange: string): Promise<MonitoringResult | null> {
  try {
    const { data, error } = await supabase
      .from('monitoring_data_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('time_range', timeRange)
      .single();

    if (error || !data) return null;

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) {
      console.log(`Cache expired for ${timeRange}`);
      return null;
    }

    console.log(`Using cached monitoring data for ${timeRange}`);
    return {
      cpu: data.cpu_metrics || [],
      networkIn: data.network_in_metrics || [],
      networkOut: data.network_out_metrics || [],
      diskReadOps: data.disk_read_metrics || [],
      diskWriteOps: data.disk_write_metrics || [],
      statusCheckFailed: data.status_check_metrics || [],
      cachedAt: data.cached_at,
      fromCache: true,
      timeRange,
    };
  } catch (err: any) {
    console.error('Error reading cache:', err.message);
    return null;
  }
}

async function saveCachedMetrics(supabase: any, userId: string, timeRange: string, data: MonitoringResult, cacheTTLMinutes: number): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + cacheTTLMinutes * 60 * 1000);

    await supabase
      .from('monitoring_data_cache')
      .upsert({
        user_id: userId,
        time_range: timeRange,
        cpu_metrics: data.cpu,
        network_in_metrics: data.networkIn,
        network_out_metrics: data.networkOut,
        disk_read_metrics: data.diskReadOps || [],
        disk_write_metrics: data.diskWriteOps || [],
        status_check_metrics: data.statusCheckFailed || [],
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'user_id,time_range' });

    console.log(`Cached monitoring data for ${timeRange} (TTL: ${cacheTTLMinutes}m)`);
  } catch (err: any) {
    console.error('Error saving cache:', err.message);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let timeRange = '24h';
    let forceRefresh = false;
    let includePaidMetrics = false;
    let roleName: string | undefined;

    try {
      if (req.method === 'POST') {
        const body = await req.json();
        timeRange = body.timeRange || '24h';
        forceRefresh = body.forceRefresh === true;
        includePaidMetrics = body.includePaidMetrics === true;
        roleName = body.roleName;
      }
    } catch { /* defaults */ }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache first
    if (!forceRefresh) {
      const cached = await getCachedMetrics(supabaseClient, user.id, timeRange);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get AWS credentials
    const { data: creds, error: credsError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credsError || !creds || creds.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const awsCredsRaw = creds[0];
    const region = awsCredsRaw.region || 'us-east-1';

    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, user.id, user.email || '',
      { accessKeyId: awsCredsRaw.access_key_id, secretAccessKey: awsCredsRaw.secret_access_key },
      region, roleName
    );

    const cloudWatchClient = new CloudWatchClient({
      region,
      credentials: awsCreds,
    });

    // Get running instance IDs from EC2
    const { EC2Client, DescribeInstancesCommand } = await import("npm:@aws-sdk/client-ec2@3.451.0");
    const ec2Client = new EC2Client({
      region,
      credentials: awsCreds,
    });

    const ec2Response = await ec2Client.send(new DescribeInstancesCommand({
      Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
    }));

    const instanceIds: string[] = [];
    for (const reservation of ec2Response.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        if (instance.InstanceId) instanceIds.push(instance.InstanceId);
      }
    }

    const { startTime, period, cacheTTLMinutes } = getTimeRangeParams(timeRange);
    const endTime = new Date();

    const fetchFreeMetric = async (metricName: string, instanceId?: string): Promise<MetricDataPoint[]> => {
      try {
        const dimensions = instanceId ? [{ Name: 'InstanceId', Value: instanceId }] : undefined;
        const command = new GetMetricStatisticsCommand({
          Namespace: 'AWS/EC2',
          MetricName: metricName,
          Dimensions: dimensions,
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Average'],
        });

        const response = await cloudWatchClient.send(command);
        return (response.Datapoints || [])
          .sort((a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0))
          .map(dp => ({
            timestamp: dp.Timestamp?.toISOString() || '',
            value: Math.round((dp.Average || 0) * 100) / 100,
          }));
      } catch (err: any) {
        console.log(`Could not fetch ${metricName}: ${err.message}`);
        return [];
      }
    };

    const targetInstance = instanceIds.length > 0 ? instanceIds[0] : undefined;

    const freeMetricPromises = [
      fetchFreeMetric('CPUUtilization', targetInstance),
      fetchFreeMetric('NetworkIn', targetInstance),
      fetchFreeMetric('NetworkOut', targetInstance),
    ];

    const paidMetricPromises = includePaidMetrics ? [
      fetchFreeMetric('DiskReadOps', targetInstance),
      fetchFreeMetric('DiskWriteOps', targetInstance),
      fetchFreeMetric('StatusCheckFailed', targetInstance),
    ] : [
      Promise.resolve([]),
      Promise.resolve([]),
      Promise.resolve([]),
    ];

    const [cpu, networkIn, networkOut, diskReadOps, diskWriteOps, statusCheckFailed] = await Promise.all([
      ...freeMetricPromises,
      ...paidMetricPromises,
    ]);

    console.log(`Fetched metrics (${timeRange}): ${cpu.length} CPU, ${networkIn.length} NetIn, ${networkOut.length} NetOut`);
    if (includePaidMetrics) {
      console.log(`Paid metrics: ${diskReadOps.length} DiskRead, ${diskWriteOps.length} DiskWrite, ${statusCheckFailed.length} StatusCheck`);
    }

    const result: MonitoringResult = {
      cpu,
      networkIn,
      networkOut,
      diskReadOps: includePaidMetrics ? diskReadOps : undefined,
      diskWriteOps: includePaidMetrics ? diskWriteOps : undefined,
      statusCheckFailed: includePaidMetrics ? statusCheckFailed : undefined,
      fromCache: false,
      timeRange,
      cachedAt: new Date().toISOString(),
    };

    await saveCachedMetrics(supabaseClient, user.id, timeRange, result, cacheTTLMinutes);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Monitoring metrics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
