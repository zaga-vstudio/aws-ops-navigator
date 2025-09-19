import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Network, 
  Shield, 
  Globe,
  Plus,
  Filter,
  MoreVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VPC {
  id: string;
  name: string;
  cidrBlock: string;
  state: 'available' | 'pending';
  isDefault: boolean;
  subnets: number;
  region: string;
}

interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidrBlock: string;
  availabilityZone: string;
  type: 'public' | 'private';
  availableIps: number;
}

interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  vpcId: string;
  inboundRules: number;
  outboundRules: number;
}

const mockVPCs: VPC[] = [
  {
    id: "vpc-0123456789abcdef0",
    name: "main-vpc",
    cidrBlock: "10.0.0.0/16",
    state: "available",
    isDefault: false,
    subnets: 4,
    region: "us-east-1"
  },
  {
    id: "vpc-0987654321fedcba0",
    name: "default",
    cidrBlock: "172.31.0.0/16",
    state: "available",
    isDefault: true,
    subnets: 6,
    region: "us-east-1"
  }
];

const mockSubnets: Subnet[] = [
  {
    id: "subnet-0123456789abcdef0",
    name: "public-subnet-1",
    vpcId: "vpc-0123456789abcdef0",
    cidrBlock: "10.0.1.0/24",
    availabilityZone: "us-east-1a",
    type: "public",
    availableIps: 251
  },
  {
    id: "subnet-0123456789abcdef1",
    name: "private-subnet-1",
    vpcId: "vpc-0123456789abcdef0",
    cidrBlock: "10.0.2.0/24",
    availabilityZone: "us-east-1a",
    type: "private",
    availableIps: 254
  },
  {
    id: "subnet-0123456789abcdef2",
    name: "public-subnet-2",
    vpcId: "vpc-0123456789abcdef0",
    cidrBlock: "10.0.3.0/24",
    availabilityZone: "us-east-1b",
    type: "public",
    availableIps: 248
  }
];

const mockSecurityGroups: SecurityGroup[] = [
  {
    id: "sg-0123456789abcdef0",
    name: "web-servers-sg",
    description: "Security group for web servers",
    vpcId: "vpc-0123456789abcdef0",
    inboundRules: 3,
    outboundRules: 1
  },
  {
    id: "sg-0987654321fedcba0",
    name: "database-sg",
    description: "Security group for database servers",
    vpcId: "vpc-0123456789abcdef0",
    inboundRules: 2,
    outboundRules: 1
  },
  {
    id: "sg-0abcdef123456789",
    name: "default",
    description: "Default security group",
    vpcId: "vpc-0987654321fedcba0",
    inboundRules: 1,
    outboundRules: 1
  }
];

const VPCNetworking = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [vpcs, setVpcs] = useState<VPC[]>(mockVPCs);
  const [subnets, setSubnets] = useState<Subnet[]>(mockSubnets);
  const [securityGroups, setSecurityGroups] = useState<SecurityGroup[]>(mockSecurityGroups);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
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
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Create VPC
                  </Button>
                </div>
              </div>

              {/* Overview Cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total VPCs</CardTitle>
                    <Network className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{vpcs.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Subnets</CardTitle>
                    <Globe className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{subnets.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
                    <Shield className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{securityGroups.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Available IPs</CardTitle>
                    <Network className="h-4 w-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {subnets.reduce((sum, subnet) => sum + subnet.availableIps, 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs Content */}
              <Tabs defaultValue="vpcs" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="vpcs">VPCs</TabsTrigger>
                  <TabsTrigger value="subnets">Subnets</TabsTrigger>
                  <TabsTrigger value="security">Security Groups</TabsTrigger>
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
                            {vpcs.map((vpc) => (
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
                                <TableCell>{vpc.subnets}</TableCell>
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
                            ))}
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
                            {subnets.map((subnet) => (
                              <TableRow key={subnet.id}>
                                <TableCell className="font-mono text-sm">{subnet.id}</TableCell>
                                <TableCell className="font-medium">{subnet.name}</TableCell>
                                <TableCell className="font-mono text-sm">{subnet.vpcId}</TableCell>
                                <TableCell className="font-mono">{subnet.cidrBlock}</TableCell>
                                <TableCell>{subnet.availabilityZone}</TableCell>
                                <TableCell>
                                  <Badge variant={subnet.type === 'public' ? 'default' : 'secondary'}>
                                    {subnet.type}
                                  </Badge>
                                </TableCell>
                                <TableCell>{subnet.availableIps}</TableCell>
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
                            ))}
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
                            {securityGroups.map((sg) => (
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
                            ))}
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