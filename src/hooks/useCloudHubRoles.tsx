import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CloudHubRole {
  id: string;
  role_name: string;
  role_arn: string;
  description: string | null;
  max_session_duration_seconds: number;
  created_at: string;
}

export function useCloudHubRoles() {
  const [roles, setRoles] = useState<CloudHubRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("cloudhub_roles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRoles(data || []);
    } catch (err: any) {
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = async (roleName: string, roleArn: string, description: string, maxDuration: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("cloudhub_roles").insert({
        user_id: user.id,
        role_name: roleName,
        role_arn: roleArn,
        description: description || null,
        max_session_duration_seconds: maxDuration,
      });

      if (error) throw error;

      toast({ title: "Role Created", description: `Role "${roleName}" has been registered.` });
      await fetchRoles();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const deleteRole = async (id: string) => {
    try {
      const { error } = await supabase.from("cloudhub_roles").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "Role Deleted", description: "The role has been removed." });
      await fetchRoles();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, fetchRoles, createRole, deleteRole };
}
