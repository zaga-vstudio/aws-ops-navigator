import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Cpu, 
  HardDrive,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Server,
  Database,
  Bell,
  Shield
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";
import { useAWSData } from "@/hooks/useAWSData";

export default function Monitoring() {
  const { data, loading, error, refetch } = useAWSData();
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case "running":
      case "available":
      case "healthy":
      case "ok":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "pending":
      case "starting":
      case "stopping":
      case "insufficient_data":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "stopped":
      case "terminated":
      case "alarm":
      case "critical":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case "running":
      case "available":
      case "healthy":
      case "ok":
        return "default";
      case "pending":
      case "starting":
      case "stopping":
      case "insufficient_data":
        return "secondary";
      case "stopped":
      case "terminated":
      case "alarm":
      case "critical":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Calculate metrics from real data
  const ec2Instances = data?.ec2Instances || [];
  const rdsDatabases = data?.rdsDatabases || [];
  const cloudWatchAlarms = data?.alarms || [];
  const securityGroups = data?.securityGroups || [];

  const runningEC2 = ec2Instances.filter(i => i.state?.toLowerCase() === 'running').length;
  const totalEC2 = ec2Instances.length;
  const availableRDS = rdsDatabases.filter(r => r.state?.toLowerCase() === 'available').length;
  const totalRDS = rdsDatabases.length;
  const alarmsInAlarm = cloudWatchAlarms.filter(a => a.state === 'ALARM').length;
  const totalAlarms = cloudWatchAlarms.length;

  // Generate simulated chart data based on time range
  const generateChartData = () => {
    const points = timeRange === '1h' ? 6 : timeRange === '6h' ? 12 : timeRange === '24h' ? 24 : 7;
    const labels = timeRange === '7d' 
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : Array.from({ length: points }, (_, i) => {
          if (timeRange === '1h') return `${i * 10}m`;
          if (timeRange === '6h') return `${i * 30}m`;
          return `${i}:00`;
        });
    
    return labels.map((time, i) => ({
      time,
      cpu: Math.floor(30 + Math.random() * 50 + Math.sin(i) * 10),
      memory: Math.floor(50 + Math.random() * 30 + Math.cos(i) * 10),
      networkIn: Math.floor(10 + Math.random() * 40),
      networkOut: Math.floor(5 + Math.random() * 25),
    }));
  };

  const chartData = generateChartData();

  if (error) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 border-b border-border/50 bg-card px-6 flex items-center">
              <SidebarTrigger className="mr-4" />
              <Header />
            </header>
            <main className="flex-1 overflow-y-auto p-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {error.message || "Failed to load AWS data. Please check your credentials."}
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border/50 bg-card px-6 flex items-center">
            <SidebarTrigger className="mr-4" />
            <Header />
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Monitoring</h1>
                  <p className="text-muted-foreground">Real-time metrics and resource status</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="6h">6 Hours</SelectItem>
                      <SelectItem value="24h">24 Hours</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleRefresh} disabled={refreshing || loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing || loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Info Banner */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Displaying real AWS resource status. Chart data is simulated - CloudWatch Metrics API integration coming soon.
                </AlertDescription>
              </Alert>

              {/* Resource Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">EC2 Instances</CardTitle>
                    <Server className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{runningEC2}/{totalEC2}</div>
                        <p className="text-xs text-muted-foreground">
                          {runningEC2} running, {totalEC2 - runningEC2} stopped
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">RDS Databases</CardTitle>
                    <Database className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{availableRDS}/{totalRDS}</div>
                        <p className="text-xs text-muted-foreground">
                          {availableRDS} available
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CloudWatch Alarms</CardTitle>
                    <Bell className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold flex items-center gap-2">
                          {totalAlarms}
                          {alarmsInAlarm > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {alarmsInAlarm} active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {alarmsInAlarm === 0 ? "All clear" : `${alarmsInAlarm} in alarm state`}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
                    <Shield className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{securityGroups.length}</div>
                        <p className="text-xs text-muted-foreground">Active security groups</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Metrics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>CPU Usage (Simulated)</CardTitle>
                    <CardDescription>Average CPU utilization trend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => [`${value}%`, 'CPU Usage']} />
                        <Area 
                          type="monotone" 
                          dataKey="cpu" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary))" 
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Memory Usage (Simulated)</CardTitle>
                    <CardDescription>Memory utilization trend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(value) => [`${value}%`, 'Memory Usage']} />
                        <Line 
                          type="monotone" 
                          dataKey="memory" 
                          stroke="hsl(var(--success))" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Network Traffic */}
              <Card>
                <CardHeader>
                  <CardTitle>Network Traffic (Simulated)</CardTitle>
                  <CardDescription>Inbound and outbound network traffic</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="networkIn" 
                        name="Inbound (MB/s)"
                        stackId="1"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="networkOut" 
                        name="Outbound (MB/s)"
                        stackId="1"
                        stroke="hsl(var(--success))" 
                        fill="hsl(var(--success))" 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* EC2 Instance Details */}
              <Card>
                <CardHeader>
                  <CardTitle>EC2 Instance Status</CardTitle>
                  <CardDescription>Real-time status for your EC2 instances</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : ec2Instances.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No EC2 instances found</p>
                      <p className="text-sm">Launch an EC2 instance to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {ec2Instances.map((instance) => (
                        <div key={instance.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            {getStatusIcon(instance.state)}
                            <div>
                              <p className="font-medium">{instance.name || 'Unnamed Instance'}</p>
                              <p className="text-sm text-muted-foreground">{instance.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Type</p>
                              <p className="font-medium text-sm">{instance.type}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Region</p>
                              <p className="font-medium text-sm">{instance.region || 'N/A'}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">IP</p>
                              <p className="font-medium text-sm">{instance.publicIp || instance.privateIp || 'N/A'}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(instance.state)}>
                              {instance.state}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RDS Instance Details */}
              <Card>
                <CardHeader>
                  <CardTitle>RDS Database Status</CardTitle>
                  <CardDescription>Real-time status for your RDS instances</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : rdsDatabases.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No RDS databases found</p>
                      <p className="text-sm">Create an RDS instance to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {rdsDatabases.map((db) => (
                        <div key={db.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            {getStatusIcon(db.state)}
                            <div>
                              <p className="font-medium">{db.name}</p>
                              <p className="text-sm text-muted-foreground">{db.engine} {db.engineVersion}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Class</p>
                              <p className="font-medium text-sm">{db.instanceClass}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Storage</p>
                              <p className="font-medium text-sm">{db.allocatedStorage} GB</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Region</p>
                              <p className="font-medium text-sm">{db.region}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(db.state)}>
                              {db.state}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CloudWatch Alarms */}
              {cloudWatchAlarms.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>CloudWatch Alarms</CardTitle>
                    <CardDescription>Active monitoring alarms</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {cloudWatchAlarms.map((alarm) => (
                        <div key={alarm.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            {getStatusIcon(alarm.state === 'ALARM' ? 'alarm' : alarm.state === 'OK' ? 'ok' : 'warning')}
                            <div>
                              <p className="font-medium">{alarm.name}</p>
                              <p className="text-sm text-muted-foreground">{alarm.metric}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Threshold</p>
                              <p className="font-medium text-sm">{alarm.threshold}</p>
                            </div>
                            <Badge variant={alarm.state === 'ALARM' ? 'destructive' : alarm.state === 'OK' ? 'default' : 'secondary'}>
                              {alarm.state}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
