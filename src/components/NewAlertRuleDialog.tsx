import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, HelpCircle, CheckCircle, AlertTriangle, Cpu, HardDrive, DollarSign, Gauge, Shield, ArrowRight } from "lucide-react";

interface NewAlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    metric: string;
    threshold: string;
    duration: string;
    severity: string;
    comparison_operator: string;
  }) => Promise<boolean>;
  loading?: boolean;
}

interface MetricDefinition {
  value: string;
  label: string;
  unit: string;
  unitLabel: string;
  defaultComparison: string;
  category: string;
  requiresAgent?: boolean;
  iamPermissions?: string[];
}

const METRIC_CATEGORIES: Record<string, {
  label: string;
  badge: 'free' | 'agent';
  icon: typeof Cpu;
  colorClass: string;
  badgeClass: string;
  itemAccent: string;
}> = {
  performance: {
    label: "Performance",
    badge: "free",
    icon: Cpu,
    colorClass: "text-sky-500",
    badgeClass: "bg-sky-500/15 text-sky-600 border-sky-500/30",
    itemAccent: "border-l-2 border-l-sky-500/40 pl-2",
  },
  storage: {
    label: "Storage",
    badge: "free",
    icon: HardDrive,
    colorClass: "text-violet-500",
    badgeClass: "bg-violet-500/15 text-violet-600 border-violet-500/30",
    itemAccent: "border-l-2 border-l-violet-500/40 pl-2",
  },
  cost: {
    label: "Cost & Budget",
    badge: "free",
    icon: DollarSign,
    colorClass: "text-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    itemAccent: "border-l-2 border-l-emerald-500/40 pl-2",
  },
  agent: {
    label: "Agent-Required",
    badge: "agent",
    icon: Gauge,
    colorClass: "text-amber-500",
    badgeClass: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    itemAccent: "border-l-2 border-l-amber-500/40 pl-2",
  },
};

const METRICS: MetricDefinition[] = [
  // Performance
  { value: "CPUUtilization", label: "CPU Utilization (EC2)", unit: "%", unitLabel: "Threshold (%)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  { value: "NetworkIn", label: "Network In (EC2)", unit: "bytes", unitLabel: "Threshold (bytes)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  { value: "NetworkOut", label: "Network Out (EC2)", unit: "bytes", unitLabel: "Threshold (bytes)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  { value: "DatabaseConnections", label: "Database Connections (RDS)", unit: "count", unitLabel: "Threshold (count)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  { value: "ReadLatency", label: "Read Latency (RDS)", unit: "ms", unitLabel: "Threshold (ms)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  { value: "WriteLatency", label: "Write Latency (RDS)", unit: "ms", unitLabel: "Threshold (ms)", defaultComparison: "GreaterThanThreshold", category: "performance" },
  // Storage
  { value: "FreeStorageSpace", label: "Free Storage Space (RDS)", unit: "GB", unitLabel: "Threshold (GB)", defaultComparison: "LessThanThreshold", category: "storage" },
  { value: "VolumeReadOps", label: "Volume Read Ops (EBS)", unit: "ops", unitLabel: "Threshold (ops)", defaultComparison: "GreaterThanThreshold", category: "storage" },
  { value: "VolumeWriteOps", label: "Volume Write Ops (EBS)", unit: "ops", unitLabel: "Threshold (ops)", defaultComparison: "GreaterThanThreshold", category: "storage" },
  // Cost
  { value: "MonthlyBudget", label: "Monthly Budget", unit: "$", unitLabel: "Budget Limit ($)", defaultComparison: "GreaterThanThreshold", category: "cost", iamPermissions: ["budgets:CreateBudget", "budgets:DeleteBudget", "sts:GetCallerIdentity"] },
  { value: "ServiceBudget", label: "Service Budget", unit: "$", unitLabel: "Budget Limit ($)", defaultComparison: "GreaterThanThreshold", category: "cost", iamPermissions: ["budgets:CreateBudget", "budgets:DeleteBudget", "sts:GetCallerIdentity"] },
  // Agent-Required
  { value: "MemoryUtilization", label: "Memory Utilization", unit: "%", unitLabel: "Threshold (%)", defaultComparison: "GreaterThanThreshold", category: "agent", requiresAgent: true },
  { value: "DiskUtilization", label: "Disk Utilization", unit: "%", unitLabel: "Threshold (%)", defaultComparison: "GreaterThanThreshold", category: "agent", requiresAgent: true },
];

function IAMPermissionsDiagram({ permissions }: { permissions: string[] }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Shield className="h-3.5 w-3.5" />
        Required IAM Permissions
      </div>
      <div className="flex flex-col gap-1">
        {permissions.map((perm) => (
          <div key={perm} className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3 text-amber-500/70 shrink-0" />
            <code className="font-mono text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">{perm}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NewAlertRuleDialog({ open, onOpenChange, onSubmit, loading }: NewAlertRuleDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    metric: "",
    threshold: "",
    duration: "5",
    severity: "warning",
    comparison_operator: "GreaterThanThreshold",
  });

  const selectedMetric = useMemo(
    () => METRICS.find(m => m.value === formData.metric),
    [formData.metric]
  );

  const selectedCategory = selectedMetric ? METRIC_CATEGORIES[selectedMetric.category] : null;
  const isBudgetMetric = selectedMetric?.category === "cost";

  const handleMetricChange = (value: string) => {
    const metric = METRICS.find(m => m.value === value);
    setFormData({
      ...formData,
      metric: value,
      comparison_operator: metric?.defaultComparison || "GreaterThanThreshold",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) {
      onOpenChange(false);
      setFormData({ name: "", metric: "", threshold: "", duration: "5", severity: "warning", comparison_operator: "GreaterThanThreshold" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Create New Alert Rule</DialogTitle>
          <DialogDescription>
            Configure a CloudWatch alarm or AWS Budget to monitor your resources.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Rule Name */}
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

            {/* Metric with grouped categories */}
            <div className="grid gap-2">
              <Label htmlFor="metric">Metric</Label>
              <Select value={formData.metric} onValueChange={handleMetricChange} required disabled={loading}>
                <SelectTrigger id="metric" className={selectedCategory ? `border-l-2 ${selectedCategory.itemAccent.split(' ')[1]}` : ''}>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(METRIC_CATEGORIES).map(([key, cat]) => {
                    const Icon = cat.icon;
                    return (
                      <SelectGroup key={key}>
                        <SelectLabel className="flex items-center gap-2 py-1.5">
                          <Icon className={`h-3.5 w-3.5 ${cat.colorClass}`} />
                          <span>{cat.label}</span>
                          <Badge className={`${cat.badgeClass} text-[10px] px-1.5 py-0`}>
                            {cat.badge === "free" ? "Free" : "CW Agent"}
                          </Badge>
                        </SelectLabel>
                        {METRICS.filter(m => m.category === key).map(m => (
                          <SelectItem key={m.value} value={m.value} className={cat.itemAccent}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Agent warning */}
              {selectedMetric?.requiresAgent && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-2.5 py-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Requires CloudWatch Agent installed on your EC2 instances
                </div>
              )}

              {/* IAM permissions diagram for budget metrics */}
              {selectedMetric?.iamPermissions && selectedMetric.iamPermissions.length > 0 && (
                <IAMPermissionsDiagram permissions={selectedMetric.iamPermissions} />
              )}
            </div>

            {/* Threshold with dynamic label */}
            <div className="grid gap-2">
              <Label htmlFor="threshold">{selectedMetric?.unitLabel || "Threshold"}</Label>
              <Input
                id="threshold"
                type="number"
                placeholder={isBudgetMetric ? "e.g., 500" : "e.g., 80"}
                min="0"
                step={isBudgetMetric ? "1" : "any"}
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            {/* Comparison Operator */}
            <div className="grid gap-2">
              <Label>Comparison</Label>
              <Select
                value={formData.comparison_operator}
                onValueChange={(v) => setFormData({ ...formData, comparison_operator: v })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GreaterThanThreshold">Greater than (&gt;)</SelectItem>
                  <SelectItem value="GreaterThanOrEqualToThreshold">Greater than or equal (≥)</SelectItem>
                  <SelectItem value="LessThanThreshold">Less than (&lt;)</SelectItem>
                  <SelectItem value="LessThanOrEqualToThreshold">Less than or equal (≤)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Evaluation Period - only for non-budget metrics */}
            {!isBudgetMetric && (
              <div className="grid gap-2">
                <TooltipProvider>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="duration">Evaluation Period (minutes)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px]">
                        <p>How many minutes of data to average before checking the threshold. A longer period reduces false positives.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
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
            )}

            {/* Severity */}
            <div className="grid gap-2">
              <Label htmlFor="severity">Severity</Label>
              <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })} disabled={loading}>
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

            {/* Cost note */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              {isBudgetMetric
                ? "AWS Budgets are free to create. You'll receive alerts when spend exceeds your limit."
                : "CloudWatch alarms use the free tier. Drift detection scans are also free."}
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
