import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Activity, Loader2, AlertTriangle } from "lucide-react";
import { CostBadge } from "./CostBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { VPC } from "@/hooks/useAWSData";
import type { FlowLog } from "@/hooks/useVPCAdvancedData";

interface FlowLogExplorerProps {
  vpcs: VPC[];
  flowLogs: FlowLog[];
  loading: boolean;
  safetyMode: boolean;
  onRefresh: () => void;
}

export function FlowLogExplorer({ vpcs, flowLogs, loading, safetyMode, onRefresh }: FlowLogExplorerProps) {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'enable' | 'disable'; vpcId: string; flowLogIds?: string[] } | null>(null);

  const getFlowLogsForVpc = (vpcId: string) =>
    flowLogs.filter(fl => fl.resourceId === vpcId);

  const handleToggle = (vpc: VPC, currentlyEnabled: boolean) => {
    const vpcFlowLogs = getFlowLogsForVpc(vpc.id);
    if (currentlyEnabled) {
      setPendingAction({ type: 'disable', vpcId: vpc.id, flowLogIds: vpcFlowLogs.map(fl => fl.id) });
      setConfirmDialogOpen(true);
    } else {
      setPendingAction({ type: 'enable', vpcId: vpc.id });
      setConfirmDialogOpen(true);
    }
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    setConfirmDialogOpen(false);
    setActionLoading(pendingAction.vpcId);

    try {
      const { data, error } = await supabase.functions.invoke('manage-flow-logs', {
        body: pendingAction.type === 'enable'
          ? { action: 'enable', vpcId: pendingAction.vpcId }
          : { action: 'disable', flowLogIds: pendingAction.flowLogIds },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: pendingAction.type === 'enable' ? 'Flow Logs Enabled' : 'Flow Logs Disabled',
        description: `VPC ${pendingAction.vpcId} flow logs have been ${pendingAction.type}d.`,
      });

      setTimeout(() => onRefresh(), 1500);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to manage flow logs',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
      setPendingAction(null);
    }
  };

  // Mock rejected traffic data (real data would come from CloudWatch Logs Insights)
  const rejectedTraffic = flowLogs.length > 0 ? [
    { source: '203.0.113.50', destination: '10.0.1.15', port: 22, packets: 1420, action: 'REJECT' },
    { source: '198.51.100.23', destination: '10.0.2.8', port: 3389, packets: 890, action: 'REJECT' },
    { source: '192.0.2.100', destination: '10.0.1.22', port: 445, packets: 654, action: 'REJECT' },
    { source: '203.0.113.75', destination: '10.0.3.5', port: 8080, packets: 321, action: 'REJECT' },
    { source: '198.51.100.44', destination: '10.0.1.30', port: 23, packets: 198, action: 'REJECT' },
  ] : [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Flow Log Explorer
          </CardTitle>
          <CostBadge type="paid" label="Paid Feature — $0.50/GB ingested" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* VPC Flow Log Toggles */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">VPC Flow Log Status</h4>
            {loading ? (
              Array(2).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))
            ) : vpcs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No VPCs found</p>
            ) : (
              vpcs.map(vpc => {
                const vpcFlowLogs = getFlowLogsForVpc(vpc.id);
                const enabled = vpcFlowLogs.length > 0;
                const isLoading = actionLoading === vpc.id;
                return (
                  <div key={vpc.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <div className="font-medium text-sm">{vpc.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{vpc.id}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {enabled && (
                        <Badge variant="outline" className="text-xs">
                          {vpcFlowLogs.length} log(s) active
                        </Badge>
                      )}
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => handleToggle(vpc, enabled)}
                          disabled={safetyMode || isLoading}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {safetyMode && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Safety Mode is enabled — flow log controls are disabled
              </p>
            )}
          </div>

          {/* Top 5 Rejected Traffic */}
          {rejectedTraffic.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Top 5 Rejected Traffic Sources</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source IP</TableHead>
                    <TableHead>Destination IP</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Packets</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rejectedTraffic.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{entry.source}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.destination}</TableCell>
                      <TableCell>{entry.port}</TableCell>
                      <TableCell>{entry.packets.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{entry.action}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {pendingAction?.type === 'enable' ? 'Enable VPC Flow Logs?' : 'Disable VPC Flow Logs?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {pendingAction?.type === 'enable' ? (
                <>
                  <p>
                    <strong>Enabling Flow Logs incurs AWS charges ($0.50/GB ingested).</strong>
                  </p>
                  <p>Storage costs apply in CloudWatch Logs. Do you wish to proceed?</p>
                  <p className="text-xs text-muted-foreground">
                    VPC: {pendingAction.vpcId}
                  </p>
                </>
              ) : (
                <p>
                  This will delete the flow logs for VPC <span className="font-mono">{pendingAction?.vpcId}</span>.
                  Existing log data in CloudWatch will be retained.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              {pendingAction?.type === 'enable' ? 'Enable & Accept Charges' : 'Disable Flow Logs'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
