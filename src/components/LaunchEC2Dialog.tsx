import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Server, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LaunchEC2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INSTANCE_TYPES = [
  { value: 't2.micro', label: 't2.micro (1 vCPU, 1 GB) - Free Tier', freeTier: true },
  { value: 't2.small', label: 't2.small (1 vCPU, 2 GB)', freeTier: false },
  { value: 't2.medium', label: 't2.medium (2 vCPU, 4 GB)', freeTier: false },
  { value: 't3.micro', label: 't3.micro (2 vCPU, 1 GB) - Free Tier', freeTier: true },
  { value: 't3.small', label: 't3.small (2 vCPU, 2 GB)', freeTier: false },
  { value: 't3.medium', label: 't3.medium (2 vCPU, 4 GB)', freeTier: false },
];

export function LaunchEC2Dialog({ open, onOpenChange, onSuccess }: LaunchEC2DialogProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [instanceType, setInstanceType] = useState('t2.micro');
  const { toast } = useToast();

  const selectedType = INSTANCE_TYPES.find(t => t.value === instanceType);

  const handleLaunch = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter an instance name.",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('manage-ec2-instances', {
        body: {
          action: 'launch',
          params: {
            name: name.trim(),
            instanceType,
          },
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Instance Launching",
        description: `Instance ${data.instanceId} is being launched. It will be available shortly.`,
      });

      onOpenChange(false);
      setName('');
      setInstanceType('t2.micro');
      onSuccess();
    } catch (error: any) {
      console.error('Error launching instance:', error);
      toast({
        variant: "destructive",
        title: "Launch Failed",
        description: error.message || "Failed to launch EC2 instance. Please check your AWS permissions.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Launch EC2 Instance
          </DialogTitle>
          <DialogDescription>
            Create a new EC2 instance in your AWS account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Instance Name</Label>
            <Input
              id="name"
              placeholder="e.g., web-server-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instanceType">Instance Type</Label>
            <Select value={instanceType} onValueChange={setInstanceType} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select instance type" />
              </SelectTrigger>
              <SelectContent>
                {INSTANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span className={type.freeTier ? 'text-green-600' : ''}>
                      {type.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && !selectedType.freeTier && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This instance type is not covered by the AWS Free Tier and will incur charges.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Alert>
            <Server className="h-4 w-4" />
            <AlertDescription>
              The instance will be launched with Amazon Linux 2023 AMI in your default VPC. 
              Ensure your IAM user has <code className="text-xs bg-muted px-1 rounded">ec2:RunInstances</code> permission.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Server className="h-4 w-4 mr-2" />
                Launch Instance
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
