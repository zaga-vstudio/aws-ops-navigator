import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Eye
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const activityLogs = [
  {
    id: "LOG-001",
    timestamp: "2024-01-15 14:30:25",
    user: "admin@company.com",
    action: "EC2 Instance Started",
    resource: "i-0123456789abcdef0",
    resourceType: "EC2",
    status: "success",
    details: "Started EC2 instance in us-east-1",
    ip: "192.168.1.100"
  },
  {
    id: "LOG-002", 
    timestamp: "2024-01-15 14:25:12",
    user: "developer@company.com",
    action: "RDS Snapshot Created",
    resource: "db-prod-mysql",
    resourceType: "RDS",
    status: "success", 
    details: "Manual snapshot created for production database",
    ip: "192.168.1.105"
  },
  {
    id: "LOG-003",
    timestamp: "2024-01-15 14:20:45",
    user: "admin@company.com", 
    action: "Security Group Modified",
    resource: "sg-0987654321fedcba0",
    resourceType: "Security",
    status: "success",
    details: "Added inbound rule for port 443",
    ip: "192.168.1.100"
  },
  {
    id: "LOG-004",
    timestamp: "2024-01-15 14:15:33",
    user: "system",
    action: "Auto Scaling Triggered",
    resource: "asg-web-servers",
    resourceType: "Auto Scaling",
    status: "success",
    details: "Scaled out due to high CPU utilization",
    ip: "N/A"
  },
  {
    id: "LOG-005",
    timestamp: "2024-01-15 14:10:18",
    user: "developer@company.com",
    action: "EC2 Instance Stopped",
    resource: "i-0456789012345678",
    resourceType: "EC2", 
    status: "failed",
    details: "Failed to stop instance due to pending tasks",
    ip: "192.168.1.105"
  }
];

const activityStats = [
  { label: "Total Actions", value: "1,247", change: "+12%" },
  { label: "Success Rate", value: "98.5%", change: "+0.3%" },
  { label: "Active Users", value: "23", change: "+2" },
  { label: "Failed Actions", value: "18", change: "-5" }
];

export default function ActivityLog() {
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "EC2": return <Server className="h-4 w-4" />;
      case "RDS": return <Database className="h-4 w-4" />;
      case "Security": return <Shield className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-success";
      case "failed": return "text-destructive";
      case "pending": return "text-warning";
      default: return "text-muted-foreground";
    }
  };

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesUser = filterUser === "all" || log.user === filterUser;
    const matchesAction = filterAction === "all" || log.action.includes(filterAction);
    
    return matchesSearch && matchesUser && matchesAction;
  });

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
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Activity Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {activityStats.map((stat, index) => (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                      <Activity className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground">{stat.change} from last period</p>
                    </CardContent>
                  </Card>
                ))}
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
                        <SelectItem value="admin@company.com">Admin User</SelectItem>
                        <SelectItem value="developer@company.com">Developer</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterAction} onValueChange={setFilterAction}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="Started">Instance Started</SelectItem>
                        <SelectItem value="Stopped">Instance Stopped</SelectItem>
                        <SelectItem value="Created">Resource Created</SelectItem>
                        <SelectItem value="Modified">Resource Modified</SelectItem>
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
                  <div className="space-y-4">
                    {filteredLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex-shrink-0 mt-1">
                          {getResourceIcon(log.resourceType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium truncate">{log.action}</h4>
                            <Badge variant={log.status === "success" ? "default" : "destructive"}>
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
                              {log.timestamp}
                            </span>
                            <span>Resource: {log.resource}</span>
                            {log.ip !== "N/A" && <span>IP: {log.ip}</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
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