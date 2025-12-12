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
  created_at: string;
  updated_at: string;
}

export function useAlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (ruleData: {
    name: string;
    metric: string;
    threshold: string;
    duration: string;
    severity: string;
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

  return {
    rules,
    loading,
    actionLoading,
    fetchRules,
    createRule,
    deleteRule,
    toggleRule,
  };
}
