import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (roleName: string, roleArn: string, description: string, maxDuration: number) => Promise<boolean>;
}

export function CreateRoleDialog({ open, onOpenChange, onSubmit }: Props) {
  const [roleName, setRoleName] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [description, setDescription] = useState("");
  const [maxDuration, setMaxDuration] = useState(900);
  const [submitting, setSubmitting] = useState(false);

  const expectedFullName = `CloudHub-Project-${roleName}`;
  const arnPattern = /^arn:aws:iam::\d{12}:role\/.+$/;
  const isArnValid = roleArn === "" || arnPattern.test(roleArn);
  const arnMatchesName = roleArn === "" || roleArn.endsWith(`/${expectedFullName}`);

  const canSubmit = roleName.trim() !== "" && roleArn.trim() !== "" && isArnValid && arnMatchesName && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    const success = await onSubmit(roleName.trim(), roleArn.trim(), description.trim(), maxDuration);
    setSubmitting(false);
    if (success) {
      setRoleName("");
      setRoleArn("");
      setDescription("");
      setMaxDuration(900);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register CloudHub Role</DialogTitle>
          <DialogDescription>
            Register an IAM Role that was created in your AWS account. The role must be named{" "}
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
            {roleName && (
              <p className="text-xs text-muted-foreground">
                AWS IAM Role must be named: <code className="bg-muted px-1 py-0.5 rounded">{expectedFullName}</code>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleArn">Role ARN</Label>
            <Input
              id="roleArn"
              placeholder="arn:aws:iam::123456789012:role/CloudHub-Project-dev-ops"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
              className="font-mono text-sm"
            />
            {roleArn && !isArnValid && (
              <p className="text-xs text-destructive">Invalid ARN format</p>
            )}
            {roleArn && isArnValid && !arnMatchesName && (
              <p className="text-xs text-destructive">
                ARN must end with <code>/{expectedFullName}</code>
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
              min={900}
              max={3600}
              value={maxDuration}
              onChange={(e) => setMaxDuration(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Between 900 (15 min) and 3600 (1 hour)</p>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              The role must already exist in your AWS account with a trust policy allowing your admin IAM identity to assume it.
              CloudTrail logs will attribute actions to this role with session tags.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Registering..." : "Register Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
