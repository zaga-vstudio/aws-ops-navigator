import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAWSData, VPC, Subnet } from "@/hooks/useAWSData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Network, 
  Shield, 
  Globe,
  Plus,
  MoreVertical,
  RefreshCw,
  Link2,
  Loader2,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateVPCDialog } from "@/components/CreateVPCDialog";
import { VPCBlastRadiusDialog } from "@/components/VPCBlastRadiusDialog";
import { SubnetBlastRadiusDialog } from "@/components/SubnetBlastRadiusDialog";

const VPCNetworking = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: awsData, loading: dataLoading, error, refetch } = useAWSData();
  const [createVPCDialogOpen, setCreateVPCDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [blastRadiusDialogOpen, setBlastRadiusDialogOpen] = useState(false);
  const [selectedVPCForDeletion, setSelectedVPCForDeletion] = useState<VPC | null>(null);
  const [subnetBlastRadiusDialogOpen, setSubnetBlastRadiusDialogOpen] = useState(false);
  const [selectedSubnetForDeletion, setSelectedSubnetForDeletion] = useState<Subnet | null>(null);
  
  const vpcs = awsData?.vpcs || [];
  const subnets = awsData?.subnets || [];
  const securityGroups = awsData?.securityGroups || [];
  const vpcPeeringConnections = awsData?.vpcPeeringConnections || [];
  const ec2Instances = awsData?.ec2Instances || [];
  const rdsDatabases = awsData?.rdsDatabases || [];
  const loading = authLoading || dataLoading;

  const handleOpenBlastRadius = (vpc: VPC) => {
    setSelectedVPCForDeletion(vpc);
    setBlastRadiusDialogOpen(true);
  };

  const handleOpenSubnetBlastRadius = (subnet: Subnet) => {
    setSelectedSubnetForDeletion(subnet);
    setSubnetBlastRadiusDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedVPCForDeletion) return;

    const vpcId = selectedVPCForDeletion.id;
    const vpcName = selectedVPCForDeletion.name;
    
    setActionLoading(`delete-${vpcId}`);

    try {
      const { data, error } = await supabase.functions.invoke('manage-vpcs', {
        body: { action: 'delete-vpc', vpcId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "VPC deleted",
        description: `${vpcName || vpcId} has been deleted.`,
      });

      setBlastRadiusDialogOpen(false);
      setSelectedVPCForDeletion(null);
      setTimeout(() => refetch(), 1000);
    } catch (error: any) {
      console.error('Delete VPC error:', error);
      toast({
        title: "Failed to delete VPC",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmSubnetDelete = async () => {
    if (!selectedSubnetForDeletion) return;

    const subnetId = selectedSubnetForDeletion.id;
    const subnetName = selectedSubnetForDeletion.name;
    
    setActionLoading(`delete-subnet-${subnetId}`);

    try {
      const { data, error } = await supabase.functions.invoke('manage-vpcs', {
        body: { action: 'delete-subnet', subnetId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Subnet deleted",
        description: `${subnetName || subnetId} has been deleted.`,
      });

      setSubnetBlastRadiusDialogOpen(false);
      setSelectedSubnetForDeletion(null);
      setTimeout(() => refetch(), 1000);
    } catch (error: any) {
      console.error('Delete subnet error:', error);
      toast({
        title: "Failed to delete subnet",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasData = vpcs.length > 0 || subnets.length > 0 || securityGroups.length > 0 || vpcPeeringConnections.length > 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        <header className="h-12 flex items-center border-b border-border/50 px-4">
          <SidebarTrigger className="mr-4" />
          <div className="flex-1">
            <Header />
          </div>
        </header>

        <div className="flex w-full">
          <AppSidebar />
          
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    VPC Networking
                  </h1>
                  <p className="text-muted-foreground">
                    Manage your Virtual Private Clouds, subnets, and security groups
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={refetch}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-primary to-primary-glow"
                    onClick={() => setCreateVPCDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create VPC
                  </Button>
                </div>
              </div>

              <CreateVPCDialog
                open={createVPCDialogOpen}
                onOpenChange={setCreateVPCDialogOpen}
                onSuccess={refetch}
              />

              <VPCBlastRadiusDialog
                open={blastRadiusDialogOpen}
                onOpenChange={(open) => {
                  setBlastRadiusDialogOpen(open);
                  if (!open) setSelectedVPCForDeletion(null);
                }}
                vpc={selectedVPCForDeletion}
                subnets={subnets}
                securityGroups={securityGroups}
                ec2Instances={ec2Instances}
                rdsDatabases={rdsDatabases}
                vpcPeeringConnections={vpcPeeringConnections}
                onConfirmDelete={handleConfirmDelete}
                isDeleting={actionLoading !== null}
              />

              <SubnetBlastRadiusDialog
                open={subnetBlastRadiusDialogOpen}
                onOpenChange={(open) => {
                  setSubnetBlastRadiusDialogOpen(open);
                  if (!open) setSelectedSubnetForDeletion(null);
                }}
                subnet={selectedSubnetForDeletion}
                ec2Instances={ec2Instances}
                onConfirmDelete={handleConfirmSubnetDelete}
                isDeleting={actionLoading !== null}
              />

              {/* Error/Empty State Banner */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error.message}
                  </AlertDescription>
                </Alert>
              )}
              
              {!error && !hasData && !loading && (
                <Alert>
                  <AlertDescription>
                    No VPC resources found. Make sure your AWS credentials are configured correctly.
                  </AlertDescription>
                </Alert>
              )}

              {/* Overview Cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total VPCs</CardTitle>
                    <Network className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <div className="text-2xl font-bold">{vpcs.length}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Subnets</CardTitle>
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <div className="text-2xl font-bold">{subnets.length}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <div className="text-2xl font-bold">{securityGroups.length}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Peering Connections</CardTitle>
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <div className="text-2xl font-bold">{vpcPeeringConnections.length}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tabs Content */}
              <Tabs defaultValue="vpcs" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="vpcs">VPCs</TabsTrigger>
                  <TabsTrigger value="subnets">Subnets</TabsTrigger>
                  <TabsTrigger value="security">Security Groups</TabsTrigger>
                  <TabsTrigger value="peering">Peering</TabsTrigger>
                </TabsList>

                <TabsContent value="vpcs">
                  <Card>
                    <CardHeader>
                      <CardTitle>Virtual Private Clouds</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>VPC ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>CIDR Block</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead>Default</TableHead>
                              <TableHead>Subnets</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              Array(3).fill(0).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                </TableRow>
                              ))
                            ) : vpcs.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  No VPCs found
                                </TableCell>
                              </TableRow>
                            ) : (
                              vpcs.map((vpc) => {
                                const vpcSubnetCount = subnets.filter(s => s.vpcId === vpc.id).length;
                                return (
                                  <TableRow key={vpc.id}>
                                    <TableCell className="font-mono text-sm">{vpc.id}</TableCell>
                                    <TableCell className="font-medium">{vpc.name}</TableCell>
                                    <TableCell className="font-mono">{vpc.cidrBlock}</TableCell>
                                    <TableCell>
                                      <Badge variant={vpc.state === 'available' ? 'default' : 'secondary'}>
                                        {vpc.state}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={vpc.isDefault ? 'default' : 'outline'}>
                                        {vpc.isDefault ? 'Yes' : 'No'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{vpcSubnetCount}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem>View Details</DropdownMenuItem>
                                          <DropdownMenuItem>Create Subnet</DropdownMenuItem>
                                          <DropdownMenuItem>Manage Route Tables</DropdownMenuItem>
                                          <DropdownMenuItem 
                                            className="text-destructive"
                                            onClick={() => handleOpenBlastRadius(vpc)}
                                            disabled={vpc.isDefault || actionLoading !== null}
                                          >
                                            <AlertTriangle className="mr-2 h-4 w-4" />
                                            {vpc.isDefault ? "Cannot delete default" : "Delete VPC..."}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="subnets">
                  <Card>
                    <CardHeader>
                      <CardTitle>Subnets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subnet ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>VPC</TableHead>
                              <TableHead>CIDR Block</TableHead>
                              <TableHead>AZ</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Available IPs</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              Array(3).fill(0).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                </TableRow>
                              ))
                            ) : subnets.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                  No subnets found
                                </TableCell>
                              </TableRow>
                            ) : (
                              subnets.map((subnet) => (
                                <TableRow key={subnet.id}>
                                  <TableCell className="font-mono text-sm">{subnet.id}</TableCell>
                                  <TableCell className="font-medium">{subnet.name}</TableCell>
                                  <TableCell className="font-mono text-sm">{subnet.vpcId}</TableCell>
                                  <TableCell className="font-mono">{subnet.cidrBlock}</TableCell>
                                  <TableCell>{subnet.availabilityZone}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">N/A</Badge>
                                  </TableCell>
                                  <TableCell>{subnet.availableIps.toLocaleString()}</TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem>View Details</DropdownMenuItem>
                                        <DropdownMenuItem>Manage Route Table</DropdownMenuItem>
                                        <DropdownMenuItem>Network ACLs</DropdownMenuItem>
                                        <DropdownMenuItem 
                                          className="text-destructive"
                                          onClick={() => handleOpenSubnetBlastRadius(subnet)}
                                          disabled={actionLoading !== null}
                                        >
                                          <AlertTriangle className="mr-2 h-4 w-4" />
                                          Delete Subnet...
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Groups</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Group ID</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>VPC</TableHead>
                              <TableHead>Inbound Rules</TableHead>
                              <TableHead>Outbound Rules</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              Array(3).fill(0).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                </TableRow>
                              ))
                            ) : securityGroups.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  No security groups found
                                </TableCell>
                              </TableRow>
                            ) : (
                              securityGroups.map((sg) => (
                                <TableRow key={sg.id}>
                                  <TableCell className="font-mono text-sm">{sg.id}</TableCell>
                                  <TableCell className="font-medium">{sg.name}</TableCell>
                                  <TableCell>{sg.description}</TableCell>
                                  <TableCell className="font-mono text-sm">{sg.vpcId}</TableCell>
                                  <TableCell>{sg.inboundRules}</TableCell>
                                  <TableCell>{sg.outboundRules}</TableCell>
                                  <TableCell className="text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem>Edit Rules</DropdownMenuItem>
                                        <DropdownMenuItem>Copy Security Group</DropdownMenuItem>
                                        <DropdownMenuItem>View References</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive">
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="peering">
                  <Card>
                    <CardHeader>
                      <CardTitle>VPC Peering Connections</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Peering ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Requester VPC</TableHead>
                              <TableHead>Accepter VPC</TableHead>
                              <TableHead>Requester CIDR</TableHead>
                              <TableHead>Accepter CIDR</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loading ? (
                              Array(3).fill(0).map((_, i) => (
                                <TableRow key={i}>
                                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                </TableRow>
                              ))
                            ) : vpcPeeringConnections.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                  No VPC peering connections found. Create a peering connection to link VPCs.
                                </TableCell>
                              </TableRow>
                            ) : (
                              vpcPeeringConnections.map((peering) => {
                                const getStatusVariant = (status: string) => {
                                  switch (status) {
                                    case 'active': return 'default';
                                    case 'pending-acceptance': return 'secondary';
                                    case 'deleted': case 'rejected': case 'failed': return 'destructive';
                                    default: return 'outline';
                                  }
                                };
                                const nameTag = peering.tags.find(t => t.key === 'Name');
                                return (
                                  <TableRow key={peering.id}>
                                    <TableCell>
                                      <div className="font-mono text-sm">{peering.id}</div>
                                      {nameTag && <div className="text-xs text-muted-foreground">{nameTag.value}</div>}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getStatusVariant(peering.status)}>
                                        {peering.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{peering.requesterVpcId}</TableCell>
                                    <TableCell className="font-mono text-sm">{peering.accepterVpcId}</TableCell>
                                    <TableCell className="font-mono text-sm">{peering.requesterCidrBlock}</TableCell>
                                    <TableCell className="font-mono text-sm">{peering.accepterCidrBlock}</TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem>View Details</DropdownMenuItem>
                                          {peering.status === 'pending-acceptance' && (
                                            <DropdownMenuItem>Accept Connection</DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem>Manage Route Tables</DropdownMenuItem>
                                          <DropdownMenuItem className="text-destructive">
                                            Delete Connection
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default VPCNetworking;