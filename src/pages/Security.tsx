import { Header } from "@/components/Header";
import { useAWSData } from "@/hooks/useAWSData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SecurityGroupDetailsDialog } from "@/components/SecurityGroupDetailsDialog";
import { IAMUserDetailsDialog } from "@/components/IAMUserDetailsDialog";
import { ComplianceDetailsDialog } from "@/components/ComplianceDetailsDialog";
import { ManageSecurityGroupDialog } from "@/components/ManageSecurityGroupDialog";
import { ManageIAMUserDialog } from "@/components/ManageIAMUserDialog";
import { RemediationDialog } from "@/components/RemediationDialog";
import { NotificationPreferencesDialog } from "@/components/NotificationPreferencesDialog";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Lock, 
  Users,
  Key,
  RefreshCw,
  Info,
  Settings,
  Plus,
  Wrench,
  Bell
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

// Mock IAM users removed - now using real data from AWS

export default function Security() {
  const { data: awsData, loading, error, refetch } = useAWSData();
  
  const securityGroups = awsData?.securityGroups || [];
  const alarms = awsData?.alarms || [];
  const iamUsers = awsData?.iamUsers || [];
  const complianceChecks = awsData?.complianceChecks || [];

  // Dialog state
  const [selectedSecurityGroup, setSelectedSecurityGroup] = useState<typeof securityGroups[0] | null>(null);
  const [selectedIAMUser, setSelectedIAMUser] = useState<typeof iamUsers[0] | null>(null);
  const [selectedComplianceCheck, setSelectedComplianceCheck] = useState<typeof complianceChecks[0] | null>(null);
  const [manageSecurityGroupOpen, setManageSecurityGroupOpen] = useState(false);
  const [manageSecurityGroupData, setManageSecurityGroupData] = useState<any>(null);
  const [manageIAMUserOpen, setManageIAMUserOpen] = useState(false);
  const [manageIAMUserData, setManageIAMUserData] = useState<any>(null);
  const [remediationOpen, setRemediationOpen] = useState(false);
  const [remediationData, setRemediationData] = useState<any>(null);
  const [notificationPrefsOpen, setNotificationPrefsOpen] = useState(false);

  // Calculate security score based on real AWS data
  const securityScore = useMemo(() => {
    let score = 100;
    
    // Deduct points for overly permissive security groups (>10 inbound rules)
    const permissiveGroups = securityGroups.filter(sg => sg.inboundRules > 10);
    score -= permissiveGroups.length * 10;
    
    // Deduct points for default security groups (potential misconfiguration)
    const defaultGroups = securityGroups.filter(sg => sg.name.toLowerCase().includes('default'));
    score -= defaultGroups.length * 5;
    
    // Deduct points for critical alarms
    const criticalAlarms = alarms.filter(alarm => 
      alarm.state === 'ALARM' && alarm.severity === 'critical'
    );
    score -= criticalAlarms.length * 20;
    
    // Deduct points for any alarm in ALARM state
    const activeAlarms = alarms.filter(alarm => alarm.state === 'ALARM');
    score -= (activeAlarms.length - criticalAlarms.length) * 5;
    
    // Bonus points for having monitoring enabled
    if (alarms.length > 0) {
      score += 5;
    }
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }, [securityGroups, alarms]);

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  // Transform CloudWatch alarms into security alerts
  const securityAlerts = useMemo(() => {
    return alarms
      .filter(alarm => alarm.state === 'ALARM' || alarm.state === 'INSUFFICIENT_DATA')
      .map(alarm => ({
        type: alarm.severity === 'critical' ? 'critical' : 
              alarm.state === 'ALARM' ? 'warning' : 'info',
        message: alarm.description || `${alarm.name} - ${alarm.state}`,
        timestamp: alarm.timestamp ? formatDistanceToNow(new Date(alarm.timestamp), { addSuffix: true }) : 'Unknown',
        resourceId: alarm.resourceId
      }))
      .slice(0, 5); // Show top 5 alerts
  }, [alarms]);

  // Calculate critical alerts count
  const criticalAlertsCount = useMemo(() => {
    return alarms.filter(alarm => 
      alarm.state === 'ALARM' && alarm.severity === 'critical'
    ).length;
  }, [alarms]);

  // Calculate IAM user stats
  const inactiveUsers = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return iamUsers.filter(user => {
      if (!user.passwordLastUsed) return true;
      return new Date(user.passwordLastUsed) < thirtyDaysAgo;
    }).length;
  }, [iamUsers]);

  // Get compliance stats
  const complianceStats = useMemo(() => {
    const compliant = complianceChecks.filter(c => c.status === 'COMPLIANT').length;
    const nonCompliant = complianceChecks.filter(c => c.status === 'NON_COMPLIANT').length;
    const total = complianceChecks.length;
    
    return { compliant, nonCompliant, total };
  }, [complianceChecks]);

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
                    <h1 className="text-3xl font-bold text-foreground">Security Center</h1>
                    <NotificationBadge source="security" className="text-base px-2 py-1" />
                  </div>
                  <p className="text-muted-foreground">Monitor and manage your AWS security posture</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setNotificationPrefsOpen(true)}
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </Button>
                  <Button onClick={refetch} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Error/Info Banner */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error.message}
                  </AlertDescription>
                </Alert>
              )}
              
              {!error && iamUsers.length === 0 && complianceChecks.length === 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    IAM and compliance data requires additional AWS permissions. Grant IAM:ListUsers and Config permissions to your AWS credentials to view this data.
                  </AlertDescription>
                </Alert>
              )}

              {/* Security Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                    <Shield className={`h-4 w-4 ${getScoreColor(securityScore)}`} />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className={`text-2xl font-bold ${getScoreColor(securityScore)}`}>
                          {securityScore}/100
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Based on {securityGroups.length} groups & {alarms.length} alarms
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-destructive">{criticalAlertsCount}</div>
                        <p className="text-xs text-muted-foreground">
                          {criticalAlertsCount > 0 ? 'Requires immediate attention' : 'No critical alerts'}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">IAM Users</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{iamUsers.length}</div>
                        <p className="text-xs text-muted-foreground">
                          {inactiveUsers} inactive {inactiveUsers === 1 ? 'user' : 'users'}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
                    <Lock className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-8 w-12" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{securityGroups.length}</div>
                        <p className="text-xs text-muted-foreground">From AWS account</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Security Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Recent Security Alerts
                  </CardTitle>
                  <CardDescription>CloudWatch alarms requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg">
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      ))}
                    </div>
                  ) : securityAlerts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                      <p>No active security alerts</p>
                      <p className="text-xs mt-1">All systems are operating normally</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {securityAlerts.map((alert, index) => (
                        <Alert key={index} variant={alert.type === "critical" ? "destructive" : "default"}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium capitalize mb-1">{alert.type}</p>
                                <p>{alert.message}</p>
                                {alert.resourceId && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Resource: {alert.resourceId}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                                {alert.timestamp}
                              </span>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security Details Tabs */}
              <Tabs defaultValue="security-groups" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="security-groups">Security Groups</TabsTrigger>
                  <TabsTrigger value="iam">IAM Users</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                </TabsList>

                <TabsContent value="security-groups" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Security Groups</CardTitle>
                      <CardDescription>Manage your EC2 security groups and firewall rules</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Group ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>VPC</TableHead>
                            <TableHead>Inbound Rules</TableHead>
                            <TableHead>Outbound Rules</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            Array(3).fill(0).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                              </TableRow>
                            ))
                          ) : securityGroups.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No security groups found
                              </TableCell>
                            </TableRow>
                          ) : (
                            securityGroups.map((group) => (
                              <TableRow key={group.id}>
                                <TableCell className="font-mono text-sm">{group.id}</TableCell>
                                <TableCell className="font-medium">{group.name}</TableCell>
                                <TableCell className="font-mono text-sm">{group.vpcId}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{group.inboundRules}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{group.outboundRules}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setSelectedSecurityGroup(group)}
                                      title="View Details"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => {
                                        setManageSecurityGroupData(group);
                                        setManageSecurityGroupOpen(true);
                                      }}
                                      title="Manage Rules"
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="iam" className="space-y-4">
                  {iamUsers.length === 0 && !loading && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No IAM users found. Ensure your AWS credentials have IAM:ListUsers permissions.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>IAM Users</CardTitle>
                        <CardDescription>Monitor user access and permissions from your AWS account</CardDescription>
                      </div>
                      <Button
                        onClick={() => {
                          setManageIAMUserData(null);
                          setManageIAMUserOpen(true);
                        }}
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create User
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>User ID</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead>Last Activity</TableHead>
                            <TableHead>Access Keys</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            Array(3).fill(0).map((_, i) => (
                              <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              </TableRow>
                            ))
                          ) : iamUsers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                No IAM users available
                              </TableCell>
                            </TableRow>
                          ) : (
                            iamUsers.map((user) => {
                              const thirtyDaysAgo = new Date();
                              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                              const isInactive = !user.passwordLastUsed || new Date(user.passwordLastUsed) < thirtyDaysAgo;
                              
                              return (
                                <TableRow 
                                  key={user.userId}
                                >
                                  <TableCell className="font-medium">{user.userName}</TableCell>
                                  <TableCell className="font-mono text-xs">{user.userId}</TableCell>
                                  <TableCell>
                                    {formatDistanceToNow(new Date(user.createDate), { addSuffix: true })}
                                  </TableCell>
                                  <TableCell>
                                    {user.passwordLastUsed 
                                      ? formatDistanceToNow(new Date(user.passwordLastUsed), { addSuffix: true })
                                      : 'Never'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{user.accessKeys}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={isInactive ? "secondary" : "default"}>
                                      {isInactive ? 'Inactive' : 'Active'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedIAMUser(user);
                                        }}
                                        title="View Details"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setManageIAMUserData(user);
                                          setManageIAMUserOpen(true);
                                        }}
                                        title="Manage User"
                                      >
                                        <Settings className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="compliance" className="space-y-4">
                  {complianceChecks.length === 0 && !loading && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        No compliance data found. Ensure AWS Config is enabled in your account and your credentials have Config permissions.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {complianceChecks.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-success">{complianceStats.compliant}</div>
                            <p className="text-sm text-muted-foreground">Compliant</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-destructive">{complianceStats.nonCompliant}</div>
                            <p className="text-sm text-muted-foreground">Non-Compliant</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-3xl font-bold">{complianceStats.total}</div>
                            <p className="text-sm text-muted-foreground">Total Checks</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Compliance Status</CardTitle>
                      <CardDescription>AWS Config compliance checks from your account</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="space-y-4">
                          {Array(3).fill(0).map((_, i) => (
                            <div key={i} className="p-4 border rounded-lg">
                              <Skeleton className="h-5 w-3/4 mb-2" />
                              <Skeleton className="h-4 w-1/2" />
                            </div>
                          ))}
                        </div>
                      ) : complianceChecks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No compliance checks available
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {complianceChecks.map((check) => {
                            const getStatusIcon = () => {
                              switch (check.status) {
                                case 'COMPLIANT':
                                  return <CheckCircle className="h-5 w-5 text-success" />;
                                case 'NON_COMPLIANT':
                                  return <AlertTriangle className="h-5 w-5 text-destructive" />;
                                default:
                                  return <Info className="h-5 w-5 text-muted-foreground" />;
                              }
                            };
                            
                            const getStatusBadge = () => {
                              switch (check.status) {
                                case 'COMPLIANT':
                                  return <Badge variant="outline" className="text-success border-success">Compliant</Badge>;
                                case 'NON_COMPLIANT':
                                  return <Badge variant="outline" className="text-destructive border-destructive">Non-Compliant</Badge>;
                                case 'NOT_APPLICABLE':
                                  return <Badge variant="outline">Not Applicable</Badge>;
                                default:
                                  return <Badge variant="outline">Insufficient Data</Badge>;
                              }
                            };
                            
                            return (
                              <div 
                                key={check.id} 
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                              >
                                <div 
                                  className="flex items-center gap-3 flex-1 cursor-pointer"
                                  onClick={() => setSelectedComplianceCheck(check)}
                                >
                                  {getStatusIcon()}
                                  <div>
                                    <p className="font-medium">{check.name}</p>
                                    <p className="text-sm text-muted-foreground">{check.description}</p>
                                    {check.resourceId && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Resource: {check.resourceType} - {check.resourceId}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge()}
                                  {check.status === 'NON_COMPLIANT' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRemediationData(check);
                                        setRemediationOpen(true);
                                      }}
                                    >
                                      <Wrench className="h-4 w-4 mr-2" />
                                      Fix
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>

      {/* Dialogs */}
      {selectedSecurityGroup && (
        <SecurityGroupDetailsDialog
          open={!!selectedSecurityGroup}
          onOpenChange={(open) => !open && setSelectedSecurityGroup(null)}
          securityGroup={selectedSecurityGroup}
        />
      )}

      {selectedIAMUser && (
        <IAMUserDetailsDialog
          open={!!selectedIAMUser}
          onOpenChange={(open) => !open && setSelectedIAMUser(null)}
          user={selectedIAMUser}
        />
      )}

      {selectedComplianceCheck && (
        <ComplianceDetailsDialog
          open={!!selectedComplianceCheck}
          onOpenChange={(open) => !open && setSelectedComplianceCheck(null)}
          check={selectedComplianceCheck}
        />
      )}

      {manageSecurityGroupOpen && (
        <ManageSecurityGroupDialog
          open={manageSecurityGroupOpen}
          onOpenChange={setManageSecurityGroupOpen}
          securityGroup={manageSecurityGroupData}
          onSuccess={() => {
            refetch();
            setManageSecurityGroupOpen(false);
          }}
        />
      )}

      {manageIAMUserOpen && (
        <ManageIAMUserDialog
          open={manageIAMUserOpen}
          onOpenChange={setManageIAMUserOpen}
          user={manageIAMUserData}
          onSuccess={() => {
            refetch();
            setManageIAMUserOpen(false);
          }}
        />
      )}

      {remediationOpen && remediationData && (
        <RemediationDialog
          open={remediationOpen}
          onOpenChange={setRemediationOpen}
          complianceCheck={remediationData}
          onSuccess={() => {
            refetch();
            setRemediationOpen(false);
          }}
        />
      )}

      {notificationPrefsOpen && (
        <NotificationPreferencesDialog
          open={notificationPrefsOpen}
          onOpenChange={setNotificationPrefsOpen}
        />
      )}
    </SidebarProvider>
  );
}