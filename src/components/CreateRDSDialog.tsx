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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Database, Network, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { VPC, Subnet, SecurityGroup } from "@/hooks/useAWSData";

interface CreateRDSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  vpcs?: VPC[];
  subnets?: Subnet[];
  securityGroups?: SecurityGroup[];
}

const ENGINE_OPTIONS = [
  { value: 'mysql', label: 'MySQL', versions: ['8.0.35', '8.0.34', '5.7.44'] },
  { value: 'postgres', label: 'PostgreSQL', versions: ['16.1', '15.4', '14.9', '13.12'] },
  { value: 'mariadb', label: 'MariaDB', versions: ['10.11.6', '10.6.16', '10.5.23'] },
];

const INSTANCE_CLASSES = [
  { value: 'db.t3.micro', label: 'db.t3.micro (Free Tier)', description: '1 vCPU, 1 GB RAM' },
  { value: 'db.t3.small', label: 'db.t3.small', description: '1 vCPU, 2 GB RAM' },
  { value: 'db.t3.medium', label: 'db.t3.medium', description: '2 vCPU, 4 GB RAM' },
  { value: 'db.m5.large', label: 'db.m5.large', description: '2 vCPU, 8 GB RAM' },
];

export function CreateRDSDialog({ open, onOpenChange, onSuccess, vpcs = [], subnets = [], securityGroups = [] }: CreateRDSDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [dbIdentifier, setDbIdentifier] = useState("");
  const [dbName, setDbName] = useState("");
  const [engine, setEngine] = useState("mysql");
  const [engineVersion, setEngineVersion] = useState("");
  const [instanceClass, setInstanceClass] = useState("db.t3.micro");
  const [allocatedStorage, setAllocatedStorage] = useState("20");
  const [masterUsername, setMasterUsername] = useState("admin");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [publiclyAccessible, setPubliclyAccessible] = useState(false);
  const [selectedVpcId, setSelectedVpcId] = useState("");
  const [selectedSubnetIds, setSelectedSubnetIds] = useState<string[]>([]);
  const [selectedSecurityGroupIds, setSelectedSecurityGroupIds] = useState<string[]>([]);

  const filteredSubnets = selectedVpcId 
    ? subnets.filter(s => s.vpcId === selectedVpcId) 
    : subnets;

  const filteredSecurityGroups = selectedVpcId
    ? securityGroups.filter(sg => sg.vpcId === selectedVpcId)
    : securityGroups;

  const selectedEngine = ENGINE_OPTIONS.find(e => e.value === engine);

  const resetForm = () => {
    setDbIdentifier("");
    setDbName("");
    setEngine("mysql");
    setEngineVersion("");
    setInstanceClass("db.t3.micro");
    setAllocatedStorage("20");
    setMasterUsername("admin");
    setMasterPassword("");
    setConfirmPassword("");
    setPubliclyAccessible(false);
    setSelectedVpcId("");
    setSelectedSubnetIds([]);
    setSelectedSecurityGroupIds([]);
  };

  const handleCreate = async () => {
    // Validation
    if (!dbIdentifier.trim()) {
      toast({ title: "Error", description: "DB identifier is required", variant: "destructive" });
      return;
    }

    if (!/^[a-z][a-z0-9-]*$/.test(dbIdentifier)) {
      toast({ 
        title: "Error", 
        description: "DB identifier must start with a letter and contain only lowercase letters, numbers, and hyphens", 
        variant: "destructive" 
      });
      return;
    }

    if (!masterPassword) {
      toast({ title: "Error", description: "Master password is required", variant: "destructive" });
      return;
    }

    if (masterPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    if (masterPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-rds-instances', {
        body: {
          action: 'create',
          dbInstanceIdentifier: dbIdentifier,
          dbName: dbName || undefined,
          engine,
          engineVersion: engineVersion || undefined,
          instanceClass,
          allocatedStorage: parseInt(allocatedStorage),
          masterUsername,
          masterPassword,
          publiclyAccessible,
          vpcId: selectedVpcId || undefined,
          subnetIds: selectedSubnetIds.length > 0 ? selectedSubnetIds : undefined,
          vpcSecurityGroupIds: selectedSecurityGroupIds.length > 0 ? selectedSecurityGroupIds : undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Database creation initiated",
        description: `${dbIdentifier} is being created. This may take several minutes.`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Create RDS error:', error);
      toast({
        title: "Failed to create database",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Create RDS Database
          </DialogTitle>
          <DialogDescription>
            Create a new Amazon RDS database instance. Free tier eligible with db.t3.micro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* DB Identifier */}
          <div className="grid gap-2">
            <Label htmlFor="dbIdentifier">DB Instance Identifier *</Label>
            <Input
              id="dbIdentifier"
              placeholder="my-database"
              value={dbIdentifier}
              onChange={(e) => setDbIdentifier(e.target.value.toLowerCase())}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and hyphens. Must start with a letter.
            </p>
          </div>

          {/* Database Name (optional) */}
          <div className="grid gap-2">
            <Label htmlFor="dbName">Initial Database Name (optional)</Label>
            <Input
              id="dbName"
              placeholder="mydb"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Engine */}
          <div className="grid gap-2">
            <Label>Database Engine</Label>
            <Select value={engine} onValueChange={(v) => { setEngine(v); setEngineVersion(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGINE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Engine Version */}
          <div className="grid gap-2">
            <Label>Engine Version</Label>
            <Select value={engineVersion} onValueChange={setEngineVersion}>
              <SelectTrigger>
                <SelectValue placeholder="Latest (recommended)" />
              </SelectTrigger>
              <SelectContent>
                {selectedEngine?.versions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instance Class */}
          <div className="grid gap-2">
            <Label>Instance Class</Label>
            <Select value={instanceClass} onValueChange={setInstanceClass}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INSTANCE_CLASSES.map((cls) => (
                  <SelectItem key={cls.value} value={cls.value}>
                    <div className="flex flex-col">
                      <span>{cls.label}</span>
                      <span className="text-xs text-muted-foreground">{cls.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Storage */}
          <div className="grid gap-2">
            <Label htmlFor="storage">Allocated Storage (GB)</Label>
            <Input
              id="storage"
              type="number"
              min="20"
              max="1000"
              value={allocatedStorage}
              onChange={(e) => setAllocatedStorage(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 20 GB. Free tier includes 20 GB.
            </p>
          </div>

          {/* Master Username */}
          <div className="grid gap-2">
            <Label htmlFor="username">Master Username</Label>
            <Input
              id="username"
              value={masterUsername}
              onChange={(e) => setMasterUsername(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Master Password */}
          <div className="grid gap-2">
            <Label htmlFor="password">Master Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Confirm Password */}
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Networking */}
          {vpcs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Networking</Label>
              </div>

              {/* VPC */}
              <div className="grid gap-2">
                <Label>VPC</Label>
                <Select value={selectedVpcId} onValueChange={(v) => { setSelectedVpcId(v); setSelectedSubnetIds([]); setSelectedSecurityGroupIds([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select VPC" />
                  </SelectTrigger>
                  <SelectContent>
                    {vpcs.map((vpc) => (
                      <SelectItem key={vpc.id} value={vpc.id}>
                        {vpc.name || vpc.id} ({vpc.cidrBlock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subnets */}
              {selectedVpcId && filteredSubnets.length > 0 && (
                <div className="grid gap-2">
                  <Label>Subnets (select at least 2 for DB Subnet Group)</Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-2">
                    {filteredSubnets.map((subnet) => (
                      <label key={subnet.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedSubnetIds.includes(subnet.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubnetIds(prev => [...prev, subnet.id]);
                            } else {
                              setSelectedSubnetIds(prev => prev.filter(id => id !== subnet.id));
                            }
                          }}
                          disabled={loading}
                          className="rounded"
                        />
                        <span>{subnet.name || subnet.id}</span>
                        <span className="text-muted-foreground">({subnet.availabilityZone})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    RDS requires subnets in at least 2 different Availability Zones.
                  </p>
                </div>
              )}

              {/* Security Groups */}
              {selectedVpcId && filteredSecurityGroups.length > 0 && (
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Security Groups
                  </Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-2">
                    {filteredSecurityGroups.map((sg) => (
                      <label key={sg.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedSecurityGroupIds.includes(sg.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSecurityGroupIds(prev => [...prev, sg.id]);
                            } else {
                              setSelectedSecurityGroupIds(prev => prev.filter(id => id !== sg.id));
                            }
                          }}
                          disabled={loading}
                          className="rounded"
                        />
                        <span>{sg.name}</span>
                        <span className="text-muted-foreground font-mono text-xs">({sg.id})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select security groups to control inbound/outbound traffic.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Public Access */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Publicly Accessible</Label>
              <p className="text-xs text-muted-foreground">
                Allow connections from outside the VPC
              </p>
            </div>
            <Switch
              checked={publiclyAccessible}
              onCheckedChange={setPubliclyAccessible}
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
            Create Database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
