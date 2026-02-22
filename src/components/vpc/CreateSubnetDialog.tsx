import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VPC } from "@/hooks/useAWSData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vpc: VPC | null;
  onSuccess: () => void;
}

const AZ_SUFFIXES = ['a', 'b', 'c', 'd', 'e', 'f'];

export function CreateSubnetDialog({ open, onOpenChange, vpc, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subnetName, setSubnetName] = useState("");
  const [cidrBlock, setCidrBlock] = useState("");
  const [azSuffix, setAzSuffix] = useState("a");

  if (!vpc) return null;

  const region = vpc.region || "us-east-1";

  // Simple check: is subnet CIDR within VPC CIDR range
  const isSubnetInVpc = (subnetCidr: string, vpcCidr: string): boolean => {
    try {
      const parseCidr = (cidr: string) => {
        const [ip, prefix] = cidr.split('/');
        const parts = ip.split('.').map(Number);
        const num = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
        const mask = prefix === '0' ? 0 : (~0 << (32 - parseInt(prefix))) >>> 0;
        return { start: (num & mask) >>> 0, mask, prefix: parseInt(prefix) };
      };
      const vpc = parseCidr(vpcCidr);
      const subnet = parseCidr(subnetCidr);
      // Subnet prefix must be >= VPC prefix (smaller or equal block) and start must be within VPC range
      return subnet.prefix >= vpc.prefix && (subnet.start & vpc.mask) === vpc.start;
    } catch { return true; } // If parsing fails, let AWS validate
  };

  // Generate example valid subnet CIDRs
  const suggestedCidrs = (() => {
    try {
      const [ip, prefix] = vpc.cidrBlock.split('/');
      const vpcPrefix = parseInt(prefix);
      const subnetPrefix = Math.min(vpcPrefix + 4, 28); // e.g., /16 → /20, /24 → /28
      const parts = ip.split('.').map(Number);
      return [`${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}/${subnetPrefix}`];
    } catch { return []; }
  })();

  const handleCreate = async () => {
    if (!cidrBlock) {
      toast({ title: "CIDR required", description: "Please enter a subnet CIDR block.", variant: "destructive" });
      return;
    }

    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!cidrRegex.test(cidrBlock)) {
      toast({ title: "Invalid CIDR", description: "Format: x.x.x.x/xx", variant: "destructive" });
      return;
    }

    const prefix = parseInt(cidrBlock.split('/')[1]);
    if (prefix > 28) {
      toast({ title: "Subnet too small", description: "AWS requires a minimum subnet size of /28 (16 IPs).", variant: "destructive" });
      return;
    }

    if (!isSubnetInVpc(cidrBlock, vpc.cidrBlock)) {
      toast({ title: "CIDR out of range", description: `Subnet CIDR must be within VPC range ${vpc.cidrBlock}. Try: ${suggestedCidrs[0] || 'a smaller block'}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-vpcs', {
        body: {
          action: 'create-subnet',
          vpcId: vpc.id,
          subnetCidrBlock: cidrBlock,
          availabilityZone: `${region}${azSuffix}`,
          subnetName: subnetName || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Subnet created", description: `Subnet ${subnetName || cidrBlock} created in ${vpc.name || vpc.id}` });
      setSubnetName("");
      setCidrBlock("");
      setAzSuffix("a");
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Failed to create subnet", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Create Subnet
          </DialogTitle>
          <DialogDescription>
            Create a new subnet in <span className="font-mono font-medium">{vpc.name || vpc.id}</span> ({vpc.cidrBlock})
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="subnetName">Subnet Name (optional)</Label>
            <Input id="subnetName" placeholder="my-subnet" value={subnetName} onChange={(e) => setSubnetName(e.target.value)} disabled={loading} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="subnetCidr">IPv4 CIDR Block *</Label>
            <Input id="subnetCidr" placeholder="10.0.1.0/24" value={cidrBlock} onChange={(e) => setCidrBlock(e.target.value)} disabled={loading} />
            <p className="text-xs text-muted-foreground">
              Must be within VPC CIDR {vpc.cidrBlock}{suggestedCidrs.length > 0 && <> — e.g. <button type="button" className="font-mono underline text-primary" onClick={() => setCidrBlock(suggestedCidrs[0])}>{suggestedCidrs[0]}</button></>}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Availability Zone</Label>
            <Select value={azSuffix} onValueChange={setAzSuffix} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AZ_SUFFIXES.map(s => (
                  <SelectItem key={s} value={s}>{region}{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Subnet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
