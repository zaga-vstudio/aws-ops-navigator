import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeAWSFunction } from "@/lib/invokeAWS";
import { useToast } from "@/hooks/use-toast";
import { useClientContext } from "@/contexts/ClientContext";

export type CISStatus = "PASS" | "FAIL" | "NOT_APPLICABLE" | "ERROR";
export type CISSeverity = "critical" | "high" | "medium" | "low";

export interface CISCheckResult {
  id: string;
  title: string;
  section: string;
  severity: CISSeverity;
  status: CISStatus;
  summary: string;
  remediation: string;
  evidence: string[];
}

export interface CISAuditRun {
  id: string;
  client_id: string | null;
  client_name_snapshot: string | null;
  aws_account_id: string | null;
  region: string;
  benchmark: string;
  score: number;
  passed_count: number;
  failed_count: number;
  not_applicable_count: number;
  error_count: number;
  results: CISCheckResult[];
  errors: { check: string; message: string }[] | null;
  created_at: string;
}

export function useCISAudit() {
  const { activeClient } = useClientContext();
  const { toast } = useToast();
  const [runs, setRuns] = useState<CISAuditRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("cis_audit_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    query = activeClient ? query.eq("client_id", activeClient.id) : query.is("client_id", null);

    const { data, error } = await query;
    if (!error && data) setRuns(data as unknown as CISAuditRun[]);
    setLoading(false);
  }, [activeClient]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const runAudit = useCallback(async (): Promise<CISAuditRun | null> => {
    setRunning(true);
    try {
      const { data, error } = await invokeAWSFunction("run-cis-audit", { body: {} });
      if (error) {
        const message = (data as { error?: string } | null)?.error ||
          "No se pudo ejecutar la auditoría CIS.";
        toast({ title: "Auditoría fallida", description: message, variant: "destructive" });
        return null;
      }
      const run = (data as { run?: CISAuditRun })?.run ?? null;
      if (run) {
        setRuns((prev) => [run, ...prev]);
        toast({
          title: "Auditoría completada",
          description: `Puntuación ${run.score}% · ${run.failed_count} controles fallidos.`,
        });
      }
      return run;
    } finally {
      setRunning(false);
    }
  }, [toast]);

  const deleteRun = useCallback(async (id: string) => {
    const { error } = await supabase.from("cis_audit_runs").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "No se pudo borrar la auditoría.", variant: "destructive" });
      return;
    }
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, [toast]);

  return { runs, loading, running, runAudit, deleteRun, refetch: fetchRuns };
}
