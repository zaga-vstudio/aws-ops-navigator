import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type PolicyScope = "full_readonly" | "security_only";
export type ConnectionStatus = "pending" | "connected" | "failed";

export interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  aws_account_id: string | null;
  role_arn: string | null;
  external_id: string;
  default_region: string;
  policy_scope: PolicyScope;
  connection_status: ConnectionStatus;
  last_verified_at: string | null;
  last_error: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditorIdentity {
  id: string;
  auditor_role_arn: string;
  aws_account_id: string | null;
  verified: boolean;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface AccessLogEvent {
  id: string;
  client_id: string | null;
  client_name_snapshot: string | null;
  actor_email: string | null;
  role_arn: string | null;
  region: string | null;
  operation: string;
  outcome: "success" | "denied" | "error";
  error_message: string | null;
  session_expiry: string | null;
  created_at: string;
}

export interface TestConnectionResult {
  success: boolean;
  awsAccountId?: string;
  assumedArn?: string;
  sessionExpiry?: string;
  attachedPolicies?: string[] | null;
  missingPolicies?: string[];
  error?: string;
}

type Action =
  | { action: "list" }
  | { action: "create"; client: Partial<Client> }
  | { action: "update"; clientId: string; client: Partial<Client> }
  | { action: "delete"; clientId: string }
  | { action: "rotate_external_id"; clientId: string }
  | { action: "test_connection"; clientId: string }
  | { action: "get_auditor" }
  | { action: "save_auditor"; auditorRoleArn: string }
  | { action: "verify_auditor" }
  | { action: "access_log"; clientId?: string };

export function useClients() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [auditor, setAuditor] = useState<AuditorIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async <T,>(body: Action): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("manage-clients", { body });
    if (error) {
      // Edge function errors carry the useful message in the response body
      let message = error.message;
      try {
        const ctx = (error as unknown as { context?: Response }).context;
        if (ctx) {
          const parsed = await ctx.json();
          if (parsed?.error) message = parsed.error;
        }
      } catch (_) {
        // keep the generic message
      }
      throw new Error(message);
    }
    if (data && data.error) throw new Error(data.error);
    return data as T;
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, aud] = await Promise.all([
        call<{ clients: Client[] }>({ action: "list" }),
        call<{ auditor: AuditorIdentity | null }>({ action: "get_auditor" }),
      ]);
      setClients(list.clients ?? []);
      setAuditor(aud.auditor ?? null);
    } catch (e) {
      toast({
        title: "No se pudieron cargar los clientes",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [call, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const withBusy = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createClient = (client: Partial<Client>) =>
    withBusy(async () => {
      const res = await call<{ client: Client }>({ action: "create", client });
      setClients((prev) => [res.client, ...prev]);
      return res.client;
    });

  const updateClient = (clientId: string, client: Partial<Client>) =>
    withBusy(async () => {
      const res = await call<{ client: Client }>({ action: "update", clientId, client });
      setClients((prev) => prev.map((c) => (c.id === clientId ? res.client : c)));
      return res.client;
    });

  const deleteClient = (clientId: string) =>
    withBusy(async () => {
      await call({ action: "delete", clientId });
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      toast({ title: "Cliente eliminado" });
      return true;
    });

  const rotateExternalId = (clientId: string) =>
    withBusy(async () => {
      const res = await call<{ client: Client }>({ action: "rotate_external_id", clientId });
      setClients((prev) => prev.map((c) => (c.id === clientId ? res.client : c)));
      toast({
        title: "Identificador renovado",
        description: "El cliente debe actualizar la política de confianza del rol.",
      });
      return res.client;
    });

  const testConnection = async (clientId: string): Promise<TestConnectionResult> => {
    setBusy(true);
    try {
      const res = await call<TestConnectionResult>({ action: "test_connection", clientId });
      await fetchAll();
      return { ...res, success: true };
    } catch (e) {
      await fetchAll();
      return { success: false, error: (e as Error).message };
    } finally {
      setBusy(false);
    }
  };

  const saveAuditor = (auditorRoleArn: string) =>
    withBusy(async () => {
      const res = await call<{ auditor: AuditorIdentity }>({ action: "save_auditor", auditorRoleArn });
      setAuditor(res.auditor);
      return res.auditor;
    });

  const verifyAuditor = async (): Promise<{ verified: boolean; error?: string }> => {
    setBusy(true);
    try {
      const res = await call<{ verified: boolean }>({ action: "verify_auditor" });
      await fetchAll();
      return { verified: !!res.verified };
    } catch (e) {
      await fetchAll();
      return { verified: false, error: (e as Error).message };
    } finally {
      setBusy(false);
    }
  };

  const fetchAccessLog = useCallback(
    async (clientId?: string): Promise<AccessLogEvent[]> => {
      try {
        const res = await call<{ events: AccessLogEvent[] }>({ action: "access_log", clientId });
        return res.events ?? [];
      } catch (e) {
        toast({
          title: "No se pudo cargar el registro de accesos",
          description: (e as Error).message,
          variant: "destructive",
        });
        return [];
      }
    },
    [call, toast]
  );

  return {
    clients,
    auditor,
    loading,
    busy,
    refetch: fetchAll,
    createClient,
    updateClient,
    deleteClient,
    rotateExternalId,
    testConnection,
    saveAuditor,
    verifyAuditor,
    fetchAccessLog,
  };
}
