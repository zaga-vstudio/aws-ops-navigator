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
import { 
  Server, 
  Play, 
  Square, 
  RotateCcw, 
  MoreVertical,
  Plus,
  Filter,
  RefreshCw
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getStateColor = (state: string) => {
  switch (state) {
    case 'running': return 'default';
    case 'stopped': return 'secondary';
    case 'pending': return 'outline';
    case 'stopping': return 'outline';
    case 'terminated': return 'destructive';
    default: return 'secondary';
  }
};

const getStateIcon = (state: string) => {
  switch (state) {
    case 'running': return <Play className="h-3 w-3 text-green-500" />;
    case 'stopped': return <Square className="h-3 w-3 text-red-500" />;
    case 'pending': return <RotateCcw className="h-3 w-3 text-yellow-500 animate-spin" />;
    default: return <Square className="h-3 w-3" />;
  }
};

const EC2Instances = () => {
  const { user, loading } = useAuth();
  const { data: awsData, loading: awsLoading, refetch } = useAWSData();
  const navigate = useNavigate();

  const instances = awsData?.ec2Instances || [];

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
                    EC2 Instances
                  </h1>
                  <p className="text-muted-foreground">
                    Manage and monitor your EC2 instances
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={refetch}
                    disabled={awsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${awsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                  <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Launch Instance
                  </Button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Instances</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {awsLoading ? (
                      <div className="w-16 h-8 bg-muted animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-bold">{instances.length}</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Running</CardTitle>
                    <Play className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    {awsLoading ? (
                      <div className="w-16 h-8 bg-muted animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-bold text-green-600">
                        {instances.filter(i => i.state === 'running').length}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stopped</CardTitle>
                    <Square className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    {awsLoading ? (
                      <div className="w-16 h-8 bg-muted animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-bold text-red-600">
                        {instances.filter(i => i.state === 'stopped').length}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Other</CardTitle>
                    <RotateCcw className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    {awsLoading ? (
                      <div className="w-16 h-8 bg-muted animate-pulse rounded" />
                    ) : (
                      <div className="text-2xl font-bold text-yellow-600">
                        {instances.filter(i => !['running', 'stopped'].includes(i.state)).length}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Instances Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Instance Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {awsLoading ? (
                    <div className="space-y-2">
                      <div className="w-full h-10 bg-muted animate-pulse rounded" />
                      <div className="w-full h-10 bg-muted animate-pulse rounded" />
                      <div className="w-full h-10 bg-muted animate-pulse rounded" />
                    </div>
                  ) : instances.length === 0 ? (
                    <div className="text-center py-12">
                      <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No hay instancias EC2</h3>
                      <p className="text-muted-foreground mb-4">
                        No se encontraron instancias en tu cuenta de AWS
                      </p>
                      <Button className="bg-gradient-to-r from-primary to-primary-glow">
                        <Plus className="h-4 w-4 mr-2" />
                        Launch Instance
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Instance ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>State</TableHead>
                            <TableHead>Availability Zone</TableHead>
                            <TableHead>Public IP</TableHead>
                            <TableHead>Private IP</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {instances.map((instance) => (
                            <TableRow key={instance.id}>
                              <TableCell className="font-mono text-sm">{instance.id}</TableCell>
                              <TableCell className="font-medium">{instance.name}</TableCell>
                              <TableCell>{instance.type}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStateIcon(instance.state)}
                                  <Badge variant={getStateColor(instance.state) as any}>
                                    {instance.state}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>{instance.availabilityZone}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {instance.publicIp || '-'}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{instance.privateIp}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Connect</DropdownMenuItem>
                                    <DropdownMenuItem>
                                      {instance.state === 'running' ? 'Stop' : 'Start'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>Reboot</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive">
                                      Terminate
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default EC2Instances;