import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateVPCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CIDR_PRESETS = [
  { value: '10.0.0.0/16', label: '10.0.0.0/16 (65,536 IPs)' },
  { value: '10.0.0.0/24', label: '10.0.0.0/24 (256 IPs)' },
  { value: '172.16.0.0/16', label: '172.16.0.0/16 (65,536 IPs)' },
  { value: '192.168.0.0/16', label: '192.168.0.0/16 (65,536 IPs)' },
];

export function CreateVPCDialog({ open, onOpenChange, onSuccess }: CreateVPCDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState("");
  const [cidrBlock, setCidrBlock] = useState("10.0.0.0/16");
  const [enableDnsHostnames, setEnableDnsHostnames] = useState(true);
  const [enableDnsSupport, setEnableDnsSupport] = useState(true);

  const resetForm = () => {
    setName("");
    setCidrBlock("10.0.0.0/16");
    setEnableDnsHostnames(true);
    setEnableDnsSupport(true);
  };

  const validateCidr = (cidr: string): boolean => {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(cidr)) return false;
    
    const [ip, prefix] = cidr.split('/');
    const prefixNum = parseInt(prefix);
    if (prefixNum < 16 || prefixNum > 28) return false;
    
    const octets = ip.split('.').map(Number);
    return octets.every(o => o >= 0 && o <= 255);
  };

  const handleCreate = async () => {
    if (!validateCidr(cidrBlock)) {
      toast({ 
        title: "Invalid CIDR", 
        description: "CIDR block must be in format x.x.x.x/xx with prefix between /16 and /28", 
        variant: "destructive" 
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-vpcs', {
        body: {
          action: 'create-vpc',
          cidrBlock,
          name: name || undefined,
          enableDnsHostnames,
          enableDnsSupport,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "VPC created",
        description: `VPC ${name || cidrBlock} has been created successfully.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Create VPC error:', error);
      toast({
        title: "Failed to create VPC",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Create VPC
          </DialogTitle>
          <DialogDescription>
            Create a new Virtual Private Cloud with custom CIDR block and DNS settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* VPC Name */}
          <div className="grid gap-2">
            <Label htmlFor="vpcName">VPC Name (optional)</Label>
            <Input
              id="vpcName"
              placeholder="my-vpc"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* CIDR Block */}
          <div className="grid gap-2">
            <Label htmlFor="cidrBlock">IPv4 CIDR Block *</Label>
            <Input
              id="cidrBlock"
              placeholder="10.0.0.0/16"
              value={cidrBlock}
              onChange={(e) => setCidrBlock(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Must be between /16 (65,536 IPs) and /28 (16 IPs)
            </p>
          </div>

          {/* CIDR Presets */}
          <div className="grid gap-2">
            <Label>Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              {CIDR_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={cidrBlock === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCidrBlock(preset.value)}
                  disabled={loading}
                >
                  {preset.value}
                </Button>
              ))}
            </div>
          </div>

          {/* DNS Hostnames */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable DNS Hostnames</Label>
              <p className="text-xs text-muted-foreground">
                Instances get public DNS hostnames
              </p>
            </div>
            <Switch
              checked={enableDnsHostnames}
              onCheckedChange={setEnableDnsHostnames}
              disabled={loading}
            />
          </div>

          {/* DNS Support */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable DNS Support</Label>
              <p className="text-xs text-muted-foreground">
                Enable DNS resolution in the VPC
              </p>
            </div>
            <Switch
              checked={enableDnsSupport}
              onCheckedChange={setEnableDnsSupport}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create VPC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
