import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Activity, 
  Search,
  Filter,
  Calendar,
  User,
  Server,
  Database,
  Shield,
  RefreshCw,
  Download,
  Eye,
  Info,
  Network,
  DollarSign
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { format, subHours, subDays, isAfter } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  resourceType: string;
  status: 'success' | 'warning' | 'error';
  details: string;
  ip: string;
}

export default function ActivityLog() {
  const { data: awsData, loading, refetch } = useAWSDataContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Generate activity logs from AWS data
  const activityLogs = useMemo(() => {
    const logs: ActivityLog[] = [];
    
    if (!awsData) return logs;

    // EC2 Instances
    awsData.ec2Instances?.forEach((instance) => {
      const stateStatus = instance.state === 'running' ? 'success' : 
                         instance.state === 'stopped' ? 'warning' : 'error';
      logs.push({
        id: `ec2-${instance.id}`,
        timestamp: instance.launchTime || new Date().toISOString(),
        user: 'AWS',
        action: `EC2 Instance ${instance.state}`,
        resource: instance.id,
        resourceType: 'EC2',
        status: stateStatus,
        details: `Instance ${instance.name || instance.id} is ${instance.state} in ${instance.availabilityZone}`,
        ip: instance.publicIp || 'N/A'
      });
    });

    // RDS Databases
    awsData.rdsDatabases?.forEach((db) => {
      const dbStatus = db.state === 'available' ? 'success' : 
                      db.state === 'backing-up' ? 'warning' : 'error';
      logs.push({
        id: `rds-${db.id}`,
        timestamp: new Date().toISOString(),
        user: 'AWS',
        action: `RDS Database ${db.state}`,
        resource: db.name,
        resourceType: 'RDS',
        status: dbStatus,
        details: `${db.engine} ${db.engineVersion} database ${db.state}`,
        ip: 'N/A'
      });
    });

    // VPCs
    awsData.vpcs?.forEach((vpc) => {
      logs.push({
        id: `vpc-${vpc.id}`,
        timestamp: new Date().toISOString(),
        user: 'AWS',
        action: 'VPC Active',
        resource: vpc.id,
        resourceType: 'VPC',
        status: vpc.state === 'available' ? 'success' : 'warning',
        details: `VPC ${vpc.name || vpc.id} (${vpc.cidrBlock}) is ${vpc.state}`,
        ip: 'N/A'
      });
    });

    // Security Groups
    awsData.securityGroups?.forEach((sg) => {
      logs.push({
        id: `sg-${sg.id}`,
        timestamp: new Date().toISOString(),
        user: 'AWS',
        action: 'Security Group Configuration',
        resource: sg.id,
        resourceType: 'Security',
        status: 'success',
        details: `Security group ${sg.name} has ${sg.inboundRules} inbound and ${sg.outboundRules} outbound rules`,
        ip: 'N/A'
      });
    });

    // CloudWatch Alarms
    awsData.alarms?.forEach((alarm) => {
      const alarmStatus = alarm.state === 'OK' ? 'success' : 
                         alarm.state === 'ALARM' ? 'error' : 'warning';
      logs.push({
        id: `alarm-${alarm.id}`,
        timestamp: alarm.timestamp || new Date().toISOString(),
        user: 'system',
        action: `CloudWatch Alarm ${alarm.state}`,
        resource: alarm.name,
        resourceType: 'Monitoring',
        status: alarmStatus,
        details: alarm.description || `Alarm is in ${alarm.state} state - ${alarm.metric} threshold: ${alarm.threshold}`,
        ip: 'N/A'
      });
    });

    return logs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [awsData]);

  // Filter logs by time range
  const timeFilteredLogs = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date;

    switch (timeRange) {
      case '1h':
        cutoffDate = subHours(now, 1);
        break;
      case '24h':
        cutoffDate = subHours(now, 24);
        break;
      case '7d':
        cutoffDate = subDays(now, 7);
        break;
      case '30d':
        cutoffDate = subDays(now, 30);
        break;
      default:
        cutoffDate = subHours(now, 24);
    }

    return activityLogs.filter(log => 
      isAfter(new Date(log.timestamp), cutoffDate)
    );
  }, [activityLogs, timeRange]);

  // Calculate statistics
  const activityStats = useMemo(() => {
    const total = timeFilteredLogs.length;
    const successCount = timeFilteredLogs.filter(log => log.status === 'success').length;
    const errorCount = timeFilteredLogs.filter(log => log.status === 'error').length;
    const uniqueUsers = new Set(timeFilteredLogs.map(log => log.user)).size;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0';

    return [
      { label: "Total Actions", value: total.toString(), change: `in ${timeRange}` },
      { label: "Success Rate", value: `${successRate}%`, change: `${successCount}/${total} actions` },
      { label: "Active Users", value: uniqueUsers.toString(), change: 'unique' },
      { label: "Failed Actions", value: errorCount.toString(), change: errorCount > 0 ? 'needs attention' : 'all good' }
    ];
  }, [timeFilteredLogs, timeRange]);

  // Get unique users and actions for filters
  const uniqueUsers = useMemo(() => 
    Array.from(new Set(activityLogs.map(log => log.user))),
    [activityLogs]
  );

  const uniqueActions = useMemo(() => 
    Array.from(new Set(activityLogs.map(log => log.resourceType))),
    [activityLogs]
  );

  const handleRefresh = () => {
    toast.info("Refreshing activity logs...");
    refetch();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Activity logs exported successfully");
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "EC2": return <Server className="h-4 w-4" />;
      case "RDS": return <Database className="h-4 w-4" />;
      case "Security": return <Shield className="h-4 w-4" />;
      case "VPC": return <Network className="h-4 w-4" />;
      case "Monitoring": return <DollarSign className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-success";
      case "error": return "text-destructive";
      case "warning": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  const filteredLogs = useMemo(() => {
    return timeFilteredLogs.filter(log => {
      const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           log.user.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = filterUser === "all" || log.user === filterUser;
      const matchesAction = filterAction === "all" || log.resourceType === filterAction;
      
      return matchesSearch && matchesUser && matchesAction;
    });
  }, [timeFilteredLogs, searchTerm, filterUser, filterAction]);

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
                  <h1 className="text-3xl font-bold text-foreground">Activity Log</h1>
                  <p className="text-muted-foreground">Track all actions and changes in your AWS environment</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 Hour</SelectItem>
                      <SelectItem value="24h">24 Hours</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLogs.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Activity Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {loading ? (
                  Array(4).fill(0).map((_, index) => (
                    <Card key={index}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-4 rounded" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-16 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  activityStats.map((stat, index) => (
                    <Card key={index}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                        <Activity className="h-4 w-4 text-primary" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground">{stat.change}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search actions, resources, or users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={filterUser} onValueChange={setFilterUser}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by user" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {uniqueUsers.map((user) => (
                          <SelectItem key={user} value={user}>{user}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Resource Types</SelectItem>
                        {uniqueActions.map((action) => (
                          <SelectItem key={action} value={action}>{action}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Log */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>
                    Showing {filteredLogs.length} of {activityLogs.length} activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {Array(5).fill(0).map((_, index) => (
                        <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                          <Skeleton className="h-4 w-4 rounded" />
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-40" />
                              <Skeleton className="h-5 w-16" />
                            </div>
                            <Skeleton className="h-4 w-full" />
                            <div className="flex items-center gap-4">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-3 w-32" />
                              <Skeleton className="h-3 w-28" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No activity logs found matching your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex-shrink-0 mt-1">
                            {getResourceIcon(log.resourceType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium truncate">{log.action}</h4>
                              <Badge 
                                className={
                                  log.status === "success" ? "bg-success text-success-foreground" :
                                  log.status === "error" ? "bg-destructive text-destructive-foreground" :
                                  "bg-warning text-warning-foreground"
                                }
                              >
                                {log.status}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {log.resourceType}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{log.details}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {log.user}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(log.timestamp), 'PPp')}
                              </span>
                              <span>Resource: {log.resource}</span>
                              {log.ip !== "N/A" && <span>IP: {log.ip}</span>}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>
              Complete information about this activity
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <p className="text-foreground font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge 
                      className={
                        selectedLog.status === "success" ? "bg-success text-success-foreground" :
                        selectedLog.status === "error" ? "bg-destructive text-destructive-foreground" :
                        "bg-warning text-warning-foreground"
                      }
                    >
                      {selectedLog.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resource Type</label>
                  <p className="text-foreground flex items-center gap-2">
                    {getResourceIcon(selectedLog.resourceType)}
                    {selectedLog.resourceType}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resource ID</label>
                  <p className="text-foreground font-mono text-sm">{selectedLog.resource}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <p className="text-foreground">{selectedLog.user}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="text-foreground">{format(new Date(selectedLog.timestamp), 'PPpp')}</p>
                </div>
                {selectedLog.ip !== 'N/A' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                    <p className="text-foreground font-mono text-sm">{selectedLog.ip}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Details</label>
                <p className="text-foreground mt-1 p-3 bg-muted rounded-md">{selectedLog.details}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}