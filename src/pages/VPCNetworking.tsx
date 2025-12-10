import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAWSData } from "@/hooks/useAWSData";
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
  Filter,
  MoreVertical,
  RefreshCw,
  Link2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VPCNetworking = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: awsData, loading: dataLoading, error, refetch } = useAWSData();
  
  const vpcs = awsData?.vpcs || [];
  const subnets = awsData?.subnets || [];
  const securityGroups = awsData?.securityGroups || [];
  const vpcPeeringConnections = awsData?.vpcPeeringConnections || [];
  const loading = authLoading || dataLoading;

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
                  <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Create VPC
                  </Button>
                </div>
              </div>

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
                                          <DropdownMenuItem className="text-destructive">
                                            Delete VPC
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
                                        <DropdownMenuItem className="text-destructive">
                                          Delete Subnet
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