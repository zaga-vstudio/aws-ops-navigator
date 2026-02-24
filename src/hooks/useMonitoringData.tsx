import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface MonitoringData {
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

export const useMonitoringData = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMetrics = useCallback(async (
    timeRange: string = '24h',
    options: {
      forceRefresh?: boolean;
      includePaidMetrics?: boolean;
      instanceId?: string;
      resourceType?: 'ec2' | 'rds';
    } = {}
  ) => {
    const { forceRefresh = false, includePaidMetrics = false, instanceId, resourceType = 'ec2' } = options;
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data: response, error: fnError } = await supabase.functions.invoke(
        'monitoring-metrics',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { timeRange, forceRefresh, includePaidMetrics, instanceId, resourceType },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (response?.error) throw new Error(response.error);

      setData(response);
    } catch (err: any) {
      const msg = err.message || 'Failed to fetch monitoring data';
      setError(msg);
      toast({ title: 'Monitoring Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { data, loading, error, fetchMetrics };
};
