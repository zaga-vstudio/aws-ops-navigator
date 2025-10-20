import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAWSData } from "@/hooks/useAWSData";
import { NewAlertRuleDialog } from "@/components/NewAlertRuleDialog";
import { formatDistanceToNow } from "date-fns";

const notificationChannels = [
  { id: "1", type: "email", name: "Email Notifications", enabled: true, config: "admin@company.com" },
  { id: "2", type: "sms", name: "SMS Alerts", enabled: false, config: "+1 (555) 123-4567" },
  { id: "3", type: "slack", name: "Slack Channel", enabled: true, config: "#aws-alerts" },
  { id: "4", type: "webhook", name: "Webhook", enabled: false, config: "https://api.company.com/alerts" }
];

export default function Alerts() {
  const { data, loading, error, refetch } = useAWSData();
  const [newRuleDialogOpen, setNewRuleDialogOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const handleRefresh = () => {
    refetch();
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
  };

  const alarms = data?.alarms || [];
  const activeAlarms = alarms.filter(alarm => 
    alarm.state === 'ALARM' && !dismissedAlerts.has(alarm.id)
  );
  
  const criticalCount = activeAlarms.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlarms.filter(a => a.severity === 'warning').length;

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "info": return <Bell className="h-4 w-4 text-primary" />;
      default: return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const getAlertVariant = (severity: string): "destructive" | "outline" | "secondary" | "default" => {
    switch (severity) {
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
                  <Button size="sm" onClick={() => setNewRuleDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Rule
                  </Button>
                  <Button onClick={handleRefresh} disabled={loading} variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}

              {/* Alert Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-destructive">{activeAlarms.length}</div>
                        <p className="text-xs text-muted-foreground">
                          {criticalCount} critical, {warningCount} warning
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Alert Rules</CardTitle>
                    <Settings className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{alarms.length}</div>
                        <p className="text-xs text-muted-foreground">
                          {alarms.filter(a => a.state !== 'INSUFFICIENT_DATA').length} active
                        </p>
                      </>
                    )}
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
                      {loading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full" />
                          ))}
                        </div>
                      ) : activeAlarms.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                          <p>No active alerts. All systems operating normally.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {activeAlarms.map((alarm) => (
                            <div key={alarm.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-4">
                                {getAlertIcon(alarm.severity)}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{alarm.name}</h4>
                                    <Badge variant={getAlertVariant(alarm.severity)}>{alarm.severity}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-1">
                                    {alarm.description || `${alarm.metric} exceeded threshold of ${alarm.threshold}`}
                                  </p>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {alarm.resourceId && <span>Resource: {alarm.resourceId}</span>}
                                    <span>{formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true })}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDismissAlert(alarm.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rules" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Alert Rules</CardTitle>
                      <CardDescription>Configure when and how alerts are triggered based on CloudWatch alarms</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : alarms.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Settings className="h-12 w-12 mx-auto mb-2" />
                          <p>No alert rules configured yet.</p>
                          <p className="text-sm">Create a new rule to start monitoring your resources.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Rule Name</TableHead>
                              <TableHead>Metric</TableHead>
                              <TableHead>Threshold</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead>Severity</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {alarms.map((alarm) => (
                              <TableRow key={alarm.id}>
                                <TableCell className="font-medium">{alarm.name}</TableCell>
                                <TableCell>{alarm.metric}</TableCell>
                                <TableCell>{alarm.threshold}</TableCell>
                                <TableCell>
                                  <Badge variant={alarm.state === 'OK' ? 'secondary' : alarm.state === 'ALARM' ? 'destructive' : 'outline'}>
                                    {alarm.state}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={alarm.severity === "critical" ? "destructive" : "outline"}>
                                    {alarm.severity}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
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
      <NewAlertRuleDialog open={newRuleDialogOpen} onOpenChange={setNewRuleDialogOpen} />
    </SidebarProvider>
  );
}