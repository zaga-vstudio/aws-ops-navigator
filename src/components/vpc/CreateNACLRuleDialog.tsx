import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { NACL } from "@/hooks/useVPCAdvancedData";

interface CreateNACLRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nacls: NACL[];
  onSubmit: (params: {
    networkAclId: string;
    ruleNumber: number;
    protocol: string;
    cidrBlock: string;
    ruleAction: string;
    egress: boolean;
    fromPort?: number;
    toPort?: number;
  }) => Promise<void>;
  loading: boolean;
}

export function CreateNACLRuleDialog({ open, onOpenChange, nacls, onSubmit, loading }: CreateNACLRuleDialogProps) {
  const [naclId, setNaclId] = useState('');
  const [ruleNumber, setRuleNumber] = useState('100');
  const [protocol, setProtocol] = useState('6'); // TCP
  const [cidrBlock, setCidrBlock] = useState('0.0.0.0/0');
  const [ruleAction, setRuleAction] = useState('allow');
  const [egress, setEgress] = useState('false');
  const [fromPort, setFromPort] = useState('');
  const [toPort, setToPort] = useState('');
  const [error, setError] = useState('');

  const isAllTraffic = protocol === '-1';

  const handleSubmit = async () => {
    setError('');
    const num = parseInt(ruleNumber);
    if (isNaN(num) || num < 1 || num > 32766) {
      setError('Rule number must be between 1 and 32766');
      return;
    }
    if (!naclId) { setError('Select a NACL'); return; }
    if (!cidrBlock) { setError('CIDR block is required'); return; }

    const params: any = {
      networkAclId: naclId,
      ruleNumber: num,
      protocol,
      cidrBlock,
      ruleAction,
      egress: egress === 'true',
    };

    if (!isAllTraffic) {
      const fp = parseInt(fromPort);
      const tp = parseInt(toPort);
      if (isNaN(fp) || isNaN(tp) || fp < 0 || tp < 0 || fp > 65535 || tp > 65535) {
        setError('Ports must be between 0 and 65535');
        return;
      }
      params.fromPort = fp;
      params.toPort = tp;
    }

    await onSubmit(params);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create NACL Rule</DialogTitle>
          <DialogDescription>Add a new inbound or outbound rule to a Network ACL.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Network ACL</Label>
            <Select value={naclId} onValueChange={setNaclId}>
              <SelectTrigger><SelectValue placeholder="Select NACL..." /></SelectTrigger>
              <SelectContent>
                {nacls.map(n => (
                  <SelectItem key={n.id} value={n.id}>{n.name} ({n.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rule Number</Label>
              <Input type="number" value={ruleNumber} onChange={e => setRuleNumber(e.target.value)} min={1} max={32766} />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={egress} onValueChange={setEgress}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Inbound</SelectItem>
                  <SelectItem value="true">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">All Traffic</SelectItem>
                  <SelectItem value="6">TCP</SelectItem>
                  <SelectItem value="17">UDP</SelectItem>
                  <SelectItem value="1">ICMP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={ruleAction} onValueChange={setRuleAction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {!isAllTraffic && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Port</Label>
                <Input type="number" value={fromPort} onChange={e => setFromPort(e.target.value)} min={0} max={65535} placeholder="e.g. 80" />
              </div>
              <div className="space-y-2">
                <Label>To Port</Label>
                <Input type="number" value={toPort} onChange={e => setToPort(e.target.value)} min={0} max={65535} placeholder="e.g. 80" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>CIDR Block</Label>
            <Input value={cidrBlock} onChange={e => setCidrBlock(e.target.value)} placeholder="0.0.0.0/0" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
