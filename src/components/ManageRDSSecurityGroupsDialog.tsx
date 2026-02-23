import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { SecurityGroup, RDSDatabase } from "@/hooks/useAWSData";

interface ManageRDSSecurityGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  database: RDSDatabase;
  securityGroups: SecurityGroup[];
}

export function ManageRDSSecurityGroupsDialog({
  open,
  onOpenChange,
  onSuccess,
  database,
  securityGroups,
}: ManageRDSSecurityGroupsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Initialize with current SGs when dialog opens
  useEffect(() => {
    if (open && database.vpcSecurityGroups) {
      setSelectedIds(database.vpcSecurityGroups.map((sg) => sg.id));
    }
  }, [open, database]);

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "Error",
        description: "At least one security group is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-rds-instances", {
        body: {
          action: "modify-security-groups",
          dbInstanceIdentifier: database.id,
          vpcSecurityGroupIds: selectedIds,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Security groups updated",
        description: `Security groups for ${database.id} have been updated. Changes apply immediately.`,
      });

      onOpenChange(false);
      setTimeout(() => onSuccess(), 2000);
    } catch (error: any) {
      console.error("Modify SG error:", error);
      toast({
        title: "Failed to update security groups",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSecurityGroup = (sgId: string) => {
    setSelectedIds((prev) =>
      prev.includes(sgId) ? prev.filter((id) => id !== sgId) : [...prev, sgId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Manage Security Groups
          </DialogTitle>
          <DialogDescription>
            Update security groups for <span className="font-mono font-medium">{database.id}</span>. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current SGs */}
          {database.vpcSecurityGroups && database.vpcSecurityGroups.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Currently assigned</Label>
              <div className="flex flex-wrap gap-1">
                {database.vpcSecurityGroups.map((sg) => (
                  <Badge key={sg.id} variant="secondary" className="text-xs font-mono">
                    {sg.id}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* SG Selection */}
          <div className="space-y-2">
            <Label>Select Security Groups</Label>
            {securityGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No security groups available.</p>
            ) : (
              <div className="space-y-1 max-h-[250px] overflow-y-auto border rounded-md p-2">
                {securityGroups.map((sg) => (
                  <label
                    key={sg.id}
                    className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(sg.id)}
                      onChange={() => toggleSecurityGroup(sg.id)}
                      disabled={loading}
                      className="rounded mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{sg.name}</span>
                        <Badge variant="outline" className="text-xs font-mono shrink-0">
                          {sg.id}
                        </Badge>
                      </div>
                      {sg.description && (
                        <p className="text-xs text-muted-foreground truncate">{sg.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {sg.inboundRules.length} inbound · {sg.outboundRules.length} outbound rules
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              At least one security group must be selected.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedIds.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
