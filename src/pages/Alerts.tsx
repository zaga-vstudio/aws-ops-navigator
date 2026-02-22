import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationBadge } from "@/components/NotificationBadge";
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
  Trash2,
  Loader2,
  MessageSquare,
  Globe,
  GitCompare,
  Eye,
  Check
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { useAlertRules } from "@/hooks/useAlertRules";
import { useNotificationPreferences, NotificationChannel } from "@/hooks/useNotificationPreferences";
import { useDriftDetection } from "@/hooks/useDriftDetection";
import { NewAlertRuleDialog } from "@/components/NewAlertRuleDialog";
import { NotificationChannelDialog } from "@/components/NotificationChannelDialog";
import { DriftDetailsDialog } from "@/components/DriftDetailsDialog";
import { DriftScheduleSettings } from "@/components/DriftScheduleSettings";
import { formatDistanceToNow } from "date-fns";

export default function Alerts() {
  const { data, loading: awsLoading, error, refetch } = useAWSDataContext();
  const { rules, loading: rulesLoading, actionLoading, createRule, deleteRule, toggleRule, fetchRules } = useAlertRules();
  const { channels, loading: prefsLoading, saving, updateChannel, toggleChannel } = useNotificationPreferences();
  const { 
    driftEvents, 
    loading: driftLoading, 
    scanning, 
    unacknowledgedCount: driftCount,
    criticalCount: driftCritical,
    scanForDrift, 
    acknowledgeDrift, 
    acceptDrift 
  } = useDriftDetection();
  
  const [newRuleDialogOpen, setNewRuleDialogOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<NotificationChannel | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('cloudhub-dismissed-alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [selectedDrift, setSelectedDrift] = useState<typeof driftEvents[0] | null>(null);
  const [driftDialogOpen, setDriftDialogOpen] = useState(false);

  const loading = awsLoading || rulesLoading || prefsLoading || driftLoading;

  const handleRefresh = () => {
    refetch();
    fetchRules();
  };

  const handleOpenChannelSettings = (channel: NotificationChannel) => {
    setSelectedChannel(channel);
    setChannelDialogOpen(true);
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => {
      const next = new Set(prev).add(alertId);
      localStorage.setItem('cloudhub-dismissed-alerts', JSON.stringify([...next]));
      return next;
    });
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
      case "slack": return <Volume2 className="h-4 w-4" />;
      case "discord": return <MessageSquare className="h-4 w-4" />;
      case "webhook": return <Globe className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const BUDGET_METRICS = ['MonthlyBudget', 'ServiceBudget'];

  const getComparisonSymbol = (op: string) => {
    switch (op) {
      case 'GreaterThanThreshold': return '>';
      case 'GreaterThanOrEqualToThreshold': return '≥';
      case 'LessThanThreshold': return '<';
      case 'LessThanOrEqualToThreshold': return '≤';
      default: return '>';
    }
  };

  const getThresholdUnit = (metric: string) => {
    if (BUDGET_METRICS.includes(metric)) return '$';
    if (['CPUUtilization', 'MemoryUtilization', 'DiskUtilization'].includes(metric)) return '%';
    if (['DatabaseConnections'].includes(metric)) return '';
    if (['ReadLatency', 'WriteLatency'].includes(metric)) return 'ms';
    if (['FreeStorageSpace'].includes(metric)) return 'GB';
    return '';
  };

  // Combine CloudWatch alarms with user-created rules for display
  const allRules = [
    ...rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      metric: rule.metric,
      threshold: rule.threshold,
      state: rule.enabled ? 'OK' : 'DISABLED',
      severity: rule.severity,
      isUserCreated: true,
      enabled: rule.enabled,
      source: BUDGET_METRICS.includes(rule.metric) ? 'Budget' as const : 'CloudWatch' as const,
      comparison_operator: rule.comparison_operator || 'GreaterThanThreshold',
      duration: rule.duration,
    })),
    ...alarms.map(alarm => ({
      id: alarm.id,
      name: alarm.name,
      metric: alarm.metric,
      threshold: alarm.threshold,
      state: alarm.state,
      severity: alarm.severity,
      isUserCreated: false,
      enabled: true,
      source: 'CloudWatch' as const,
      comparison_operator: 'GreaterThanThreshold',
      duration: 0,
    }))
  ];

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
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-foreground">Alerts & Notifications</h1>
                    <NotificationBadge source="alarm" className="text-base px-2 py-1" />
                  </div>
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
                        <div className="text-2xl font-bold">{rules.length + alarms.length}</div>
                        <p className="text-xs text-muted-foreground">
                          {rules.filter(r => r.enabled).length + alarms.filter(a => a.state !== 'INSUFFICIENT_DATA').length} active
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
                    <div className="text-2xl font-bold">{activeAlarms.length > 0 ? activeAlarms.length : 0}</div>
                    <p className="text-xs text-muted-foreground">Triggered alerts</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">User Rules</CardTitle>
                    <CheckCircle className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{rules.length}</div>
                    <p className="text-xs text-muted-foreground">Custom CloudWatch alarms</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Drift Detected</CardTitle>
                    <GitCompare className="h-4 w-4 text-warning" />
                  </CardHeader>
                  <CardContent>
                    {driftLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-warning">{driftCount}</div>
                        <p className="text-xs text-muted-foreground">
                          {driftCritical} critical changes
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Alerts Tabs */}
              <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="active">Active Alerts</TabsTrigger>
                  <TabsTrigger value="drift" className="flex items-center gap-2">
                    Drift Detection
                    {driftCount > 0 && (
                      <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {driftCount}
                      </Badge>
                    )}
                  </TabsTrigger>
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

                <TabsContent value="drift" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <GitCompare className="h-5 w-5" />
                            Drift Detection
                          </CardTitle>
                          <CardDescription>
                            Detect when resources are modified outside of Clodaro (e.g., via AWS Console)
                          </CardDescription>
                        </div>
                        <Button onClick={scanForDrift} disabled={scanning}>
                          {scanning ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Scanning...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Scan Now
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {driftLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                          ))}
                        </div>
                      ) : driftEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                          <p>No drift detected. All resources match their expected configuration.</p>
                          <p className="text-sm mt-2">Click "Scan Now" to check for changes.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {driftEvents.filter(d => !d.acknowledged).map((drift) => (
                            <div key={drift.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-4">
                                <GitCompare className={`h-5 w-5 ${
                                  drift.severity === 'critical' ? 'text-destructive' : 
                                  drift.severity === 'warning' ? 'text-warning' : 'text-primary'
                                }`} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium">{drift.resource_name || drift.resource_id}</h4>
                                    <Badge variant={
                                      drift.severity === 'critical' ? 'destructive' : 
                                      drift.severity === 'warning' ? 'outline' : 'secondary'
                                    }>
                                      {drift.severity}
                                    </Badge>
                                    <Badge variant="secondary">{drift.resource_type.toUpperCase()}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-1">
                                    {drift.changes.length} configuration change(s) detected
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Detected {formatDistanceToNow(new Date(drift.detected_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDrift(drift);
                                    setDriftDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Details
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => acknowledgeDrift(drift.id)}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Dismiss
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => acceptDrift(drift.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Accept
                                </Button>
                              </div>
                            </div>
                          ))}
                          
                          {driftEvents.some(d => d.acknowledged) && (
                            <div className="mt-6">
                              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                                Previously Acknowledged ({driftEvents.filter(d => d.acknowledged).length})
                              </h4>
                              {driftEvents.filter(d => d.acknowledged).slice(0, 5).map((drift) => (
                                <div key={drift.id} className="flex items-center justify-between p-3 border rounded-lg opacity-60 mb-2">
                                  <div className="flex items-center gap-3">
                                    <GitCompare className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <span className="font-medium text-sm">{drift.resource_name || drift.resource_id}</span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({drift.resource_type})
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {drift.acknowledged_at && formatDistanceToNow(new Date(drift.acknowledged_at), { addSuffix: true })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Scheduled Drift Scanning Settings */}
                  <DriftScheduleSettings />
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
                      ) : allRules.length === 0 ? (
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
                              <TableHead>Source</TableHead>
                              <TableHead>Metric</TableHead>
                              <TableHead>Threshold</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>State</TableHead>
                              <TableHead>Severity</TableHead>
                              <TableHead>Enabled</TableHead>
                              <TableHead className="w-[80px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allRules.map((rule) => (
                              <TableRow key={rule.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {rule.name}
                                    {rule.isUserCreated && (
                                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${
                                    rule.source === 'Budget' 
                                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' 
                                      : 'bg-purple-500/10 text-purple-600 border-purple-500/30'
                                  }`}>
                                    {rule.source}
                                  </Badge>
                                </TableCell>
                                <TableCell>{rule.metric}</TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm">
                                    {getComparisonSymbol(rule.comparison_operator)} {rule.source === 'Budget' ? '$' : ''}{rule.threshold}{getThresholdUnit(rule.metric)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {rule.source !== 'Budget' && rule.duration > 0 ? (
                                    <span className="text-sm text-muted-foreground">{rule.duration}m</span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={
                                    rule.state === 'OK' ? 'secondary' : 
                                    rule.state === 'ALARM' ? 'destructive' : 
                                    rule.state === 'DISABLED' ? 'outline' : 'outline'
                                  }>
                                    {rule.state}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={rule.severity === "critical" ? "destructive" : "outline"}>
                                    {rule.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {rule.isUserCreated ? (
                                    <Switch 
                                      checked={rule.enabled}
                                      onCheckedChange={() => toggleRule(rule.id)}
                                      disabled={actionLoading === rule.id}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-sm">AWS</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {rule.isUserCreated && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => deleteRule(rule.id)}
                                      disabled={actionLoading === rule.id}
                                    >
                                      {actionLoading === rule.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      )}
                                    </Button>
                                  )}
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
                        {channels.map((channel) => (
                          <div key={channel.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {getChannelIcon(channel.type)}
                              <div>
                                <h4 className="font-medium">{channel.name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {channel.type === 'email' 
                                    ? (channel.enabled ? 'Enabled' : 'Disabled')
                                    : (channel.config || 'Not configured')
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Switch 
                                checked={channel.enabled} 
                                onCheckedChange={() => toggleChannel(channel.type)}
                                disabled={saving}
                              />
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleOpenChannelSettings(channel)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
      <NewAlertRuleDialog 
        open={newRuleDialogOpen} 
        onOpenChange={setNewRuleDialogOpen}
        onSubmit={createRule}
        loading={actionLoading === 'create'}
      />
      <NotificationChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={selectedChannel}
        onSave={updateChannel}
        loading={saving}
      />
      <DriftDetailsDialog
        open={driftDialogOpen}
        onOpenChange={setDriftDialogOpen}
        drift={selectedDrift}
        onAcknowledge={acknowledgeDrift}
        onAccept={acceptDrift}
      />
    </SidebarProvider>
  );
}
