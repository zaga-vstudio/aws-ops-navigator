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

export interface RoleAuditEntry {
  id: string;
  action: string;
  role_name: string;
  role_arn: string | null;
  details: any;
  created_at: string;
}

interface ServicePermission {
  service: string;
  read: boolean;
  write: boolean;
}

export function useCloudHubRoles() {
  const [roles, setRoles] = useState<CloudHubRole[]>([]);
  const [auditLog, setAuditLog] = useState<RoleAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
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

  const createRole = async (
    roleName: string,
    description: string,
    maxDuration: number,
    permissions: ServicePermission[]
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-cloudhub-roles", {
        body: {
          action: "create",
          roleName,
          description,
          maxSessionDuration: maxDuration,
          permissions: permissions.filter(p => p.read || p.write),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Role Created",
        description: `Role "${data.roleName}" created in AWS with ARN: ${data.roleArn}`,
      });
      await fetchRoles();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const deleteRole = async (id: string, deleteFromAWS: boolean = false) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-cloudhub-roles", {
        body: { action: "delete", roleId: id, deleteFromAWS },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const msg = deleteFromAWS && data?.awsDeleted
        ? "Role deleted from CloudHub and AWS."
        : deleteFromAWS && !data?.awsDeleted
        ? `Role removed from CloudHub. AWS deletion failed: ${data?.error || "unknown error"}`
        : "Role removed from CloudHub.";

      toast({ title: "Role Deleted", description: msg });
      await fetchRoles();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const fetchAuditLog = useCallback(async () => {
    try {
      setAuditLoading(true);
      const { data, error } = await supabase.functions.invoke("manage-cloudhub-roles", {
        body: { action: "listAuditLog" },
      });
      if (error) throw error;
      setAuditLog(data?.auditLog || []);
    } catch (err: any) {
      console.error("Error fetching audit log:", err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, fetchRoles, createRole, deleteRole, auditLog, auditLoading, fetchAuditLog };
}
