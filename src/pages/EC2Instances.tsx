import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { useAWSData, EC2Instance, SecurityGroup } from "@/hooks/useAWSData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LaunchEC2Dialog } from "@/components/LaunchEC2Dialog";
import { SSHCommandDialog } from "@/components/SSHCommandDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Server, 
  Play, 
  Square, 
  RotateCcw, 
  MoreVertical,
  Plus,
  Filter,
  RefreshCw,
  Loader2,
  Terminal,
  AlertTriangle
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

// OS to SSH user mapping for EC2 Instance Connect
const getDefaultSSHUser = (platformId?: string, sshUser?: string): { user: string; isDefault: boolean } => {
  // If we have an explicit SSH user from the tag, use it
  if (sshUser) {
    return { user: sshUser, isDefault: false };
  }
  
  // Map known platform IDs to SSH users
  const platformUserMap: Record<string, string> = {
    'amazon-linux-2023': 'ec2-user',
    'amazon-linux-2': 'ec2-user',
    'ubuntu-22': 'ubuntu',
    'ubuntu-24': 'ubuntu',
    'debian-12': 'admin',
    'rhel-9': 'ec2-user',
    'centos-stream-9': 'centos',
    'rocky-linux-9': 'rocky',
    'alma-linux-9': 'almalinux',
    'kali-linux': 'kali',
    'suse-15': 'ec2-user',
  };
  
  if (platformId && platformUserMap[platformId]) {
    return { user: platformUserMap[platformId], isDefault: false };
  }
  
  // Default fallback for custom/unknown AMIs
  return { user: 'ec2-user', isDefault: true };
};

// Check if Port 22 is open in any of the instance's security groups
const isPort22Open = (instance: EC2Instance, securityGroups: SecurityGroup[]): boolean => {
  if (!instance.securityGroupIds || instance.securityGroupIds.length === 0) {
    return false;
  }
  
  // Find security groups attached to this instance
  const instanceSecurityGroups = securityGroups.filter(sg => 
    instance.securityGroupIds?.includes(sg.id)
  );
  
  // Check if any security group has an inbound rule allowing port 22
  for (const sg of instanceSecurityGroups) {
    for (const rule of sg.inboundRules) {
      // Check for SSH port (22) or all traffic (-1)
      const isAllTraffic = rule.ipProtocol === '-1';
      const isTCPPort22 = rule.ipProtocol === 'tcp' && 
        rule.fromPort !== undefined && 
        rule.toPort !== undefined &&
        rule.fromPort <= 22 && 
        rule.toPort >= 22;
      
      if (isAllTraffic || isTCPPort22) {
        return true;
      }
    }
  }
  
  return false;
};

const EC2Instances = () => {
  const { user, loading } = useAuth();
  const { data: awsData, loading: awsLoading, refetch } = useAWSData();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [launchDialogOpen, setLaunchDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sshDialogInstance, setSSHDialogInstance] = useState<EC2Instance | null>(null);

  const instances = awsData?.ec2Instances || [];
  const securityGroups = awsData?.securityGroups || [];

  // Generate EC2 Instance Connect URL with all required parameters
  const getConnectUrl = (instance: EC2Instance): string => {
    const { user } = getDefaultSSHUser(instance.platformId, instance.sshUser);
    const region = instance.availabilityZone.slice(0, -1);
    return `https://${region}.console.aws.amazon.com/ec2-instance-connect/ssh?region=${region}&connType=standard&instanceId=${instance.id}&osUser=${user}&sshPort=22&addressFamily=ipv4`;
  };

  // Generate AWS Console "Connect to Instance" URL (for SSH key pair instructions)
  const getSSHConnectUrl = (instance: EC2Instance): string => {
    const region = instance.availabilityZone.slice(0, -1);
    return `https://${region}.console.aws.amazon.com/ec2/home?region=${region}#ConnectToInstance:instanceId=${instance.id}`;
  };

  const handleConnectClick = (instance: EC2Instance) => {
    const { isDefault } = getDefaultSSHUser(instance.platformId, instance.sshUser);
    if (isDefault) {
      toast({
        title: "Using default username",
        description: `Trying ec2-user. If connection fails, the correct username may vary for custom AMIs.`,
      });
    }
  };

  const handleInstanceAction = async (action: 'start' | 'stop' | 'reboot' | 'terminate', instanceId: string, instanceName: string) => {
    if (action === 'terminate') {
      const confirmed = window.confirm(`Are you sure you want to terminate instance "${instanceName}" (${instanceId})? This action cannot be undone.`);
      if (!confirmed) return;
    }

    setActionLoading(instanceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('manage-ec2-instances', {
        body: { action, instanceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      const actionMessages: Record<string, string> = {
        start: 'starting',
        stop: 'stopping',
        reboot: 'rebooting',
        terminate: 'terminating',
      };

      toast({
        title: `Instance ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        description: `Instance ${instanceName} is ${actionMessages[action]}...`,
      });

      // Refresh data after a short delay
      setTimeout(() => refetch(), 2000);
    } catch (error: any) {
      console.error(`Error ${action} instance:`, error);
      toast({
        variant: "destructive",
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Failed`,
        description: error.message || `Failed to ${action} instance. Please check your AWS permissions.`,
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
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-primary to-primary-glow"
                    onClick={() => setLaunchDialogOpen(true)}
                  >
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
                      <Button 
                        className="bg-gradient-to-r from-primary to-primary-glow"
                        onClick={() => setLaunchDialogOpen(true)}
                      >
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
                                {actionLoading === instance.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" className="h-8 w-8 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {/* Connect button - only show for running non-Windows instances */}
                                      {instance.state === 'running' && 
                                       !instance.platform?.toLowerCase().includes('windows') && 
                                       !instance.platformId?.toLowerCase().includes('windows') && (
                                        <>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <DropdownMenuItem
                                                  asChild
                                                  disabled={!instance.publicIp}
                                                  className={!isPort22Open(instance, securityGroups) ? 'text-amber-500' : ''}
                                                >
                                                  <a
                                                    href={getConnectUrl(instance)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => handleConnectClick(instance)}
                                                  >
                                                    <Terminal className="h-4 w-4 mr-2" />
                                                    Connect
                                                    {!isPort22Open(instance, securityGroups) && instance.publicIp && (
                                                      <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
                                                    )}
                                                  </a>
                                                </DropdownMenuItem>
                                              </TooltipTrigger>
                                              <TooltipContent side="left">
                                                {!instance.publicIp 
                                                  ? "No public IP - cannot connect via browser"
                                                  : !isPort22Open(instance, securityGroups)
                                                    ? "Port 22 may be closed in security group"
                                                    : `Connect as ${getDefaultSSHUser(instance.platformId, instance.sshUser).user}`
                                                }
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                          {instance.keyName && instance.publicIp && (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <DropdownMenuItem onClick={() => setSSHDialogInstance(instance)}>
                                                    <Terminal className="h-4 w-4 mr-2" />
                                                    Connect with SSH
                                                  </DropdownMenuItem>
                                                </TooltipTrigger>
                                                <TooltipContent side="left">
                                                  {`SSH with key pair: ${instance.keyName}`}
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )}
                                        </>
                                      )}
                                      {instance.state === 'running' ? (
                                        <DropdownMenuItem onClick={() => handleInstanceAction('stop', instance.id, instance.name)}>
                                          <Square className="h-4 w-4 mr-2" />
                                          Stop
                                        </DropdownMenuItem>
                                      ) : instance.state === 'stopped' ? (
                                        <DropdownMenuItem onClick={() => handleInstanceAction('start', instance.id, instance.name)}>
                                          <Play className="h-4 w-4 mr-2" />
                                          Start
                                        </DropdownMenuItem>
                                      ) : null}
                                      {instance.state === 'running' && (
                                        <DropdownMenuItem onClick={() => handleInstanceAction('reboot', instance.id, instance.name)}>
                                          <RotateCcw className="h-4 w-4 mr-2" />
                                          Reboot
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => handleInstanceAction('terminate', instance.id, instance.name)}
                                      >
                                        Terminate
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
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

      <LaunchEC2Dialog
        open={launchDialogOpen}
        onOpenChange={setLaunchDialogOpen}
        onSuccess={refetch}
      />

      {sshDialogInstance && (
        <SSHCommandDialog
          open={!!sshDialogInstance}
          onOpenChange={(open) => !open && setSSHDialogInstance(null)}
          instanceName={sshDialogInstance.name}
          publicIp={sshDialogInstance.publicIp || ''}
          keyName={sshDialogInstance.keyName || ''}
          sshUser={getDefaultSSHUser(sshDialogInstance.platformId, sshDialogInstance.sshUser).user}
        />
      )}
    </SidebarProvider>
  );
};

export default EC2Instances;