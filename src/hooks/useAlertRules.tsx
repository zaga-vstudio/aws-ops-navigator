import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  metric: string;
  threshold: number;
  duration: number;
  severity: string;
  enabled: boolean;
  cloudwatch_alarm_name: string | null;
  comparison_operator: string;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  user_id: string;
  alert_rule_id: string | null;
  cloudwatch_alarm_name: string | null;
  alert_name: string;
  metric: string;
  threshold: number | null;
  current_value: number | null;
  state_value: string | null;
  severity: string;
  event_type: string;
  notification_results: Record<string, any>;
  created_at: string;
}

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [history, setHistory] = useState<AlertHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [thisMonthCount, setThisMonthCount] = useState(0);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules((data as AlertRule[]) || []);
    } catch (error: any) {
      console.error('Error fetching alert rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch alert rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchHistory = useCallback(async (limit = 50) => {
    try {
      setHistoryLoading(true);
      const { data, error } = await supabase
        .from('alert_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      setHistory((data as AlertHistoryEntry[]) || []);
    } catch (error: any) {
      console.error('Error fetching alert history:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchThisMonthCount = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count, error } = await supabase
        .from('alert_history')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth)
        .eq('event_type', 'triggered');

      if (!error) {
        setThisMonthCount(count || 0);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchHistory();
    fetchThisMonthCount();
  }, [fetchRules, fetchHistory, fetchThisMonthCount]);

  const acknowledgeAlert = async (alarm: { id: string; name: string; metric: string; threshold?: number; severity: string }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('alert_history')
        .insert({
          user_id: session.user.id,
          alert_name: alarm.name,
          metric: alarm.metric,
          threshold: alarm.threshold || null,
          severity: alarm.severity,
          event_type: 'acknowledged',
          state_value: 'ALARM',
        });

      if (error) throw error;
      await fetchHistory();
      await fetchThisMonthCount();
      return true;
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  };

  const createRule = async (ruleData: {
    name: string;
    metric: string;
    threshold: string;
    duration: string;
    severity: string;
    comparison_operator: string;
  }) => {
    try {
      setActionLoading('create');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('manage-alert-rules', {
        body: {
          action: 'create',
          ...ruleData,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: 'Alert Rule Created',
        description: `${ruleData.name} has been created and is now monitoring your resources.`,
      });

      await fetchRules();
      return true;
    } catch (error: any) {
      console.error('Error creating alert rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create alert rule',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      setActionLoading(ruleId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('manage-alert-rules', {
        body: {
          action: 'delete',
          ruleId,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: 'Alert Rule Deleted',
        description: 'The alert rule has been removed.',
      });

      await fetchRules();
    } catch (error: any) {
      console.error('Error deleting alert rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete alert rule',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      setActionLoading(ruleId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('manage-alert-rules', {
        body: {
          action: 'toggle',
          ruleId,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: 'Alert Rule Updated',
        description: response.data.message,
      });

      await fetchRules();
    } catch (error: any) {
      console.error('Error toggling alert rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle alert rule',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const updateRule = async (ruleId: string, updates: {
    threshold: string;
    duration: string;
    severity: string;
    comparison_operator: string;
  }) => {
    try {
      setActionLoading('update');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('manage-alert-rules', {
        body: {
          action: 'update',
          ruleId,
          ...updates,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      toast({
        title: 'Alert Rule Updated',
        description: 'The alert rule has been updated successfully.',
      });

      await fetchRules();
      return true;
    } catch (error: any) {
      console.error('Error updating alert rule:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update alert rule',
        variant: 'destructive',
      });
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  return {
    rules,
    loading,
    actionLoading,
    history,
    historyLoading,
    thisMonthCount,
    fetchRules,
    fetchHistory,
    fetchThisMonthCount,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    acknowledgeAlert,
  };
}
