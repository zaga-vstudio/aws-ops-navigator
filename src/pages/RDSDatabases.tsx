import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Database, 
  Circle, 
  AlertCircle, 
  Clock,
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
import { useAWSData } from "@/hooks/useAWSData";

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
  const { data: awsData, loading: awsLoading, error: awsError, refetch } = useAWSData();

  const databases = awsData?.rdsDatabases || [];

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
                  <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Database
                  </Button>
                </div>
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
                              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                {database.endpoint || '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Connect</DropdownMenuItem>
                                    <DropdownMenuItem>Modify</DropdownMenuItem>
                                    <DropdownMenuItem>Create Snapshot</DropdownMenuItem>
                                    <DropdownMenuItem>View Monitoring</DropdownMenuItem>
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