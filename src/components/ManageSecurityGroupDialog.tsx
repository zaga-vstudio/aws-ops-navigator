import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ManageSecurityGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  securityGroup: any;
  onSuccess: () => void;
}

export function ManageSecurityGroupDialog({
  open,
  onOpenChange,
  securityGroup,
  onSuccess,
}: ManageSecurityGroupDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [ruleType, setRuleType] = useState<'ingress' | 'egress'>('ingress');
  const [ipProtocol, setIpProtocol] = useState('tcp');
  const [fromPort, setFromPort] = useState('');
  const [toPort, setToPort] = useState('');
  const [cidrIp, setCidrIp] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('manage-security-groups', {
        body: {
          groupId: securityGroup.id,
          action,
          ruleType,
          ipProtocol,
          fromPort: fromPort ? parseInt(fromPort) : undefined,
          toPort: toPort ? parseInt(toPort) : undefined,
          cidrIp: cidrIp || undefined,
          reason
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Success",
        description: "Security group rule updated successfully. Changes may take a moment to reflect.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating security group:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update security group",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Security Group Rules</DialogTitle>
          <DialogDescription>
            Add or remove rules for {securityGroup?.name} ({securityGroup?.id})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="action">Action</Label>
              <Select value={action} onValueChange={(value: 'add' | 'remove') => setAction(value)}>
                <SelectTrigger id="action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Rule</SelectItem>
                  <SelectItem value="remove">Remove Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleType">Rule Type</Label>
              <Select value={ruleType} onValueChange={(value: 'ingress' | 'egress') => setRuleType(value)}>
                <SelectTrigger id="ruleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingress">Inbound (Ingress)</SelectItem>
                  <SelectItem value="egress">Outbound (Egress)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="protocol">Protocol</Label>
            <Select value={ipProtocol} onValueChange={setIpProtocol}>
              <SelectTrigger id="protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
                <SelectItem value="icmp">ICMP</SelectItem>
                <SelectItem value="-1">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {ipProtocol !== '-1' && ipProtocol !== 'icmp' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromPort">From Port</Label>
                <Input
                  id="fromPort"
                  type="number"
                  placeholder="e.g., 22"
                  value={fromPort}
                  onChange={(e) => setFromPort(e.target.value)}
                  min="0"
                  max="65535"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toPort">To Port</Label>
                <Input
                  id="toPort"
                  type="number"
                  placeholder="e.g., 22"
                  value={toPort}
                  onChange={(e) => setToPort(e.target.value)}
                  min="0"
                  max="65535"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cidrIp">CIDR IP Range</Label>
            <Input
              id="cidrIp"
              placeholder="e.g., 0.0.0.0/0 or 10.0.0.0/16"
              value={cidrIp}
              onChange={(e) => setCidrIp(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Warning: 0.0.0.0/0 allows access from anywhere. Use specific IPs when possible.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Change *</Label>
            <Textarea
              id="reason"
              placeholder="Explain why this change is needed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'add' ? 'Add Rule' : 'Remove Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
