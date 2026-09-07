import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setActiveClientIdRef } from "@/lib/activeClientStore";

export interface ActiveClientSummary {
  id: string;
  name: string;
  default_region: string;
  connection_status: "pending" | "connected" | "failed";
}

interface ClientContextType {
  /** null = tu propia cuenta AWS */
  activeClient: ActiveClientSummary | null;
  clients: ActiveClientSummary[];
  loading: boolean;
  setActiveClient: (client: ActiveClientSummary | null) => void;
  reloadClients: () => Promise<void>;
}

const STORAGE_KEY = "clodaro.activeClientId";

const ClientContext = createContext<ClientContextType | null>(null);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<ActiveClientSummary[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const reloadClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, default_region, connection_status")
      .order("name", { ascending: true });
    if (!error && data) setClients(data as ActiveClientSummary[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    reloadClients();
  }, [reloadClients]);

  const setActiveClient = useCallback((client: ActiveClientSummary | null) => {
    setActiveClientId(client?.id ?? null);
    if (client) localStorage.setItem(STORAGE_KEY, client.id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    setActiveClientIdRef(activeClientId);
  }, [activeClientId]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) ?? null,
    [clients, activeClientId]
  );

  return (
    <ClientContext.Provider
      value={{ activeClient, clients, loading, setActiveClient, reloadClients }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClientContext must be used within a ClientProvider");
  return ctx;
}
