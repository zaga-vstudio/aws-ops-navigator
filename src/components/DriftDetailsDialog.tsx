import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DriftEvent } from "@/hooks/useDriftDetection";

interface DriftDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drift: DriftEvent | null;
  onAcknowledge: (driftId: string) => Promise<boolean>;
  onAccept: (driftId: string) => Promise<boolean>;
  loading?: boolean;
}

export function DriftDetailsDialog({
  open,
  onOpenChange,
  drift,
  onAcknowledge,
  onAccept,
  loading,
}: DriftDetailsDialogProps) {
  if (!drift) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'outline';
      default: return 'secondary';
    }
  };

  const getResourceTypeLabel = (type: string) => {
    switch (type) {
      case 'ec2': return 'EC2 Instance';
      case 'rds': return 'RDS Database';
      case 'security_group': return 'Security Group';
      case 'vpc': return 'VPC';
      default: return type.toUpperCase();
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return value.join(', ') || '(empty)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Drift Details
            <Badge variant={getSeverityColor(drift.severity) as any}>
              {drift.severity}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Changes detected outside of CloudHub
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Resource Type:</span>
              <p className="font-medium">{getResourceTypeLabel(drift.resource_type)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Resource ID:</span>
              <p className="font-medium font-mono text-xs">{drift.resource_id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Resource Name:</span>
              <p className="font-medium">{drift.resource_name || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Detected:</span>
              <p className="font-medium">
                {formatDistanceToNow(new Date(drift.detected_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Configuration Changes</h4>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <div className="space-y-3">
                {drift.changes.map((change, index) => (
                  <div key={index} className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium text-sm mb-2 font-mono">
                      {change.field}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1 p-2 bg-destructive/10 rounded text-destructive">
                        <span className="text-xs text-muted-foreground block">Previous:</span>
                        <code className="text-xs">{formatValue(change.previous)}</code>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 p-2 bg-success/10 rounded text-success">
                        <span className="text-xs text-muted-foreground block">Current:</span>
                        <code className="text-xs">{formatValue(change.current)}</code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {!drift.acknowledged && (
            <>
              <Button
                variant="secondary"
                onClick={() => onAcknowledge(drift.id)}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              <Button
                onClick={() => onAccept(drift.id)}
                disabled={loading}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept Changes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
