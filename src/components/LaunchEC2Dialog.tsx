import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Server, AlertTriangle, DollarSign, ExternalLink, Search, Info, Network } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import type { VPC, Subnet, SecurityGroup } from "@/hooks/useAWSData";

interface LaunchEC2DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  vpcs?: VPC[];
  subnets?: Subnet[];
  securityGroups?: SecurityGroup[];
}

interface OSOption {
  id: string;
  name: string;
  description: string;
  owner: string;
  namePattern: string;
  icon: string;
  freeTier: boolean;
  estimatedCost?: string;
  category: 'standard' | 'marketplace';
}

interface MarketplaceAMI {
  amiId: string;
  name: string;
  description: string;
  hourlyPrice?: string;
  hasProductCode: boolean;
}

interface KeyPairInfo {
  name: string;
  fingerprint: string;
  keyType?: string;
}

const INSTANCE_TYPES = [
  { value: 't2.micro', label: 't2.micro (1 vCPU, 1 GB) - Free Tier', freeTier: true, hourlyRate: 0.0116 },
  { value: 't2.small', label: 't2.small (1 vCPU, 2 GB)', freeTier: false, hourlyRate: 0.023 },
  { value: 't2.medium', label: 't2.medium (2 vCPU, 4 GB)', freeTier: false, hourlyRate: 0.0464 },
  { value: 't3.micro', label: 't3.micro (2 vCPU, 1 GB) - Free Tier', freeTier: true, hourlyRate: 0.0104 },
  { value: 't3.small', label: 't3.small (2 vCPU, 2 GB)', freeTier: false, hourlyRate: 0.0208 },
  { value: 't3.medium', label: 't3.medium (2 vCPU, 4 GB)', freeTier: false, hourlyRate: 0.0416 },
  { value: 'm5.large', label: 'm5.large (2 vCPU, 8 GB)', freeTier: false, hourlyRate: 0.096 },
  { value: 'm5.xlarge', label: 'm5.xlarge (4 vCPU, 16 GB)', freeTier: false, hourlyRate: 0.192 },
];

const STANDARD_OS_OPTIONS: OSOption[] = [
  {
    id: 'amazon-linux-2023',
    name: 'Amazon Linux 2023',
    description: 'AWS-optimized Linux distribution',
    owner: 'amazon',
    namePattern: 'al2023-ami-2023*-x86_64',
    icon: '🟠',
    freeTier: true,
    category: 'standard',
  },
  {
    id: 'amazon-linux-2',
    name: 'Amazon Linux 2',
    description: 'Previous generation AWS Linux',
    owner: 'amazon',
    namePattern: 'amzn2-ami-hvm-*-x86_64-gp2',
    icon: '🟠',
    freeTier: true,
    category: 'standard',
  },
  {
    id: 'ubuntu-22',
    name: 'Ubuntu Server 22.04 LTS',
    description: 'Canonical Ubuntu LTS release',
    owner: '099720109477',
    namePattern: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*',
    icon: '🟣',
    freeTier: true,
    category: 'standard',
  },
  {
    id: 'ubuntu-24',
    name: 'Ubuntu Server 24.04 LTS',
    description: 'Latest Canonical Ubuntu LTS',
    owner: '099720109477',
    namePattern: 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*',
    icon: '🟣',
    freeTier: true,
    category: 'standard',
  },
  {
    id: 'debian-12',
    name: 'Debian 12 (Bookworm)',
    description: 'Stable Debian release',
    owner: '136693071363',
    namePattern: 'debian-12-amd64-*',
    icon: '🔴',
    freeTier: true,
    category: 'standard',
  },
  {
    id: 'rhel-9',
    name: 'Red Hat Enterprise Linux 9',
    description: 'Enterprise Linux with support',
    owner: '309956199498',
    namePattern: 'RHEL-9*_HVM-*-x86_64-*',
    icon: '🔴',
    freeTier: false,
    estimatedCost: '~$0.06/hr license',
    category: 'standard',
  },
  {
    id: 'windows-2022',
    name: 'Windows Server 2022',
    description: 'Microsoft Windows Server',
    owner: 'amazon',
    namePattern: 'Windows_Server-2022-English-Full-Base-*',
    icon: '🔵',
    freeTier: false,
    estimatedCost: '~$0.046/hr license',
    category: 'standard',
  },
  {
    id: 'windows-2019',
    name: 'Windows Server 2019',
    description: 'Previous Windows Server version',
    owner: 'amazon',
    namePattern: 'Windows_Server-2019-English-Full-Base-*',
    icon: '🔵',
    freeTier: false,
    estimatedCost: '~$0.046/hr license',
    category: 'standard',
  },
];

const MARKETPLACE_OS_OPTIONS: OSOption[] = [
  {
    id: 'kali-linux',
    name: 'Kali Linux',
    description: 'Penetration testing & security auditing',
    owner: '679593333241',
    namePattern: 'kali-linux-*',
    icon: '🐉',
    freeTier: false,
    estimatedCost: 'Free AMI + instance cost',
    category: 'marketplace',
  },
  {
    id: 'centos-stream-9',
    name: 'CentOS Stream 9',
    description: 'Community Enterprise OS',
    owner: '125523088429',
    namePattern: 'CentOS Stream 9*',
    icon: '🟢',
    freeTier: true,
    category: 'marketplace',
  },
  {
    id: 'rocky-linux-9',
    name: 'Rocky Linux 9',
    description: 'RHEL-compatible enterprise Linux',
    owner: '792107900819',
    namePattern: 'Rocky-9-EC2-Base-*',
    icon: '🟢',
    freeTier: true,
    category: 'marketplace',
  },
  {
    id: 'alma-linux-9',
    name: 'AlmaLinux OS 9',
    description: 'Enterprise-grade Linux',
    owner: '764336703387',
    namePattern: 'AlmaLinux OS 9*',
    icon: '🟢',
    freeTier: true,
    category: 'marketplace',
  },
  {
    id: 'suse-15',
    name: 'SUSE Linux Enterprise 15',
    description: 'Enterprise Linux for mission-critical apps',
    owner: '013907871322',
    namePattern: 'suse-sles-15-sp5-*',
    icon: '🟢',
    freeTier: false,
    estimatedCost: '~$0.04/hr license',
    category: 'marketplace',
  },
];

export function LaunchEC2Dialog({ open, onOpenChange, onSuccess, vpcs = [], subnets = [], securityGroups = [] }: LaunchEC2DialogProps) {
  const [loading, setLoading] = useState(false);
  const [searchingAMI, setSearchingAMI] = useState(false);
  const [name, setName] = useState('');
  const [instanceType, setInstanceType] = useState('t2.micro');
  const [selectedOS, setSelectedOS] = useState<string>('amazon-linux-2023');
  const [customAmiId, setCustomAmiId] = useState('');
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [marketplaceResults, setMarketplaceResults] = useState<MarketplaceAMI[]>([]);
  const [openConsoleOnLaunch, setOpenConsoleOnLaunch] = useState(false);
  const [resolvedAmiId, setResolvedAmiId] = useState<string | null>(null);
  const [osTab, setOsTab] = useState<string>('standard');
  const [keyPairs, setKeyPairs] = useState<KeyPairInfo[]>([]);
  const [selectedKeyPair, setSelectedKeyPair] = useState<string>('');
  const [loadingKeyPairs, setLoadingKeyPairs] = useState(false);
  const [selectedVpcId, setSelectedVpcId] = useState<string>('');
  const [selectedSubnetId, setSelectedSubnetId] = useState<string>('');
  const [selectedSecurityGroupIds, setSelectedSecurityGroupIds] = useState<string[]>([]);
  const { toast } = useToast();

  // Default to the default VPC when vpcs load
  useEffect(() => {
    if (vpcs.length > 0 && !selectedVpcId) {
      const defaultVpc = vpcs.find(v => v.isDefault);
      setSelectedVpcId(defaultVpc?.id || vpcs[0].id);
    }
  }, [vpcs]);

  // Reset subnet and security groups when VPC changes
  useEffect(() => {
    setSelectedSubnetId('');
    setSelectedSecurityGroupIds([]);
  }, [selectedVpcId]);

  const filteredSubnets = subnets.filter(s => s.vpcId === selectedVpcId);
  const filteredSecurityGroups = securityGroups.filter(sg => sg.vpcId === selectedVpcId);

  // Fetch key pairs when dialog opens
  useEffect(() => {
    if (open) {
      fetchKeyPairs();
    }
  }, [open]);

  const fetchKeyPairs = async () => {
    setLoadingKeyPairs(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('manage-ec2-instances', {
        body: { action: 'listKeyPairs' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setKeyPairs(data?.keyPairs || []);
    } catch (error: any) {
      console.error('Error fetching key pairs:', error);
      // Don't show error toast - key pairs are optional
    } finally {
      setLoadingKeyPairs(false);
    }
  };

  const allOSOptions = [...STANDARD_OS_OPTIONS, ...MARKETPLACE_OS_OPTIONS];
  const selectedOSOption = allOSOptions.find(os => os.id === selectedOS);
  const selectedInstanceType = INSTANCE_TYPES.find(t => t.value === instanceType);

  // Calculate estimated costs
  const calculateEstimatedCost = () => {
    let hourlyTotal = selectedInstanceType?.hourlyRate || 0;
    let additionalCosts: string[] = [];

    if (selectedOSOption?.estimatedCost) {
      additionalCosts.push(selectedOSOption.estimatedCost);
    }

    return {
      instanceHourly: hourlyTotal,
      additionalCosts,
      monthlyEstimate: hourlyTotal * 730, // Average hours per month
    };
  };

  const costEstimate = calculateEstimatedCost();

  // Search marketplace AMIs
  const searchMarketplaceAMIs = async () => {
    if (!marketplaceSearch.trim()) return;
    
    setSearchingAMI(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data, error } = await supabase.functions.invoke('manage-ec2-instances', {
        body: {
          action: 'searchAMIs',
          params: { searchTerm: marketplaceSearch },
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setMarketplaceResults(data?.amis || []);
      
      if (!data?.amis?.length) {
        toast({
          title: "No AMIs Found",
          description: "No marketplace AMIs matched your search. Try different keywords.",
        });
      }
    } catch (error: any) {
      console.error('Error searching AMIs:', error);
      toast({
        variant: "destructive",
        title: "Search Failed",
        description: error.message || "Failed to search marketplace AMIs.",
      });
    } finally {
      setSearchingAMI(false);
    }
  };

  const handleLaunch = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter an instance name.",
      });
      return;
    }

    // Show cost warning for non-free tier
    const hasAdditionalCosts = !selectedOSOption?.freeTier || !selectedInstanceType?.freeTier;
    if (hasAdditionalCosts) {
      const confirmed = window.confirm(
        `⚠️ Cost Warning\n\n` +
        `This configuration will incur charges:\n` +
        `• Instance: ~$${costEstimate.instanceHourly.toFixed(4)}/hr ($${costEstimate.monthlyEstimate.toFixed(2)}/month)\n` +
        `${costEstimate.additionalCosts.length > 0 ? `• OS License: ${costEstimate.additionalCosts.join(', ')}\n` : ''}` +
        `\nDo you want to proceed?`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const osOption = allOSOptions.find(os => os.id === selectedOS);
      
      const { data, error } = await supabase.functions.invoke('manage-ec2-instances', {
          body: {
            action: 'launch',
            params: {
              name: name.trim(),
              instanceType,
              osType: selectedOS,
              customAmiId: customAmiId || undefined,
              osOwner: osOption?.owner,
              osNamePattern: osOption?.namePattern,
              keyName: selectedKeyPair || undefined,
              subnetId: selectedSubnetId && selectedSubnetId !== 'auto' ? selectedSubnetId : undefined,
              securityGroupIds: selectedSecurityGroupIds.length > 0 ? selectedSecurityGroupIds : undefined,
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

      // Open console if requested
      if (openConsoleOnLaunch && data?.instanceId && data?.region) {
        const consoleUrl = `https://${data.region}.console.aws.amazon.com/ec2/v2/home?region=${data.region}#InstanceDetails:instanceId=${data.instanceId}`;
        window.open(consoleUrl, '_blank');
      }

      onOpenChange(false);
      resetForm();
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

  const resetForm = () => {
    setName('');
    setInstanceType('t2.micro');
    setSelectedOS('amazon-linux-2023');
    setCustomAmiId('');
    setMarketplaceSearch('');
    setMarketplaceResults([]);
    setOpenConsoleOnLaunch(false);
    setOsTab('standard');
    setSelectedKeyPair('');
    setSelectedSubnetId('');
    setSelectedSecurityGroupIds([]);
    // Reset VPC to default
    const defaultVpc = vpcs.find(v => v.isDefault);
    setSelectedVpcId(defaultVpc?.id || (vpcs.length > 0 ? vpcs[0].id : ''));
  };

  const selectMarketplaceAMI = (ami: MarketplaceAMI) => {
    setCustomAmiId(ami.amiId);
    setSelectedOS('custom');
    toast({
      title: "AMI Selected",
      description: `Selected ${ami.name}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Launch EC2 Instance
          </DialogTitle>
          <DialogDescription>
            Create a new EC2 instance in your AWS account.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6 py-4">
            {/* Instance Name */}
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

            {/* Operating System Selection */}
            <div className="space-y-3">
              <Label>Operating System</Label>
              <Tabs value={osTab} onValueChange={setOsTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                  <TabsTrigger value="custom">Custom AMI</TabsTrigger>
                </TabsList>

                <TabsContent value="standard" className="mt-3">
                  <div className="grid gap-2 max-h-[200px] overflow-y-auto pr-2">
                    {STANDARD_OS_OPTIONS.map((os) => (
                      <div
                        key={os.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedOS === os.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedOS(os.id);
                          setCustomAmiId('');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{os.icon}</span>
                          <div>
                            <div className="font-medium text-sm">{os.name}</div>
                            <div className="text-xs text-muted-foreground">{os.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {os.freeTier ? (
                            <Badge variant="secondary" className="text-xs">Free Tier</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-destructive">
                              {os.estimatedCost}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="marketplace" className="mt-3 space-y-4">
                  <div className="grid gap-2 max-h-[150px] overflow-y-auto pr-2">
                    {MARKETPLACE_OS_OPTIONS.map((os) => (
                      <div
                        key={os.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedOS === os.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedOS(os.id);
                          setCustomAmiId('');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{os.icon}</span>
                          <div>
                            <div className="font-medium text-sm">{os.name}</div>
                            <div className="text-xs text-muted-foreground">{os.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {os.freeTier ? (
                            <Badge variant="secondary" className="text-xs">Free Tier</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-destructive">
                              {os.estimatedCost}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-sm">Search AWS Marketplace</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search for AMIs (e.g., security, database)..."
                        value={marketplaceSearch}
                        onChange={(e) => setMarketplaceSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchMarketplaceAMIs()}
                        disabled={loading || searchingAMI}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={searchMarketplaceAMIs}
                        disabled={loading || searchingAMI || !marketplaceSearch.trim()}
                      >
                        {searchingAMI ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {marketplaceResults.length > 0 && (
                      <div className="mt-2 max-h-[120px] overflow-y-auto border rounded-lg">
                        {marketplaceResults.map((ami) => (
                          <div
                            key={ami.amiId}
                            className="flex items-center justify-between p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => selectMarketplaceAMI(ami)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{ami.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{ami.amiId}</div>
                            </div>
                            {ami.hasProductCode && (
                              <Badge variant="outline" className="ml-2 text-xs text-destructive">
                                <DollarSign className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="custom" className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="customAmi">AMI ID</Label>
                    <Input
                      id="customAmi"
                      placeholder="ami-0123456789abcdef0"
                      value={customAmiId}
                      onChange={(e) => {
                        setCustomAmiId(e.target.value);
                        if (e.target.value) setSelectedOS('custom');
                      }}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a specific AMI ID from your region. You can find AMI IDs in the AWS Console.
                    </p>
                  </div>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Custom AMIs may have software costs. Check the AWS Marketplace for pricing details.
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </div>

            {/* Instance Type */}
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
            </div>

            {/* Networking - VPC, Subnet, Security Groups */}
            {vpcs.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Networking</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vpc">VPC</Label>
                  <Select value={selectedVpcId} onValueChange={setSelectedVpcId} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a VPC" />
                    </SelectTrigger>
                    <SelectContent>
                      {vpcs.map((vpc) => (
                        <SelectItem key={vpc.id} value={vpc.id}>
                          {vpc.name || vpc.id} ({vpc.cidrBlock}){vpc.isDefault ? ' — Default' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subnet">Subnet (Optional)</Label>
                  <Select value={selectedSubnetId} onValueChange={setSelectedSubnetId} disabled={loading || !selectedVpcId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-assign (default subnet)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-assign (default subnet)</SelectItem>
                      {filteredSubnets.map((subnet) => (
                        <SelectItem key={subnet.id} value={subnet.id}>
                          {subnet.name || subnet.id} · {subnet.availabilityZone} · {subnet.availableIps} IPs free
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filteredSecurityGroups.length > 0 && (
                  <div className="space-y-2">
                    <Label>Security Groups (Optional)</Label>
                    <div className="max-h-[120px] overflow-y-auto border rounded-md p-2 space-y-1">
                      {filteredSecurityGroups.map((sg) => (
                        <div
                          key={sg.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setSelectedSecurityGroupIds(prev =>
                              prev.includes(sg.id) ? prev.filter(id => id !== sg.id) : [...prev, sg.id]
                            );
                          }}
                        >
                          <Checkbox
                            checked={selectedSecurityGroupIds.includes(sg.id)}
                            onCheckedChange={() => {
                              setSelectedSecurityGroupIds(prev =>
                                prev.includes(sg.id) ? prev.filter(id => id !== sg.id) : [...prev, sg.id]
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{sg.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{sg.id} — {sg.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedSecurityGroupIds.length === 0 && (
                      <p className="text-xs text-muted-foreground">No selection = VPC default security group</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Key Pair Selection */}
            <div className="space-y-2">
              <Label htmlFor="keyPair">SSH Key Pair (Optional)</Label>
              <Select 
                value={selectedKeyPair} 
                onValueChange={setSelectedKeyPair} 
                disabled={loading || loadingKeyPairs}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingKeyPairs ? "Loading key pairs..." : "Select a key pair..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Proceed without key pair</SelectItem>
                  {keyPairs.map((kp) => (
                    <SelectItem key={kp.name} value={kp.name}>
                      {kp.name} ({kp.keyType || 'rsa'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  SSH key for traditional terminal access
                </p>
                <a
                   href="https://console.aws.amazon.com/ec2/v2/home#KeyPairs:"
                   target="_blank"
                   rel="noopener noreferrer"
                   className="inline-flex items-center gap-1 text-xs text-link hover:underline"
                 >
                   <ExternalLink className="h-3 w-3" />
                   Create in AWS
                 </a>
              </div>
              {(!selectedKeyPair || selectedKeyPair === 'none') && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
                    Without a key pair, you can only connect via EC2 Instance Connect (requires public IP and Port 22 open).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Open Console Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Open in AWS Console</Label>
                <div className="text-sm text-muted-foreground">
                  Opens the instance details in a new window after launch
                </div>
              </div>
              <Switch
                checked={openConsoleOnLaunch}
                onCheckedChange={setOpenConsoleOnLaunch}
                disabled={loading}
              />
            </div>

            {/* Cost Estimate */}
            <Alert className={costEstimate.additionalCosts.length > 0 || !selectedInstanceType?.freeTier ? 'border-destructive/50' : ''}>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-medium">Estimated Costs</div>
                  <div className="text-sm">
                    <div>Instance: ~${costEstimate.instanceHourly.toFixed(4)}/hr (${costEstimate.monthlyEstimate.toFixed(2)}/month)</div>
                    {costEstimate.additionalCosts.map((cost, i) => (
                      <div key={i} className="text-destructive">+ {cost}</div>
                    ))}
                    {selectedInstanceType?.freeTier && selectedOSOption?.freeTier && (
                      <div className="text-primary font-medium mt-1">
                        ✓ Eligible for Free Tier (750 hrs/month for first 12 months)
                      </div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Permissions Info */}
            <Alert>
              <Server className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Requires <code className="bg-muted px-1 rounded">ec2:RunInstances</code> and{' '}
                <code className="bg-muted px-1 rounded">ec2:DescribeImages</code> permissions.
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
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
