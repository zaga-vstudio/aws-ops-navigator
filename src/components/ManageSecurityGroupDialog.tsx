import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";

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

interface ExistingRule {
  protocol: string;
  fromPort: number;
  toPort: number;
  cidr: string;
  type: 'ingress' | 'egress';
}

function extractRules(securityGroup: any): ExistingRule[] {
  const rules: ExistingRule[] = [];
  if (securityGroup?.inboundRules) {
    for (const rule of securityGroup.inboundRules) {
      const cidrs = rule.ipRanges?.map((r: any) => r.cidrIp || r.CidrIp) || 
                    rule.IpRanges?.map((r: any) => r.CidrIp) || [];
      for (const cidr of cidrs) {
        rules.push({
          protocol: rule.ipProtocol || rule.IpProtocol || '-1',
          fromPort: rule.fromPort ?? rule.FromPort ?? 0,
          toPort: rule.toPort ?? rule.ToPort ?? 0,
          cidr,
          type: 'ingress',
        });
      }
    }
  }
  if (securityGroup?.outboundRules) {
    for (const rule of securityGroup.outboundRules) {
      const cidrs = rule.ipRanges?.map((r: any) => r.cidrIp || r.CidrIp) || 
                    rule.IpRanges?.map((r: any) => r.CidrIp) || [];
      for (const cidr of cidrs) {
        rules.push({
          protocol: rule.ipProtocol || rule.IpProtocol || '-1',
          fromPort: rule.fromPort ?? rule.FromPort ?? 0,
          toPort: rule.toPort ?? rule.ToPort ?? 0,
          cidr,
          type: 'egress',
        });
      }
    }
  }
  return rules;
}

function formatProtocol(protocol: string, fromPort: number, toPort: number): string {
  if (protocol === '-1') return 'All Traffic';
  if (protocol === 'icmp') return 'ICMP';
  const preset = COMMON_PROTOCOLS.find(
    p => p.protocol === protocol && p.fromPort === String(fromPort) && p.toPort === String(toPort)
  );
  if (preset) return preset.label;
  const portStr = fromPort === toPort ? String(fromPort) : `${fromPort}-${toPort}`;
  return `${protocol.toUpperCase()} ${portStr}`;
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
  const [selectedRuleIndex, setSelectedRuleIndex] = useState<number | null>(null);

  const existingRules = extractRules(securityGroup);

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
      let submitData: any;

      if (action === 'remove') {
        if (selectedRuleIndex === null) {
          throw new Error('Please select a rule to remove');
        }
        const rule = existingRules[selectedRuleIndex];
        const reasonValidation = z.string().min(10, "Reason must be at least 10 characters").max(500).safeParse(reason);
        if (!reasonValidation.success) throw new Error(reasonValidation.error.errors[0].message);

        submitData = {
          groupId: securityGroup.id,
          action: 'remove',
          ruleType: rule.type,
          ipProtocol: rule.protocol,
          fromPort: rule.fromPort,
          toPort: rule.toPort,
          cidrIp: rule.cidr,
          reason,
        };
      } else {
        const validationData = {
          fromPort: fromPort ? parseInt(fromPort) : undefined,
          toPort: toPort ? parseInt(toPort) : undefined,
          cidrIp: cidrIp || undefined,
          reason,
        };
        const validationResult = securityGroupSchema.safeParse(validationData);
        if (!validationResult.success) {
          throw new Error(validationResult.error.errors[0].message);
        }
        submitData = {
          groupId: securityGroup.id,
          action: 'add',
          ruleType,
          ipProtocol,
          ...validationResult.data,
        };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await supabase.functions.invoke('manage-security-groups', {
        body: submitData,
      });

      if (response.error) throw response.error;

      toast({
        title: "Success",
        description: `Security group rule ${action === 'add' ? 'added' : 'removed'} successfully.`,
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
          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup
              value={action}
              onValueChange={(v: 'add' | 'remove') => { setAction(v); setSelectedRuleIndex(null); }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="add" id="action-add" />
                <Label htmlFor="action-add" className="font-normal cursor-pointer">Add Rule</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="remove" id="action-remove" />
                <Label htmlFor="action-remove" className="font-normal cursor-pointer">Remove Rule</Label>
              </div>
            </RadioGroup>
          </div>

          {action === 'add' ? (
            <>
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
                    <Input id="fromPort" type="number" placeholder="e.g., 22" value={fromPort} onChange={(e) => setFromPort(e.target.value)} min="0" max="65535" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toPort">To Port</Label>
                    <Input id="toPort" type="number" placeholder="e.g., 22" value={toPort} onChange={(e) => setToPort(e.target.value)} min="0" max="65535" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cidrIp">CIDR IP Range</Label>
                <Input id="cidrIp" placeholder="e.g., 0.0.0.0/0 or 10.0.0.0/16" value={cidrIp} onChange={(e) => setCidrIp(e.target.value)} />
                <p className="text-sm text-muted-foreground">
                  Warning: 0.0.0.0/0 allows access from anywhere. Use specific IPs when possible.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Label>Select a rule to remove</Label>
              {existingRules.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
                  <Shield className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No rules found for this security group.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {existingRules.map((rule, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedRuleIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent/50",
                        selectedRuleIndex === idx && "border-primary bg-primary/5 ring-1 ring-primary"
                      )}
                    >
                      <div className="shrink-0">
                        {rule.type === 'ingress' ? (
                          <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4 text-orange-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {formatProtocol(rule.protocol, rule.fromPort, rule.toPort)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {rule.type === 'ingress' ? 'Inbound' : 'Outbound'} · {rule.cidr}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {rule.protocol === '-1' ? 'All' : `${rule.fromPort}-${rule.toPort}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || (action === 'remove' && selectedRuleIndex === null)}
              variant={action === 'remove' ? 'destructive' : 'default'}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'add' ? 'Add Rule' : 'Remove Rule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
