import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  RefreshCw, AlertCircle, CheckCircle, Info, Server, Database, Bell, Shield, HardDrive, Activity, Clock
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { EC2Instance } from "@/hooks/useAWSData";
import { useMonitoringData, MetricDataPoint } from "@/hooks/useMonitoringData";
import { ComplianceDashboard } from "@/components/ComplianceDashboard";
import { CostBadge } from "@/components/CostBadge";
import { MonitoringResourceCards } from "@/components/monitoring/MonitoringResourceCards";
import { MonitoringInstanceList } from "@/components/monitoring/MonitoringInstanceList";

interface SelectedResource {
  id: string;
  name: string;
  type: 'ec2' | 'rds';
}

export default function Monitoring() {
  const { data, loading, error, refetch } = useAWSDataContext();
  const { data: metricsData, loading: metricsLoading, fetchMetrics } = useMonitoringData();
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("24h");
  const [includePaidMetrics, setIncludePaidMetrics] = useState(false);
  const [selectedResourceKey, setSelectedResourceKey] = useState("auto");

  const ec2Instances = data?.ec2Instances || [];
  const rdsDatabases = data?.rdsDatabases || [];
  const cloudWatchAlarms = data?.alarms || [];
  const securityGroups = data?.securityGroups || [];

  const selectedResource: SelectedResource | null = useMemo(() => {
    if (selectedResourceKey === "auto") return null;
    const [type, ...idParts] = selectedResourceKey.split(":");
    const id = idParts.join(":");
    if (type === "ec2") {
      const inst = ec2Instances.find(i => i.id === id);
      return { id, name: inst?.name || id, type: 'ec2' };
    }
    if (type === "rds") {
      const db = rdsDatabases.find(r => r.id === id);
      return { id, name: db?.name || id, type: 'rds' };
    }
    return null;
  }, [selectedResourceKey, ec2Instances, rdsDatabases]);

  // Fetch metrics when params change
  useEffect(() => {
    fetchMetrics(timeRange, {
      includePaidMetrics,
      instanceId: selectedResource?.id,
      resourceType: selectedResource?.type || 'ec2',
    });
  }, [timeRange, includePaidMetrics, selectedResource?.id, selectedResource?.type]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      fetchMetrics(timeRange, {
        forceRefresh: true,
        includePaidMetrics,
        instanceId: selectedResource?.id,
        resourceType: selectedResource?.type || 'ec2',
      }),
    ]);
    setRefreshing(false);
  };

  const runningEC2 = ec2Instances.filter((i: any) => i.state?.toLowerCase() === 'running').length;
  const totalEC2 = ec2Instances.length;
  const availableRDS = rdsDatabases.filter((r: any) => r.state?.toLowerCase() === 'available').length;
  const totalRDS = rdsDatabases.length;
  const alarmsInAlarm = cloudWatchAlarms.filter((a: any) => a.state === 'ALARM').length;
  const totalAlarms = cloudWatchAlarms.length;

  const isRDS = selectedResource?.type === 'rds' || metricsData?.resourceType === 'rds';

  const formatChartData = (metrics: MetricDataPoint[]) => {
    return metrics.map(m => {
      const date = new Date(m.timestamp);
      const time = timeRange === '7d'
        ? date.toLocaleDateString('en', { weekday: 'short' })
        : `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      return { time, value: m.value };
    });
  };

  const hasRealCPU = metricsData && metricsData.cpu.length > 0;
  const hasRealNetwork = metricsData && (metricsData.networkIn.length > 0 || metricsData.networkOut.length > 0);

  const cpuChartData = hasRealCPU ? formatChartData(metricsData.cpu) : [];

  const networkChartData = hasRealNetwork
    ? metricsData.networkIn.map((m, i) => {
        const date = new Date(m.timestamp);
        const time = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        return {
          time,
          networkIn: Math.round(m.value / 1024 / 1024),
          networkOut: Math.round((metricsData.networkOut[i]?.value || 0) / 1024 / 1024),
        };
      })
    : [];

  const diskChartData = metricsData?.diskReadOps && metricsData.diskReadOps.length > 0
    ? metricsData.diskReadOps.map((m, i) => {
        const date = new Date(m.timestamp);
        const time = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        return {
          time,
          readOps: m.value,
          writeOps: metricsData.diskWriteOps?.[i]?.value || 0,
        };
      })
    : null;

  // RDS-specific chart data
  const connectionsChartData = metricsData?.databaseConnections && metricsData.databaseConnections.length > 0
    ? formatChartData(metricsData.databaseConnections)
    : [];

  const storageChartData = metricsData?.freeStorageSpace && metricsData.freeStorageSpace.length > 0
    ? metricsData.freeStorageSpace.map(m => {
        const date = new Date(m.timestamp);
        const time = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        return { time, value: Math.round(m.value / 1024 / 1024 / 1024 * 100) / 100 }; // bytes -> GB
      })
    : [];

  const latencyChartData = metricsData?.readLatency && metricsData.readLatency.length > 0
    ? metricsData.readLatency.map((m, i) => {
        const date = new Date(m.timestamp);
        const time = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        return {
          time,
          readLatency: Math.round(m.value * 1000 * 100) / 100, // seconds -> ms
          writeLatency: Math.round((metricsData.writeLatency?.[i]?.value || 0) * 1000 * 100) / 100,
        };
      })
    : null;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    color: 'hsl(var(--foreground))',
    borderRadius: '8px',
  };
  const labelStyle = { color: 'hsl(var(--foreground))' };
  const itemStyle = { color: 'hsl(var(--foreground))' };

  const getInstanceName = (inst: EC2Instance) => {
    return inst.name ? `${inst.name} (${inst.id})` : inst.id;
  };

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
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Monitoring</h1>
                  <p className="text-muted-foreground">Real-time metrics and resource status</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Instance Selector */}
                  <Select value={selectedResourceKey} onValueChange={setSelectedResourceKey}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select resource" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (first running EC2)</SelectItem>
                      {ec2Instances.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-1.5">
                            <Server className="h-3 w-3" /> EC2 Instances
                          </SelectLabel>
                          {ec2Instances.map((inst) => (
                            <SelectItem key={inst.id} value={`ec2:${inst.id}`}>
                              <span className="flex items-center gap-2">
                                {getInstanceName(inst)}
                                <Badge variant={inst.state?.toLowerCase() === 'running' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
                                  {inst.state}
                                </Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {rdsDatabases.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-1.5">
                            <Database className="h-3 w-3" /> RDS Databases
                          </SelectLabel>
                          {rdsDatabases.map((db) => (
                            <SelectItem key={db.id} value={`rds:${db.id}`}>
                              <span className="flex items-center gap-2">
                                {db.name} ({db.engine})
                                <Badge variant={db.state?.toLowerCase() === 'available' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
                                  {db.state}
                                </Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>

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
                  <Button onClick={handleRefresh} disabled={refreshing || loading || metricsLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing || loading || metricsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Resource Info Banner */}
              {selectedResource && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Showing <strong>{selectedResource.type === 'rds' ? 'RDS' : 'EC2'}</strong> metrics for <strong>{selectedResource.name}</strong>. Metric types vary by resource.
                  </AlertDescription>
                </Alert>
              )}

              {/* Cache Info */}
              {metricsData?.fromCache && metricsData.cachedAt && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      Showing cached data from {new Date(metricsData.cachedAt).toLocaleTimeString()}.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMetrics(timeRange, {
                        forceRefresh: true,
                        includePaidMetrics,
                        instanceId: selectedResource?.id,
                        resourceType: selectedResource?.type || 'ec2',
                      })}
                      disabled={metricsLoading}
                    >
                      Force Refresh
                    </Button>
                  </AlertDescription>
                </Alert>
              )}


              {/* Resource Overview Cards */}
              <MonitoringResourceCards
                runningEC2={runningEC2}
                totalEC2={totalEC2}
                availableRDS={availableRDS}
                totalRDS={totalRDS}
                alarmsInAlarm={alarmsInAlarm}
                totalAlarms={totalAlarms}
                securityGroupsCount={securityGroups.length}
                loading={loading}
              />

              {/* Paid Metrics Toggle */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">Extended Metrics</CardTitle>
                      <CostBadge
                        type="paid"
                        label="~$0.01/1K requests"
                        costNote={isRDS
                          ? "Additional GetMetricStatistics calls for Read/Write Latency. Each API call is free up to 1M/month, then $0.01 per 1,000 requests."
                          : "Additional GetMetricStatistics calls for Disk I/O and Status Checks. Each API call is free up to 1M/month, then $0.01 per 1,000 requests."
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="paid-metrics" className="text-sm text-muted-foreground">
                        {isRDS ? 'Enable Read/Write Latency' : 'Enable Disk I/O & Status Checks'}
                      </Label>
                      <Switch
                        id="paid-metrics"
                        checked={includePaidMetrics}
                        onCheckedChange={setIncludePaidMetrics}
                      />
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Charts - Dynamic by resource type */}
              {isRDS ? (
                <>
                  {/* RDS Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CPU Usage */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>CPU Usage</CardTitle>
                            <CardDescription>Average CPU utilization</CardDescription>
                          </div>
                          <CostBadge type="free" label="Free Tier" costNote="RDS basic monitoring CPUUtilization metric." />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {metricsLoading && !metricsData ? (
                          <Skeleton className="h-[250px] w-full" />
                        ) : cpuChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={cpuChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip formatter={(value) => [`${value}%`, 'CPU Usage']} contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No CPU data available yet</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Database Connections */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Database Connections</CardTitle>
                            <CardDescription>Active database connections</CardDescription>
                          </div>
                          <CostBadge type="free" label="Free Tier" costNote="RDS DatabaseConnections metric via GetMetricStatistics." />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {metricsLoading && !metricsData ? (
                          <Skeleton className="h-[250px] w-full" />
                        ) : connectionsChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={connectionsChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip formatter={(value) => [`${value}`, 'Connections']} contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <Database className="h-10 w-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No connection data available yet</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Free Storage Space */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Free Storage Space</CardTitle>
                          <CardDescription>Available storage in GB</CardDescription>
                        </div>
                        <CostBadge type="free" label="Free Tier" costNote="RDS FreeStorageSpace metric via GetMetricStatistics." />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {metricsLoading && !metricsData ? (
                        <Skeleton className="h-[250px] w-full" />
                      ) : storageChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={storageChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip formatter={(value) => [`${value} GB`, 'Free Storage']} contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                            <Area type="monotone" dataKey="value" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No storage data available yet</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Paid: Read/Write Latency */}
                  {includePaidMetrics && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Read/Write Latency {!latencyChartData && "(No Data)"}</CardTitle>
                            <CardDescription>Average read and write latency in milliseconds</CardDescription>
                          </div>
                          <CostBadge type="paid" label="~$0.01/1K req" costNote="2 additional GetMetricStatistics calls per refresh." />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {metricsLoading ? (
                          <Skeleton className="h-[250px] w-full" />
                        ) : latencyChartData ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={latencyChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis />
                              <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                              <Area type="monotone" dataKey="readLatency" name="Read (ms)" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                              <Area type="monotone" dataKey="writeLatency" name="Write (ms)" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.4} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No latency data available yet</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  {/* EC2 Charts (existing) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>CPU Usage</CardTitle>
                            <CardDescription>Average CPU utilization</CardDescription>
                          </div>
                          <CostBadge type="free" label="Free Tier" costNote="GetMetricStatistics: Free for up to 1M API requests/month. Basic monitoring at 5-minute intervals is included at no charge." />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {metricsLoading && !metricsData ? (
                          <Skeleton className="h-[250px] w-full" />
                        ) : cpuChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={cpuChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="time" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip formatter={(value) => [`${value}%`, 'CPU Usage']} contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No CPU data available</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* PAID: Disk I/O (when enabled) */}
                    {includePaidMetrics && (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Disk I/O {!diskChartData && "(No Data)"}</CardTitle>
                              <CardDescription>Read/Write operations per second</CardDescription>
                            </div>
                            <CostBadge type="paid" label="~$0.01/1K req" costNote="2 additional GetMetricStatistics calls per refresh. Free up to 1M requests/month, then $0.01 per 1,000 requests." />
                          </div>
                        </CardHeader>
                        <CardContent>
                          {metricsLoading ? (
                            <Skeleton className="h-[250px] w-full" />
                          ) : diskChartData ? (
                            <ResponsiveContainer width="100%" height={250}>
                              <AreaChart data={diskChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" />
                                <YAxis />
                                <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                                <Area type="monotone" dataKey="readOps" name="Read Ops" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                                <Area type="monotone" dataKey="writeOps" name="Write Ops" stroke="hsl(var(--warning))" fill="hsl(var(--warning))" fillOpacity={0.4} />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                              <div className="text-center">
                                <HardDrive className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No disk I/O data available yet</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* FREE: Network Traffic */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Network Traffic</CardTitle>
                          <CardDescription>Inbound and outbound network traffic</CardDescription>
                        </div>
                        <CostBadge type="free" label="Free Tier" costNote="NetworkIn/NetworkOut metrics via GetMetricStatistics. Free up to 1M API requests/month." />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {metricsLoading && !metricsData ? (
                        <Skeleton className="h-[250px] w-full" />
                      ) : networkChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={networkChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                            <Area type="monotone" dataKey="networkIn" name="Inbound (MB/s)" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                            <Area type="monotone" dataKey="networkOut" name="Outbound (MB/s)" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.6} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No network data available</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* PAID: Status Check (when enabled) */}
                  {includePaidMetrics && metricsData?.statusCheckFailed && metricsData.statusCheckFailed.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Status Check Failures</CardTitle>
                            <CardDescription>Instance and system status check failures</CardDescription>
                          </div>
                          <CostBadge type="paid" label="~$0.01/1K req" costNote="1 additional GetMetricStatistics call per refresh. Free up to 1M requests/month." />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={formatChartData(metricsData.statusCheckFailed)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis />
                            <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                            <Area type="monotone" dataKey="value" name="Failures" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.3} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {/* AWS Pricing Reference */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    CloudWatch Pricing Reference
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="free" label="Free" />
                        <span className="font-medium">Basic Monitoring</span>
                      </div>
                      <p className="text-muted-foreground text-xs">5-min intervals, 10 metrics, 1M API requests/mo, 3 dashboards</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="free" label="Free" />
                        <span className="font-medium">CloudWatch Alarms</span>
                      </div>
                      <p className="text-muted-foreground text-xs">10 alarm metrics free, DescribeAlarms API included</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="paid" label="$0.30/instance/mo" />
                        <span className="font-medium">Detailed Monitoring</span>
                      </div>
                      <p className="text-muted-foreground text-xs">1-minute intervals for EC2 instances</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="paid" label="$0.01/1K metrics" />
                        <span className="font-medium">GetMetricData API</span>
                      </div>
                      <p className="text-muted-foreground text-xs">Advanced metric queries and math expressions</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="paid" label="$0.005/GB" />
                        <span className="font-medium">Logs Insights</span>
                      </div>
                      <p className="text-muted-foreground text-xs">Query and analyze log data from CloudWatch Logs</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CostBadge type="paid" label="$3/metric/mo" />
                        <span className="font-medium">Anomaly Detection</span>
                      </div>
                      <p className="text-muted-foreground text-xs">ML-powered anomaly detection on metrics</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Compliance Dashboard */}
              <ComplianceDashboard
                complianceChecks={data?.complianceChecks || []}
                securityGroups={securityGroups}
                iamUsers={data?.iamUsers || []}
                loading={loading}
              />

              {/* Instance & RDS Lists */}
              <MonitoringInstanceList
                ec2Instances={ec2Instances}
                rdsDatabases={rdsDatabases}
                cloudWatchAlarms={cloudWatchAlarms}
                loading={loading}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
