import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DriftEvent {
  id: string;
  resource_type: string;
  resource_id: string;
  resource_name: string | null;
  previous_hash: string;
  current_hash: string;
  changes: { field: string; previous: any; current: any }[];
  detected_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  severity: 'info' | 'warning' | 'critical';
}

export function useDriftDetection() {
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const fetchDriftEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('drift_events')
        .select('*')
        .order('detected_at', { ascending: false });

      if (error) throw error;
      
      // Cast changes JSON to the expected type
      const events = (data || []).map(d => ({
        ...d,
        changes: d.changes as unknown as { field: string; previous: any; current: any }[],
        severity: d.severity as 'info' | 'warning' | 'critical',
        resource_name: d.resource_name || null,
        acknowledged_at: d.acknowledged_at || null,
      }));
      
      setDriftEvents(events);
    } catch (error: any) {
      console.error('Error fetching drift events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const scanForDrift = useCallback(async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to scan for drift");
        return { success: false };
      }

      const { data, error } = await supabase.functions.invoke('detect-drift', {
        body: { action: 'scan' }
      });

      if (error) throw error;

      if (data.success) {
        setDriftEvents(data.driftEvents || []);
        setLastScan(new Date());
        
        if (data.newDriftCount > 0) {
          toast.warning(`Detected ${data.newDriftCount} new drift event(s)`, {
            description: "Resources were changed outside of CloudHub"
          });
        } else {
          toast.success("Drift scan complete", {
            description: `Scanned ${data.resourcesScanned} resources, no new drift detected`
          });
        }
        
        return { success: true, newDriftCount: data.newDriftCount };
      }

      return { success: false };
    } catch (error: any) {
      console.error('Error scanning for drift:', error);
      toast.error("Failed to scan for drift", {
        description: error.message
      });
      return { success: false };
    } finally {
      setScanning(false);
    }
  }, []);

  const acknowledgeDrift = useCallback(async (driftId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-drift', {
        body: { action: 'acknowledge', driftId }
      });

      if (error) throw error;

      if (data.success) {
        setDriftEvents(prev => 
          prev.map(d => d.id === driftId ? { ...d, acknowledged: true, acknowledged_at: new Date().toISOString() } : d)
        );
        toast.success("Drift acknowledged");
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error acknowledging drift:', error);
      toast.error("Failed to acknowledge drift");
      return false;
    }
  }, []);

  const acceptDrift = useCallback(async (driftId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-drift', {
        body: { action: 'accept', driftId }
      });

      if (error) throw error;

      if (data.success) {
        setDriftEvents(prev => 
          prev.map(d => d.id === driftId ? { ...d, acknowledged: true, acknowledged_at: new Date().toISOString() } : d)
        );
        toast.success("Drift accepted", {
          description: "Baseline updated to current state"
        });
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error accepting drift:', error);
      toast.error("Failed to accept drift");
      return false;
    }
  }, []);

  useEffect(() => {
    fetchDriftEvents();
  }, [fetchDriftEvents]);

  const unacknowledgedCount = driftEvents.filter(d => !d.acknowledged).length;
  const criticalCount = driftEvents.filter(d => !d.acknowledged && d.severity === 'critical').length;

  return {
    driftEvents,
    loading,
    scanning,
    lastScan,
    unacknowledgedCount,
    criticalCount,
    scanForDrift,
    acknowledgeDrift,
    acceptDrift,
    refresh: fetchDriftEvents,
  };
}
