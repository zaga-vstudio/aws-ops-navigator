import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  Activity, 
  Cpu, 
  HardDrive,
  Wifi,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from "recharts";

const cpuData = [
  { time: "00:00", value: 45 },
  { time: "04:00", value: 32 },
  { time: "08:00", value: 67 },
  { time: "12:00", value: 89 },
  { time: "16:00", value: 76 },
  { time: "20:00", value: 54 },
  { time: "24:00", value: 43 }
];

const memoryData = [
  { time: "00:00", value: 68 },
  { time: "04:00", value: 72 },
  { time: "08:00", value: 85 },
  { time: "12:00", value: 91 },
  { time: "16:00", value: 88 },
  { time: "20:00", value: 79 },
  { time: "24:00", value: 71 }
];

const networkData = [
  { time: "00:00", in: 15, out: 8 },
  { time: "04:00", in: 12, out: 6 },
  { time: "08:00", in: 45, out: 32 },
  { time: "12:00", in: 67, out: 45 },
  { time: "16:00", in: 52, out: 38 },
  { time: "20:00", in: 34, out: 22 },
  { time: "24:00", in: 18, out: 12 }
];

const instanceMetrics = [
  { id: "i-0123456789", name: "web-server-01", cpu: 67, memory: 84, disk: 45, status: "healthy" },
  { id: "i-0987654321", name: "api-server-02", cpu: 45, memory: 72, disk: 62, status: "healthy" },
  { id: "i-0456789012", name: "db-server-03", cpu: 89, memory: 91, disk: 78, status: "warning" },
  { id: "i-0789012345", name: "cache-server-04", cpu: 23, memory: 45, disk: 34, status: "healthy" }
];

export default function Monitoring() {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedMetric, setSelectedMetric] = useState("cpu");

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-success";
      case "warning": return "text-warning";
      case "critical": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle className="h-4 w-4 text-success" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "critical": return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

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
                  <p className="text-muted-foreground">Real-time metrics and performance monitoring</p>
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
                  <Button onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Metrics Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg CPU Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">67%</div>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1 text-warning" />
                      +5% from last hour
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">78%</div>
                    <p className="text-xs text-muted-foreground">Within normal range</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Disk I/O</CardTitle>
                    <HardDrive className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">2.3 GB/s</div>
                    <p className="text-xs text-muted-foreground">Read/Write operations</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
                    <Wifi className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">45 MB/s</div>
                    <p className="text-xs text-muted-foreground">Inbound/Outbound traffic</p>
                  </CardContent>
                </Card>
              </div>

              {/* Metrics Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>CPU Usage</CardTitle>
                        <CardDescription>Average CPU utilization across all instances</CardDescription>
                      </div>
                      <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpu">CPU</SelectItem>
                          <SelectItem value="memory">Memory</SelectItem>
                          <SelectItem value="network">Network</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={cpuData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value}%`, 'CPU Usage']} />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
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
                    <CardTitle>Memory Usage</CardTitle>
                    <CardDescription>Memory utilization over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={memoryData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis />
                        <Tooltip formatter={(value) => [`${value}%`, 'Memory Usage']} />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
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
                  <CardTitle>Network Traffic</CardTitle>
                  <CardDescription>Inbound and outbound network traffic</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={networkData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="in" 
                        stackId="1"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))" 
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="out" 
                        stackId="1"
                        stroke="hsl(var(--success))" 
                        fill="hsl(var(--success))" 
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Instance Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Instance Metrics</CardTitle>
                  <CardDescription>Real-time metrics for individual instances</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {instanceMetrics.map((instance) => (
                      <div key={instance.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {getStatusIcon(instance.status)}
                          <div>
                            <p className="font-medium">{instance.name}</p>
                            <p className="text-sm text-muted-foreground">{instance.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">CPU</p>
                            <p className="font-medium">{instance.cpu}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Memory</p>
                            <p className="font-medium">{instance.memory}%</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Disk</p>
                            <p className="font-medium">{instance.disk}%</p>
                          </div>
                          <Badge variant={instance.status === "healthy" ? "default" : "destructive"}>
                            {instance.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}