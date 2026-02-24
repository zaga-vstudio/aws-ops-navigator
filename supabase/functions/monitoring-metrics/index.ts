import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { CloudWatchClient, GetMetricStatisticsCommand } from "npm:@aws-sdk/client-cloudwatch@3.451.0";
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
  databaseConnections?: MetricDataPoint[];
  freeStorageSpace?: MetricDataPoint[];
  readLatency?: MetricDataPoint[];
  writeLatency?: MetricDataPoint[];
  cachedAt?: string;
  fromCache: boolean;
  timeRange: string;
  resourceType: 'ec2' | 'rds';
  instanceId: string;
}

function getTimeRangeParams(timeRange: string, resourceType: 'ec2' | 'rds'): { startTime: Date; period: number; cacheTTLMinutes: number } {
  const now = new Date();
  if (resourceType === 'rds') {
    switch (timeRange) {
      case '1h':
        return { startTime: new Date(now.getTime() - 60 * 60 * 1000), period: 60, cacheTTLMinutes: 5 };
      case '6h':
        return { startTime: new Date(now.getTime() - 6 * 60 * 60 * 1000), period: 300, cacheTTLMinutes: 10 };
      case '24h':
        return { startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), period: 900, cacheTTLMinutes: 15 };
      case '7d':
        return { startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), period: 3600, cacheTTLMinutes: 30 };
      default:
        return { startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000), period: 900, cacheTTLMinutes: 15 };
    }
  }
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

async function getCachedMetrics(supabase: any, userId: string, timeRange: string, instanceId: string, resourceType: string): Promise<MonitoringResult | null> {
  try {
    const { data, error } = await supabase
      .from('monitoring_data_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('time_range', timeRange)
      .eq('instance_id', instanceId)
      .eq('resource_type', resourceType)
      .single();

    if (error || !data) return null;

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    if (now > expiresAt) return null;

    console.log(`Using cached monitoring data for ${resourceType}:${instanceId} (${timeRange})`);
    return {
      cpu: data.cpu_metrics || [],
      networkIn: data.network_in_metrics || [],
      networkOut: data.network_out_metrics || [],
      diskReadOps: data.disk_read_metrics || [],
      diskWriteOps: data.disk_write_metrics || [],
      statusCheckFailed: data.status_check_metrics || [],
      databaseConnections: data.db_connections_metrics || [],
      freeStorageSpace: data.free_storage_metrics || [],
      readLatency: data.read_latency_metrics || [],
      writeLatency: data.write_latency_metrics || [],
      cachedAt: data.cached_at,
      fromCache: true,
      timeRange,
      resourceType: resourceType as 'ec2' | 'rds',
      instanceId,
    };
  } catch (err: any) {
    console.error('Error reading cache:', err.message);
    return null;
  }
}

async function saveCachedMetrics(supabase: any, userId: string, timeRange: string, instanceId: string, resourceType: string, data: MonitoringResult, cacheTTLMinutes: number): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + cacheTTLMinutes * 60 * 1000);

    await supabase
      .from('monitoring_data_cache')
      .upsert({
        user_id: userId,
        time_range: timeRange,
        instance_id: instanceId,
        resource_type: resourceType,
        cpu_metrics: data.cpu,
        network_in_metrics: data.networkIn,
        network_out_metrics: data.networkOut,
        disk_read_metrics: data.diskReadOps || [],
        disk_write_metrics: data.diskWriteOps || [],
        status_check_metrics: data.statusCheckFailed || [],
        db_connections_metrics: data.databaseConnections || [],
        free_storage_metrics: data.freeStorageSpace || [],
        read_latency_metrics: data.readLatency || [],
        write_latency_metrics: data.writeLatency || [],
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: 'user_id,time_range,instance_id,resource_type' });

    console.log(`Cached monitoring data for ${resourceType}:${instanceId} (${timeRange}, TTL: ${cacheTTLMinutes}m)`);
  } catch (err: any) {
    console.error('Error saving cache:', err.message);
  }
}

async function validateAndResolveInstance(
  ec2Client: any,
  resourceType: 'ec2' | 'rds',
  instanceId: string | undefined,
  awsCreds: any,
  region: string
): Promise<{ resolvedId: string; error?: string }> {
  if (resourceType === 'rds') {
    if (!instanceId) {
      return { error: 'instanceId is required for RDS monitoring' };
    }
    try {
      const { RDSClient, DescribeDBInstancesCommand } = await import("npm:@aws-sdk/client-rds@3.451.0");
      const rdsClient = new RDSClient({ region, credentials: awsCreds });
      const resp = await rdsClient.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }));
      if (!resp.DBInstances || resp.DBInstances.length === 0) {
        return { error: 'RDS instance not found in your account' };
      }
      return { resolvedId: instanceId };
    } catch (err: any) {
      if (err.name === 'DBInstanceNotFoundFault' || err.message?.includes('not found')) {
        return { error: 'RDS instance not found in your account' };
      }
      throw err;
    }
  }

  // EC2
  const { DescribeInstancesCommand } = await import("npm:@aws-sdk/client-ec2@3.451.0");

  if (instanceId) {
    try {
      const resp = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
      const instances = resp.Reservations?.flatMap((r: any) => r.Instances || []) || [];
      if (instances.length === 0) {
        return { error: 'EC2 instance not found in your account' };
      }
      return { resolvedId: instanceId };
    } catch (err: any) {
      if (err.name === 'InvalidInstanceID.NotFound' || err.Code === 'InvalidInstanceID.NotFound') {
        return { error: 'EC2 instance not found in your account' };
      }
      throw err;
    }
  }

  // Auto-select first running EC2 instance
  const resp = await ec2Client.send(new DescribeInstancesCommand({
    Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
  }));
  const allInstances: string[] = [];
  for (const reservation of resp.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      if (instance.InstanceId) allInstances.push(instance.InstanceId);
    }
  }
  return { resolvedId: allInstances[0] || 'none' };
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
    let instanceId: string | undefined;
    let resourceType: 'ec2' | 'rds' = 'ec2';

    try {
      if (req.method === 'POST') {
        const body = await req.json();
        timeRange = body.timeRange || '24h';
        forceRefresh = body.forceRefresh === true;
        includePaidMetrics = body.includePaidMetrics === true;
        roleName = body.roleName;
        instanceId = body.instanceId;
        if (body.resourceType === 'rds') resourceType = 'rds';
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get AWS credentials
    const { data: creds, error: credsError } = await supabaseClient
      .rpc('get_user_aws_credentials', { user_id_param: user.id });

    if (credsError || !creds || creds.length === 0) {
      return new Response(JSON.stringify({ error: 'AWS credentials not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const awsCredsRaw = creds[0];
    const region = awsCredsRaw.region || 'us-east-1';

    const { credentials: awsCreds } = await resolveCredentials(
      supabaseClient, user.id, user.email || '',
      { accessKeyId: awsCredsRaw.access_key_id, secretAccessKey: awsCredsRaw.secret_access_key },
      region, roleName
    );

    // Create EC2 client (needed for validation even if resourceType is rds)
    const { EC2Client } = await import("npm:@aws-sdk/client-ec2@3.451.0");
    const ec2Client = new EC2Client({ region, credentials: awsCreds });

    // Validate & resolve instance
    const { resolvedId, error: validationError } = await validateAndResolveInstance(
      ec2Client, resourceType, instanceId, awsCreds, region
    );

    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache
    if (!forceRefresh) {
      const cached = await getCachedMetrics(supabaseClient, user.id, timeRange, resolvedId, resourceType);
      if (cached) {
        return new Response(JSON.stringify(cached), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const cloudWatchClient = new CloudWatchClient({ region, credentials: awsCreds });
    const { startTime, period, cacheTTLMinutes } = getTimeRangeParams(timeRange, resourceType);
    const endTime = new Date();

    const fetchMetric = async (namespace: string, metricName: string, dimensionName: string, dimensionValue: string): Promise<MetricDataPoint[]> => {
      try {
        const command = new GetMetricStatisticsCommand({
          Namespace: namespace,
          MetricName: metricName,
          Dimensions: dimensionValue ? [{ Name: dimensionName, Value: dimensionValue }] : undefined,
          StartTime: startTime,
          EndTime: endTime,
          Period: period,
          Statistics: ['Average'],
        });
        const response = await cloudWatchClient.send(command);
        return (response.Datapoints || [])
          .sort((a: any, b: any) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0))
          .map((dp: any) => ({
            timestamp: dp.Timestamp?.toISOString() || '',
            value: Math.round((dp.Average || 0) * 100) / 100,
          }));
      } catch (err: any) {
        console.log(`Could not fetch ${namespace}/${metricName}: ${err.message}`);
        return [];
      }
    };

    let result: MonitoringResult;

    if (resourceType === 'rds') {
      // RDS metrics
      const freeMetrics = await Promise.all([
        fetchMetric('AWS/RDS', 'CPUUtilization', 'DBInstanceIdentifier', resolvedId),
        fetchMetric('AWS/RDS', 'DatabaseConnections', 'DBInstanceIdentifier', resolvedId),
        fetchMetric('AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', resolvedId),
      ]);

      const paidMetrics = includePaidMetrics ? await Promise.all([
        fetchMetric('AWS/RDS', 'ReadLatency', 'DBInstanceIdentifier', resolvedId),
        fetchMetric('AWS/RDS', 'WriteLatency', 'DBInstanceIdentifier', resolvedId),
      ]) : [[], []];

      console.log(`RDS metrics (${timeRange}): ${freeMetrics[0].length} CPU, ${freeMetrics[1].length} Connections, ${freeMetrics[2].length} Storage`);

      result = {
        cpu: freeMetrics[0],
        networkIn: [],
        networkOut: [],
        databaseConnections: freeMetrics[1],
        freeStorageSpace: freeMetrics[2],
        readLatency: includePaidMetrics ? paidMetrics[0] : undefined,
        writeLatency: includePaidMetrics ? paidMetrics[1] : undefined,
        fromCache: false,
        timeRange,
        resourceType: 'rds',
        instanceId: resolvedId,
        cachedAt: new Date().toISOString(),
      };
    } else {
      // EC2 metrics
      const freeMetrics = await Promise.all([
        fetchMetric('AWS/EC2', 'CPUUtilization', 'InstanceId', resolvedId),
        fetchMetric('AWS/EC2', 'NetworkIn', 'InstanceId', resolvedId),
        fetchMetric('AWS/EC2', 'NetworkOut', 'InstanceId', resolvedId),
      ]);

      const paidMetrics = includePaidMetrics ? await Promise.all([
        fetchMetric('AWS/EC2', 'DiskReadOps', 'InstanceId', resolvedId),
        fetchMetric('AWS/EC2', 'DiskWriteOps', 'InstanceId', resolvedId),
        fetchMetric('AWS/EC2', 'StatusCheckFailed', 'InstanceId', resolvedId),
      ]) : [[], [], []];

      console.log(`EC2 metrics (${timeRange}): ${freeMetrics[0].length} CPU, ${freeMetrics[1].length} NetIn, ${freeMetrics[2].length} NetOut`);

      result = {
        cpu: freeMetrics[0],
        networkIn: freeMetrics[1],
        networkOut: freeMetrics[2],
        diskReadOps: includePaidMetrics ? paidMetrics[0] : undefined,
        diskWriteOps: includePaidMetrics ? paidMetrics[1] : undefined,
        statusCheckFailed: includePaidMetrics ? paidMetrics[2] : undefined,
        fromCache: false,
        timeRange,
        resourceType: 'ec2',
        instanceId: resolvedId,
        cachedAt: new Date().toISOString(),
      };
    }

    await saveCachedMetrics(supabaseClient, user.id, timeRange, resolvedId, resourceType, result, cacheTTLMinutes);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Monitoring metrics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
