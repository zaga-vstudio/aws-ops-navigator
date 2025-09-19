import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
  Plus,
  X,
  Volume2,
  Mail,
  Smartphone
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const activeAlerts = [
  { 
    id: "ALT-001", 
    type: "critical", 
    title: "High CPU Usage", 
    description: "EC2 instance i-0123456789 CPU usage above 90%",
    resource: "i-0123456789abcdef0",
    timestamp: "2 minutes ago",
    status: "active"
  },
  { 
    id: "ALT-002", 
    type: "warning", 
    title: "Disk Space Low", 
    description: "RDS instance disk usage above 85%",
    resource: "db-prod-mysql",
    timestamp: "15 minutes ago",
    status: "active"
  },
  { 
    id: "ALT-003", 
    type: "info", 
    title: "Scheduled Maintenance", 
    description: "AWS scheduled maintenance for your region",
    resource: "us-east-1",
    timestamp: "1 hour ago",
    status: "acknowledged"
  }
];

const alertRules = [
  {
    id: "RULE-001",
    name: "High CPU Usage",
    metric: "CPU Utilization",
    threshold: "90%",
    duration: "5 minutes",
    enabled: true,
    severity: "critical"
  },
  {
    id: "RULE-002", 
    name: "Memory Usage Alert",
    metric: "Memory Utilization",
    threshold: "85%",
    duration: "10 minutes",
    enabled: true,
    severity: "warning"
  },
  {
    id: "RULE-003",
    name: "Disk Space Alert",
    metric: "Disk Utilization", 
    threshold: "80%",
    duration: "15 minutes",
    enabled: false,
    severity: "warning"
  }
];

const notificationChannels = [
  { id: "1", type: "email", name: "Email Notifications", enabled: true, config: "admin@company.com" },
  { id: "2", type: "sms", name: "SMS Alerts", enabled: false, config: "+1 (555) 123-4567" },
  { id: "3", type: "slack", name: "Slack Channel", enabled: true, config: "#aws-alerts" },
  { id: "4", type: "webhook", name: "Webhook", enabled: false, config: "https://api.company.com/alerts" }
];

export default function Alerts() {
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState(activeAlerts);
  const [rules, setRules] = useState(alertRules);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleDismissAlert = (alertId: string) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(rules.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "info": return <Bell className="h-4 w-4 text-primary" />;
      default: return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case "critical": return "destructive";
      case "warning": return "outline";
      case "info": return "secondary";
      default: return "default";
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms": return <Smartphone className="h-4 w-4" />;
      case "slack": return <Volume2 className="h-4 w-4" />;
      case "webhook": return <Settings className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
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
                  <h1 className="text-3xl font-bold text-foreground">Alerts & Notifications</h1>
                  <p className="text-muted-foreground">Manage alerts, rules and notification settings</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Rule
                  </Button>
                  <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Alert Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">3</div>
                    <p className="text-xs text-muted-foreground">2 critical, 1 warning</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
                    <Settings className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">10 enabled, 2 disabled</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <Bell className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">47</div>
                    <p className="text-xs text-muted-foreground">Triggered alerts</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">4.2m</div>
                    <p className="text-xs text-muted-foreground">Time to acknowledge</p>
                  </CardContent>
                </Card>
              </div>

              {/* Alerts Tabs */}
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="active">Active Alerts</TabsTrigger>
                  <TabsTrigger value="rules">Alert Rules</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Active Alerts
                      </CardTitle>
                      <CardDescription>Current alerts requiring attention</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {alerts.map((alert) => (
                          <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              {getAlertIcon(alert.type)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{alert.title}</h4>
                                  <Badge variant={getAlertVariant(alert.type)}>{alert.type}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-1">{alert.description}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>Resource: {alert.resource}</span>
                                  <span>{alert.timestamp}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                Acknowledge
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDismissAlert(alert.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rules" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Alert Rules</CardTitle>
                      <CardDescription>Configure when and how alerts are triggered</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rule Name</TableHead>
                            <TableHead>Metric</TableHead>
                            <TableHead>Threshold</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rules.map((rule) => (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">{rule.name}</TableCell>
                              <TableCell>{rule.metric}</TableCell>
                              <TableCell>{rule.threshold}</TableCell>
                              <TableCell>{rule.duration}</TableCell>
                              <TableCell>
                                <Badge variant={rule.severity === "critical" ? "destructive" : "outline"}>
                                  {rule.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Switch 
                                  checked={rule.enabled}
                                  onCheckedChange={() => handleToggleRule(rule.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  <Settings className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Notification Channels</CardTitle>
                      <CardDescription>Configure how you receive alert notifications</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        {notificationChannels.map((channel) => (
                          <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {getChannelIcon(channel.type)}
                              <div>
                                <h4 className="font-medium">{channel.name}</h4>
                                <p className="text-sm text-muted-foreground">{channel.config}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Switch defaultChecked={channel.enabled} />
                              <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        <div className="pt-4">
                          <Button variant="outline" className="w-full">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Notification Channel
                          </Button>
                        </div>
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
}