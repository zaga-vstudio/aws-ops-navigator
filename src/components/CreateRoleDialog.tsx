import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, Tag } from "lucide-react";

interface ServicePermission {
  service: string;
  label: string;
  read: boolean;
  write: boolean;
}

const DEFAULT_SERVICES: ServicePermission[] = [
  { service: "ec2", label: "EC2 Instances", read: false, write: false },
  { service: "vpc", label: "VPC Networking", read: false, write: false },
  { service: "security_groups", label: "Security Groups", read: false, write: false },
  { service: "rds", label: "RDS Databases", read: false, write: false },
  { service: "cloudwatch", label: "CloudWatch", read: false, write: false },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    roleName: string,
    description: string,
    maxDuration: number,
    permissions: { service: string; read: boolean; write: boolean }[]
  ) => Promise<boolean>;
}

export function CreateRoleDialog({ open, onOpenChange, onSubmit }: Props) {
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [maxDuration, setMaxDuration] = useState(3600);
  const [services, setServices] = useState<ServicePermission[]>(DEFAULT_SERVICES.map(s => ({ ...s })));
  const [submitting, setSubmitting] = useState(false);

  const nameValid = /^[a-zA-Z0-9_-]+$/.test(roleName);
  const canSubmit = roleName.trim() !== "" && nameValid && !submitting;

  const toggleService = (index: number, field: "read" | "write") => {
    setServices(prev => prev.map((s, i) => i === index ? { ...s, [field]: !s[field] } : s));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const perms = services
      .filter(s => s.read || s.write)
      .map(({ service, read, write }) => ({ service, read, write }));
    const success = await onSubmit(roleName.trim(), description.trim(), maxDuration, perms);
    setSubmitting(false);
    if (success) {
      setRoleName("");
      setDescription("");
      setMaxDuration(3600);
      setServices(DEFAULT_SERVICES.map(s => ({ ...s })));
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create CloudHub Role</DialogTitle>
          <DialogDescription>
            Create an IAM Role in your AWS account. It will be named{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">CloudHub-Project-{"<name>"}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roleName">Role Name</Label>
            <Input
              id="roleName"
              placeholder="e.g. dev-ops"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
            {roleName && !nameValid && (
              <p className="text-xs text-destructive">Only alphanumeric, hyphens, underscores allowed.</p>
            )}
            {roleName && nameValid && (
              <p className="text-xs text-muted-foreground">
                AWS Role: <code className="bg-muted px-1 py-0.5 rounded">CloudHub-Project-{roleName}</code>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What this role is used for..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDuration">Max Session Duration (seconds)</Label>
            <Input
              id="maxDuration"
              type="number"
              min={3600}
              max={43200}
              value={maxDuration}
              onChange={(e) => setMaxDuration(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Between 3600 (1 hour) and 43200 (12 hours)</p>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <Label>Service Permissions (optional)</Label>
            <div className="border rounded-md divide-y">
              {services.map((svc, i) => (
                <div key={svc.service} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium">{svc.label}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={svc.read} onCheckedChange={() => toggleService(i, "read")} />
                      Read
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={svc.write} onCheckedChange={() => toggleService(i, "write")} />
                      Write
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags Preview */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Tags (auto-applied)</Label>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-xs">ManagedBy: CloudHub</Badge>
              <Badge variant="secondary" className="text-xs">CloudHubUserId: (your ID)</Badge>
              <Badge variant="secondary" className="text-xs">CloudHubUserEmail: (your email)</Badge>
              <Badge variant="secondary" className="text-xs">Environment: production</Badge>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              This will create an IAM role in your AWS account with a trust policy scoped to your admin identity.
              CloudTrail logs will attribute actions to this role with session tags.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creating in AWS..." : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
