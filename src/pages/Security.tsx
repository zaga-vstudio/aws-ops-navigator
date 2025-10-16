import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Lock, 
  Users,
  Key,
  Activity,
  RefreshCw,
  Info
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const securityGroups = [
  { id: "sg-0123456789abcdef0", name: "web-servers", vpc: "vpc-12345", inbound: "3", outbound: "1" },
  { id: "sg-0987654321fedcba0", name: "database-tier", vpc: "vpc-12345", inbound: "1", outbound: "2" },
  { id: "sg-0456789012345678", name: "load-balancers", vpc: "vpc-67890", inbound: "2", outbound: "1" }
];

const iamUsers = [
  { name: "admin-user", lastActivity: "2 hours ago", status: "active", policies: "5" },
  { name: "dev-user", lastActivity: "1 day ago", status: "active", policies: "3" },
  { name: "readonly-user", lastActivity: "3 days ago", status: "inactive", policies: "1" }
];

const securityAlerts = [
  { type: "critical", message: "Security group sg-web has overly permissive rules", timestamp: "1 hour ago" },
  { type: "warning", message: "IAM user has not been active for 30+ days", timestamp: "2 hours ago" },
  { type: "info", message: "New security patch available for EC2 instances", timestamp: "5 hours ago" }
];

export default function Security() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
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
                  <h1 className="text-3xl font-bold text-foreground">Security Center</h1>
                  <p className="text-muted-foreground">Monitor and manage your AWS security posture</p>
                </div>
                <Button onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {/* Info Banner */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Security monitoring integration coming soon. Currently displaying sample data for demonstration purposes.
                </AlertDescription>
              </Alert>

              {/* Security Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Score</CardTitle>
                    <Shield className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">87/100</div>
                    <p className="text-xs text-muted-foreground">+5 from last week</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">3</div>
                    <p className="text-xs text-muted-foreground">Requires immediate attention</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">IAM Users</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">3 inactive users</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
                    <Lock className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">8</div>
                    <p className="text-xs text-muted-foreground">2 with open rules</p>
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
                  <CardDescription>Critical security issues requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {securityAlerts.map((alert, index) => (
                      <Alert key={index} variant={alert.type === "critical" ? "destructive" : "default"}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium capitalize mb-1">{alert.type}</p>
                              <p>{alert.message}</p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{alert.timestamp}</span>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
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
                          {securityGroups.map((group) => (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium">{group.id}</TableCell>
                              <TableCell>{group.name}</TableCell>
                              <TableCell>{group.vpc}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{group.inbound}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{group.outbound}</Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="iam" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>IAM Users</CardTitle>
                      <CardDescription>Monitor user access and permissions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Last Activity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Policies</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {iamUsers.map((user) => (
                            <TableRow key={user.name}>
                              <TableCell className="font-medium">{user.name}</TableCell>
                              <TableCell>{user.lastActivity}</TableCell>
                              <TableCell>
                                <Badge variant={user.status === "active" ? "default" : "secondary"}>
                                  {user.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{user.policies}</Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  <Key className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="compliance" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Compliance Status</CardTitle>
                      <CardDescription>AWS security best practices compliance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-success" />
                            <div>
                              <p className="font-medium">MFA Enabled</p>
                              <p className="text-sm text-muted-foreground">Multi-factor authentication is configured</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-success border-success">Compliant</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                            <div>
                              <p className="font-medium">Root Access Keys</p>
                              <p className="text-sm text-muted-foreground">Root account access keys detected</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-warning border-warning">Warning</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-success" />
                            <div>
                              <p className="font-medium">CloudTrail Logging</p>
                              <p className="text-sm text-muted-foreground">API call logging is enabled</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-success border-success">Compliant</Badge>
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