import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { CostBadge } from "./CostBadge";
import { CreateNACLRuleDialog } from "./CreateNACLRuleDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { NACL, NACLEntry } from "@/hooks/useVPCAdvancedData";

interface NACLRulesManagerProps {
  nacls: NACL[];
  loading: boolean;
  onRefresh: () => void;
}

const formatProtocol = (protocol: string): string => {
  if (protocol === "-1") return "All";
  if (protocol === "6") return "TCP";
  if (protocol === "17") return "UDP";
  if (protocol === "1") return "ICMP";
  return protocol.toUpperCase();
};

export function NACLRulesManager({ nacls, loading, onRefresh }: NACLRulesManagerProps) {
  const { toast } = useToast();
  const [selectedNacl, setSelectedNacl] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ naclId: string; ruleNumber: number; egress: boolean } | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ naclId: string; original: NACLEntry } | null>(null);
  const [editValues, setEditValues] = useState({ protocol: '', cidrBlock: '', ruleAction: '', fromPort: '', toPort: '' });

  const currentNacl = nacls.find(n => n.id === selectedNacl);
  const entries = currentNacl?.entries.filter(e => e.ruleNumber !== 32767).sort((a, b) => a.ruleNumber - b.ruleNumber) || [];
  const inboundEntries = entries.filter(e => !e.egress);
  const outboundEntries = entries.filter(e => e.egress);

  const callEdgeFunction = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-nacl-rules', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async (params: any) => {
    try {
      await callEdgeFunction({ action: 'create', ...params });
      toast({ title: 'Rule created', description: `Rule #${params.ruleNumber} added successfully.` });
      setCreateOpen(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Failed to create rule', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await callEdgeFunction({
        action: 'delete',
        networkAclId: deleteTarget.naclId,
        ruleNumber: deleteTarget.ruleNumber,
        egress: deleteTarget.egress,
      });
      toast({ title: 'Rule deleted', description: `Rule #${deleteTarget.ruleNumber} removed.` });
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Failed to delete rule', description: err.message, variant: 'destructive' });
    }
  };

  const startEditing = (naclId: string, entry: NACLEntry) => {
    setEditingEntry({ naclId, original: entry });
    setEditValues({
      protocol: entry.protocol,
      cidrBlock: entry.cidrBlock,
      ruleAction: entry.ruleAction,
      fromPort: entry.portRange?.from?.toString() ?? '',
      toPort: entry.portRange?.to?.toString() ?? '',
    });
  };

  const handleUpdate = async () => {
    if (!editingEntry) return;
    const { naclId, original } = editingEntry;
    try {
      const params: any = {
        action: 'update',
        networkAclId: naclId,
        ruleNumber: original.ruleNumber,
        protocol: editValues.protocol,
        cidrBlock: editValues.cidrBlock,
        ruleAction: editValues.ruleAction,
        egress: original.egress,
      };
      if (editValues.protocol !== '-1' && editValues.fromPort && editValues.toPort) {
        params.fromPort = parseInt(editValues.fromPort);
        params.toPort = parseInt(editValues.toPort);
      }
      await callEdgeFunction(params);
      toast({ title: 'Rule updated', description: `Rule #${original.ruleNumber} updated.` });
      setEditingEntry(null);
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Failed to update rule', description: err.message, variant: 'destructive' });
    }
  };

  const isEditing = (entry: NACLEntry) =>
    editingEntry?.original.ruleNumber === entry.ruleNumber &&
    editingEntry?.original.egress === entry.egress &&
    editingEntry?.naclId === selectedNacl;

  const renderTable = (rows: NACLEntry[], direction: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{direction} Rules</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Rule #</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Port Range</TableHead>
            <TableHead>CIDR</TableHead>
            <TableHead>Action</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No {direction.toLowerCase()} rules</TableCell></TableRow>
          ) : rows.map((entry) => {
            const editing = isEditing(entry);
            return (
              <TableRow key={`${entry.ruleNumber}-${entry.egress}`}>
                <TableCell className="font-mono text-sm">{entry.ruleNumber}</TableCell>
                <TableCell>
                  {editing ? (
                    <Select value={editValues.protocol} onValueChange={v => setEditValues(p => ({ ...p, protocol: v }))}>
                      <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">All</SelectItem>
                        <SelectItem value="6">TCP</SelectItem>
                        <SelectItem value="17">UDP</SelectItem>
                        <SelectItem value="1">ICMP</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : formatProtocol(entry.protocol)}
                </TableCell>
                <TableCell>
                  {editing && editValues.protocol !== '-1' ? (
                    <div className="flex gap-1">
                      <Input className="h-8 w-16" value={editValues.fromPort} onChange={e => setEditValues(p => ({ ...p, fromPort: e.target.value }))} placeholder="From" />
                      <Input className="h-8 w-16" value={editValues.toPort} onChange={e => setEditValues(p => ({ ...p, toPort: e.target.value }))} placeholder="To" />
                    </div>
                  ) : entry.portRange ? `${entry.portRange.from}-${entry.portRange.to}` : 'All'}
                </TableCell>
                <TableCell>
                  {editing ? (
                    <Input className="h-8 w-32" value={editValues.cidrBlock} onChange={e => setEditValues(p => ({ ...p, cidrBlock: e.target.value }))} />
                  ) : <span className="font-mono text-sm">{entry.cidrBlock}</span>}
                </TableCell>
                <TableCell>
                  {editing ? (
                    <Select value={editValues.ruleAction} onValueChange={v => setEditValues(p => ({ ...p, ruleAction: v }))}>
                      <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow</SelectItem>
                        <SelectItem value="deny">Deny</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant={entry.ruleAction === 'allow' ? 'default' : 'destructive'}>{entry.ruleAction.toUpperCase()}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editing ? (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdate} disabled={actionLoading}>
                        {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-primary" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingEntry(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(selectedNacl, entry)} disabled={actionLoading}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget({ naclId: selectedNacl, ruleNumber: entry.ruleNumber, egress: entry.egress })} disabled={actionLoading}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            NACL Rules Manager
          </CardTitle>
          <div className="flex items-center gap-2">
            <CostBadge type="free" label="Free AWS API Calls" />
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={nacls.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : nacls.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No NACLs found. Ensure your AWS credentials are configured.</p>
          ) : (
            <>
              <div className="max-w-xs">
                <Select value={selectedNacl} onValueChange={setSelectedNacl}>
                  <SelectTrigger><SelectValue placeholder="Select a NACL..." /></SelectTrigger>
                  <SelectContent>
                    {nacls.map(n => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name} {n.isDefault && '(Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {currentNacl && (
                <div className="space-y-6">
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{currentNacl.id}</span>
                    <span>•</span>
                    <span>VPC: {currentNacl.vpcId}</span>
                    <span>•</span>
                    <span>{currentNacl.associations.length} subnet(s) associated</span>
                  </div>
                  {renderTable(inboundEntries, 'Inbound')}
                  {renderTable(outboundEntries, 'Outbound')}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateNACLRuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        nacls={nacls}
        onSubmit={handleCreate}
        loading={actionLoading}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NACL Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete rule #{deleteTarget?.ruleNumber} ({deleteTarget?.egress ? 'outbound' : 'inbound'})? This action will immediately affect network traffic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
