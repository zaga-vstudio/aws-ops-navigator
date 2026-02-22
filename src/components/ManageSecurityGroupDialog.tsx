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
import { z } from "zod";

const COMMON_PROTOCOLS = [
  { label: "SSH", protocol: "tcp", fromPort: "22", toPort: "22" },
  { label: "HTTP", protocol: "tcp", fromPort: "80", toPort: "80" },
  { label: "HTTPS", protocol: "tcp", fromPort: "443", toPort: "443" },
  { label: "MySQL/Aurora", protocol: "tcp", fromPort: "3306", toPort: "3306" },
  { label: "PostgreSQL", protocol: "tcp", fromPort: "5432", toPort: "5432" },
  { label: "Redis", protocol: "tcp", fromPort: "6379", toPort: "6379" },
  { label: "RDP", protocol: "tcp", fromPort: "3389", toPort: "3389" },
  { label: "DNS (TCP)", protocol: "tcp", fromPort: "53", toPort: "53" },
  { label: "DNS (UDP)", protocol: "udp", fromPort: "53", toPort: "53" },
  { label: "SMTP", protocol: "tcp", fromPort: "25", toPort: "25" },
  { label: "NFS", protocol: "tcp", fromPort: "2049", toPort: "2049" },
  { label: "Custom TCP", protocol: "tcp", fromPort: "", toPort: "" },
  { label: "Custom UDP", protocol: "udp", fromPort: "", toPort: "" },
  { label: "All ICMP", protocol: "icmp", fromPort: "", toPort: "" },
  { label: "All Traffic", protocol: "-1", fromPort: "", toPort: "" },
];

// Validation schema for security group rules
const securityGroupSchema = z.object({
  fromPort: z.number().min(0).max(65535).optional(),
  toPort: z.number().min(0).max(65535).optional(),
  cidrIp: z.string().regex(/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])(\/([0-9]|[1-2][0-9]|3[0-2]))$/, "Invalid CIDR format (e.g., 0.0.0.0/0)").optional(),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500, "Reason must be less than 500 characters"),
});

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
  const [selectedPreset, setSelectedPreset] = useState('');
  const [ipProtocol, setIpProtocol] = useState('tcp');
  const [fromPort, setFromPort] = useState('');
  const [toPort, setToPort] = useState('');
  const [cidrIp, setCidrIp] = useState('');
  const [reason, setReason] = useState('');

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    const preset = COMMON_PROTOCOLS.find(p => p.label === value);
    if (preset) {
      setIpProtocol(preset.protocol);
      setFromPort(preset.fromPort);
      setToPort(preset.toPort);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate inputs
      const validationData = {
        fromPort: fromPort ? parseInt(fromPort) : undefined,
        toPort: toPort ? parseInt(toPort) : undefined,
        cidrIp: cidrIp || undefined,
        reason,
      };

      const validationResult = securityGroupSchema.safeParse(validationData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new Error(firstError.message);
      }

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
          ...validationResult.data
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
            <Label htmlFor="preset">Rule Type / Protocol</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger id="preset">
                <SelectValue placeholder="Select a common rule..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PROTOCOLS.map((p) => (
                  <SelectItem key={p.label} value={p.label}>
                    {p.label}{p.fromPort ? ` (${p.protocol.toUpperCase()} ${p.fromPort}${p.toPort !== p.fromPort ? `-${p.toPort}` : ''})` : ` (${p.protocol === '-1' ? 'All' : p.protocol.toUpperCase()})`}
                  </SelectItem>
                ))}
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
