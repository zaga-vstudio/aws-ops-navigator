import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface NewAlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    metric: string;
    threshold: string;
    duration: string;
    severity: string;
  }) => Promise<boolean>;
  loading?: boolean;
}

export function NewAlertRuleDialog({ open, onOpenChange, onSubmit, loading }: NewAlertRuleDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    metric: "",
    threshold: "",
    duration: "5",
    severity: "warning"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) {
      onOpenChange(false);
      setFormData({
        name: "",
        metric: "",
        threshold: "",
        duration: "5",
        severity: "warning"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Alert Rule</DialogTitle>
          <DialogDescription>
            Configure a new CloudWatch alarm to monitor your AWS resources.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Rule Name</Label>
              <Input
                id="name"
                placeholder="e.g., High CPU Usage"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="metric">Metric</Label>
              <Select 
                value={formData.metric} 
                onValueChange={(value) => setFormData({ ...formData, metric: value })}
                required
                disabled={loading}
              >
                <SelectTrigger id="metric">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CPUUtilization">CPU Utilization</SelectItem>
                  <SelectItem value="MemoryUtilization">Memory Utilization</SelectItem>
                  <SelectItem value="DiskUtilization">Disk Utilization</SelectItem>
                  <SelectItem value="NetworkIn">Network In</SelectItem>
                  <SelectItem value="NetworkOut">Network Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="threshold">Threshold (%)</Label>
              <Input
                id="threshold"
                type="number"
                placeholder="e.g., 80"
                min="0"
                max="100"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="e.g., 5"
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="severity">Severity</Label>
              <Select 
                value={formData.severity} 
                onValueChange={(value) => setFormData({ ...formData, severity: value })}
                disabled={loading}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name || !formData.metric || !formData.threshold}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
