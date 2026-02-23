import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Database, 
  Circle, 
  AlertCircle, 
  Clock,
  MoreVertical,
  Plus,
  RefreshCw,
  Loader2,
  Copy,
  Check
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateRDSDialog } from "@/components/CreateRDSDialog";
import { ManageRDSSecurityGroupsDialog } from "@/components/ManageRDSSecurityGroupsDialog";
import type { RDSDatabase } from "@/hooks/useAWSData";

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available': return 'default';
    case 'creating': return 'outline';
    case 'modifying': return 'outline';
    case 'maintenance': return 'secondary';
    case 'backing-up': return 'secondary';
    case 'stopped': return 'destructive';
    default: return 'secondary';
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available': return <Circle className="h-3 w-3 text-green-500 fill-current" />;
    case 'creating': return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
    case 'modifying': return <Clock className="h-3 w-3 text-yellow-500 animate-pulse" />;
    case 'maintenance': return <AlertCircle className="h-3 w-3 text-orange-500" />;
    case 'backing-up': return <Clock className="h-3 w-3 text-blue-500 animate-pulse" />;
    case 'stopped': return <Circle className="h-3 w-3 text-red-500" />;
    default: return <Circle className="h-3 w-3 text-gray-500" />;
  }
};

const RDSDatabases = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: awsData, loading: awsLoading, error: awsError, refetch } = useAWSDataContext();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [sgDialogDb, setSgDialogDb] = useState<RDSDatabase | null>(null);

  const handleCopyEndpoint = async (endpoint: string) => {
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedEndpoint(endpoint);
      toast({ title: "Copied!", description: "Endpoint copied to clipboard." });
      setTimeout(() => setCopiedEndpoint(null), 2000);
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Please copy manually." });
    }
  };

  const databases = awsData?.rdsDatabases || [];

  const handleRDSAction = async (action: 'start' | 'stop' | 'reboot' | 'delete', dbIdentifier: string) => {
    if (action === 'delete' && !confirm(`Are you sure you want to delete ${dbIdentifier}? This action cannot be undone.`)) {
      return;
    }

    setActionLoading(`${action}-${dbIdentifier}`);

    try {
      const { data, error } = await supabase.functions.invoke('manage-rds-instances', {
        body: { action, dbInstanceIdentifier: dbIdentifier },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} initiated`,
        description: `${dbIdentifier} is being ${action === 'delete' ? 'deleted' : action + 'ed'}.`,
      });

      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      console.error(`RDS ${action} error:`, error);
      toast({
        title: `Failed to ${action} database`,
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || awsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AWS data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const totalStorage = databases.reduce((sum, db) => sum + db.allocatedStorage, 0);
  const multiAZCount = databases.length; // All RDS instances shown in the API

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
                    RDS Databases
                  </h1>
                  <p className="text-muted-foreground">
                    Manage and monitor your RDS database instances
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-primary to-primary-glow"
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Database
                  </Button>
                </div>

                <CreateRDSDialog
                  open={createDialogOpen}
                  onOpenChange={setCreateDialogOpen}
                  onSuccess={refetch}
                  vpcs={awsData?.vpcs}
                  subnets={awsData?.subnets}
                  securityGroups={awsData?.securityGroups}
                />

                {sgDialogDb && (
                  <ManageRDSSecurityGroupsDialog
                    open={!!sgDialogDb}
                    onOpenChange={(open) => { if (!open) setSgDialogDb(null); }}
                    onSuccess={refetch}
                    database={sgDialogDb}
                    securityGroups={awsData?.securityGroups || []}
                  />
                )}
              </div>

              {/* Stats Cards */}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Databases</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{databases.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Available</CardTitle>
                    <Circle className="h-4 w-4 text-green-500 fill-current" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {databases.filter(db => db.state === 'available').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
                    <Database className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {totalStorage} GB
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Databases</CardTitle>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {databases.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Databases Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Database Instances</CardTitle>
                </CardHeader>
                <CardContent>
                  {awsError ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                      <p className="text-muted-foreground">Failed to load RDS databases</p>
                      <Button variant="outline" className="mt-4" onClick={refetch}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  ) : databases.length === 0 ? (
                    <div className="text-center py-8">
                      <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No RDS databases found</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Create a new database or check your AWS credentials
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>DB Identifier</TableHead>
                            <TableHead>Engine</TableHead>
                            <TableHead>Version</TableHead>
                            <TableHead>Instance Class</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Storage</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead>Security Groups</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {databases.map((database) => (
                            <TableRow key={database.id}>
                              <TableCell className="font-medium">{database.name}</TableCell>
                              <TableCell>{database.engine}</TableCell>
                              <TableCell className="font-mono text-sm">{database.engineVersion}</TableCell>
                              <TableCell>{database.instanceClass}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(database.state)}
                                  <Badge variant={getStatusColor(database.state) as any}>
                                    {database.state}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>{database.allocatedStorage} GB</TableCell>
                              <TableCell>{database.region}</TableCell>
                              <TableCell>
                                {database.vpcSecurityGroups && database.vpcSecurityGroups.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {database.vpcSecurityGroups.slice(0, 2).map((sg) => (
                                      <Badge key={sg.id} variant="outline" className="text-xs font-mono gap-1">
                                        <Shield className="h-3 w-3" />
                                        {sg.id}
                                      </Badge>
                                    ))}
                                    {database.vpcSecurityGroups.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{database.vpcSecurityGroups.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="max-w-[250px]">
                                {database.endpoint ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1.5 group">
                                          <span className="font-mono text-xs truncate">{database.endpoint}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleCopyEndpoint(database.endpoint!)}
                                          >
                                            {copiedEndpoint === database.endpoint ? (
                                              <Check className="h-3 w-3 text-green-500" />
                                            ) : (
                                              <Copy className="h-3 w-3" />
                                            )}
                                          </Button>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-sm">
                                        <p className="font-mono text-xs break-all">{database.endpoint}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => handleRDSAction('start', database.name)}
                                      disabled={database.state === 'available' || actionLoading !== null}
                                    >
                                      {actionLoading === `start-${database.name}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Start
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleRDSAction('stop', database.name)}
                                      disabled={database.state === 'stopped' || actionLoading !== null}
                                    >
                                      {actionLoading === `stop-${database.name}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Stop
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleRDSAction('reboot', database.name)}
                                      disabled={database.state !== 'available' || actionLoading !== null}
                                    >
                                      {actionLoading === `reboot-${database.name}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Reboot
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => setSgDialogDb(database)}
                                      disabled={actionLoading !== null}
                                    >
                                      <Shield className="mr-2 h-4 w-4" />
                                      Manage Security Groups
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleRDSAction('delete', database.name)}>
                                      {actionLoading === `delete-${database.name}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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

export default RDSDatabases;