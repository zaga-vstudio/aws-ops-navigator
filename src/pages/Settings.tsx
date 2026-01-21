import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Globe, 
  Moon,
  Sun,
  Bell,
  Key,
  Database,
  Cloud,
  Save,
  RefreshCw,
  FileCode,
  Download
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useTheme } from "next-themes";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { Enable2FADialog } from "@/components/Enable2FADialog";
import { AWSCredentialsDialog } from "@/components/AWSCredentialsDialog";
import { IaCExportDialog } from "@/components/IaCExportDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAWSData } from "@/hooks/useAWSData";

export default function Settings() {
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    email: true,
    desktop: false,
    mobile: true,
    marketing: false
  });
  
  // Security dialogs state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [enable2FAOpen, setEnable2FAOpen] = useState(false);
  const [awsCredentialsOpen, setAWSCredentialsOpen] = useState(false);
  const [awsCredentialsMode, setAWSCredentialsMode] = useState<"update" | "test">("update");
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [iacExportOpen, setIaCExportOpen] = useState(false);

  // Fetch AWS data for IaC export
  const { data: awsData, costExplorerState, enableCostExplorer, disableCostExplorer } = useAWSData();

  // Check if 2FA is enabled
  useEffect(() => {
    const check2FA = async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        setIs2FAEnabled(data.totp.length > 0);
      }
    };
    check2FA();
  }, []);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => setSaving(false), 2000);
  };

  const handle2FAToggle = async (checked: boolean) => {
    if (checked && !is2FAEnabled) {
      setEnable2FAOpen(true);
    } else if (!checked && is2FAEnabled) {
      // Disable 2FA
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors && factors.totp.length > 0) {
          const { error } = await supabase.auth.mfa.unenroll({
            factorId: factors.totp[0].id
          });
          if (error) throw error;
          setIs2FAEnabled(false);
          toast.success("Two-factor authentication disabled");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to disable 2FA");
      }
    }
  };

  const handleAWSCredentialsClick = (mode: "update" | "test") => {
    setAWSCredentialsMode(mode);
    setAWSCredentialsOpen(true);
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
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                  <p className="text-muted-foreground">Manage your account and application preferences</p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-pulse' : ''}`} />
                  Save Changes
                </Button>
              </div>

              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="aws">AWS Config</TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="notifications">Notifications</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile Information
                      </CardTitle>
                      <CardDescription>Update your personal information and preferences</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="displayName">Display Name</Label>
                          <Input id="displayName" defaultValue="John Doe" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" defaultValue="john.doe@company.com" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="company">Company</Label>
                          <Input id="company" defaultValue="TechCorp Inc." />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timezone">Timezone</Label>
                          <Select defaultValue="america/new_york">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="america/new_york">Eastern Time</SelectItem>
                              <SelectItem value="america/chicago">Central Time</SelectItem>
                              <SelectItem value="america/denver">Mountain Time</SelectItem>
                              <SelectItem value="america/los_angeles">Pacific Time</SelectItem>
                              <SelectItem value="utc">UTC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="aws" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        AWS Configuration
                      </CardTitle>
                      <CardDescription>Manage your AWS account settings and preferences</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="defaultRegion">Default AWS Region</Label>
                        <Select defaultValue="us-east-1">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                            <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                            <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                            <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="projects">Project Tags</Label>
                        <Textarea 
                          id="projects"
                          placeholder="Enter project names separated by commas (e.g., production, staging, development)"
                          defaultValue="production, staging, development, testing"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Alert Thresholds</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="cpuThreshold">CPU Threshold (%)</Label>
                            <Input id="cpuThreshold" type="number" defaultValue="80" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="memoryThreshold">Memory Threshold (%)</Label>
                            <Input id="memoryThreshold" type="number" defaultValue="85" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="diskThreshold">Disk Threshold (%)</Label>
                            <Input id="diskThreshold" type="number" defaultValue="90" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="networkThreshold">Network Threshold (MB/s)</Label>
                            <Input id="networkThreshold" type="number" defaultValue="1000" />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Cost & Billing</h3>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-1">
                            <Label>AWS Cost Explorer</Label>
                            <p className="text-sm text-muted-foreground">
                              Enable detailed cost analysis and spending trends
                            </p>
                            <p className="text-xs text-warning">
                              ⚠️ AWS charges ~$0.01 per API request (cached for 6h)
                            </p>
                          </div>
                          <Switch 
                            checked={costExplorerState.enabled}
                            disabled={costExplorerState.loading}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                enableCostExplorer();
                              } else {
                                disableCostExplorer();
                              }
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="export" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCode className="h-5 w-5" />
                        Infrastructure as Code Export
                      </CardTitle>
                      <CardDescription>
                        Export your current AWS infrastructure configuration as Terraform or CloudFormation code
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
                        <FileCode className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium mb-2">Generate IaC from Your Infrastructure</h3>
                        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                          Convert your current AWS setup (EC2 instances, VPCs, RDS databases, Security Groups) 
                          into reusable Infrastructure as Code templates.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mb-4">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                            <img 
                              src="https://www.terraform.io/favicon.ico" 
                              alt="Terraform" 
                              className="h-4 w-4"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            Terraform (.tf)
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                            <img 
                              src="https://aws.amazon.com/favicon.ico" 
                              alt="AWS" 
                              className="h-4 w-4"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            CloudFormation (.json)
                          </div>
                        </div>
                        <Button onClick={() => setIaCExportOpen(true)} size="lg">
                          <Download className="h-4 w-4 mr-2" />
                          Open Export Dialog
                        </Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">What Gets Exported</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-start gap-3 p-3 border rounded-lg">
                            <Cloud className="h-5 w-5 text-blue-500 mt-0.5" />
                            <div>
                              <p className="font-medium">VPCs & Subnets</p>
                              <p className="text-sm text-muted-foreground">Network configuration with CIDR blocks</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 border rounded-lg">
                            <Shield className="h-5 w-5 text-amber-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Security Groups</p>
                              <p className="text-sm text-muted-foreground">Firewall rules and access policies</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 border rounded-lg">
                            <Cloud className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium">EC2 Instances</p>
                              <p className="text-sm text-muted-foreground">Instance types and configurations</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 border rounded-lg">
                            <Database className="h-5 w-5 text-purple-500 mt-0.5" />
                            <div>
                              <p className="font-medium">RDS Databases</p>
                              <p className="text-sm text-muted-foreground">Engine, storage, and instance class</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="appearance" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Sun className="h-5 w-5" />
                        Appearance
                      </CardTitle>
                      <CardDescription>Customize how CloudHub looks and feels</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <Label>Theme</Label>
                        <div className="flex items-center space-x-4">
                          <Button
                            variant={theme === "light" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTheme("light")}
                            className="flex items-center gap-2"
                          >
                            <Sun className="h-4 w-4" />
                            Light
                          </Button>
                          <Button
                            variant={theme === "dark" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTheme("dark")}
                            className="flex items-center gap-2"
                          >
                            <Moon className="h-4 w-4" />
                            Dark
                          </Button>
                          <Button
                            variant={theme === "system" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTheme("system")}
                            className="flex items-center gap-2"
                          >
                            <SettingsIcon className="h-4 w-4" />
                            System
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Display Preferences</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Compact mode</Label>
                              <p className="text-sm text-muted-foreground">Use less space for tables and cards</p>
                            </div>
                            <Switch />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Show tooltips</Label>
                              <p className="text-sm text-muted-foreground">Display helpful tooltips on hover</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Auto-refresh dashboard</Label>
                              <p className="text-sm text-muted-foreground">Automatically refresh data every 30 seconds</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Preferences
                      </CardTitle>
                      <CardDescription>Choose how you want to be notified about important events</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Notification Channels</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Email notifications</Label>
                              <p className="text-sm text-muted-foreground">Receive alerts via email</p>
                            </div>
                            <Switch 
                              checked={notifications.email}
                              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Desktop notifications</Label>
                              <p className="text-sm text-muted-foreground">Show browser notifications</p>
                            </div>
                            <Switch 
                              checked={notifications.desktop}
                              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, desktop: checked }))}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Mobile push notifications</Label>
                              <p className="text-sm text-muted-foreground">Receive push notifications on mobile</p>
                            </div>
                            <Switch 
                              checked={notifications.mobile}
                              onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, mobile: checked }))}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Alert Types</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Critical alerts</Label>
                              <p className="text-sm text-muted-foreground">High-priority issues requiring immediate attention</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Warning alerts</Label>
                              <p className="text-sm text-muted-foreground">Medium-priority issues and warnings</p>
                            </div>
                            <Switch defaultChecked />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Information alerts</Label>
                              <p className="text-sm text-muted-foreground">General information and updates</p>
                            </div>
                            <Switch />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="security" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Security Settings
                      </CardTitle>
                      <CardDescription>Manage your account security and access controls</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Password & Authentication</h3>
                        <div className="space-y-3">
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => setChangePasswordOpen(true)}
                          >
                            <Key className="h-4 w-4 mr-2" />
                            Change Password
                          </Button>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Two-factor authentication</Label>
                              <p className="text-sm text-muted-foreground">
                                {is2FAEnabled ? "2FA is currently enabled" : "Add an extra layer of security to your account"}
                              </p>
                            </div>
                            <Switch 
                              checked={is2FAEnabled}
                              onCheckedChange={handle2FAToggle}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">AWS Credentials</h3>
                        <div className="space-y-3">
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => handleAWSCredentialsClick("update")}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Update AWS Credentials
                          </Button>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={() => handleAWSCredentialsClick("test")}
                          >
                            <Database className="h-4 w-4 mr-2" />
                            Test AWS Connection
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Session Management</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Auto-logout</Label>
                              <p className="text-sm text-muted-foreground">Automatically log out after inactivity</p>
                            </div>
                            <Select defaultValue="4h">
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1h">1 hour</SelectItem>
                                <SelectItem value="4h">4 hours</SelectItem>
                                <SelectItem value="8h">8 hours</SelectItem>
                                <SelectItem value="never">Never</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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

      {/* Security Dialogs */}
      <ChangePasswordDialog 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />
      <Enable2FADialog 
        open={enable2FAOpen} 
        onOpenChange={setEnable2FAOpen}
        onSuccess={() => setIs2FAEnabled(true)}
      />
      <AWSCredentialsDialog 
        open={awsCredentialsOpen} 
        onOpenChange={setAWSCredentialsOpen}
        mode={awsCredentialsMode}
      />
      <IaCExportDialog
        open={iacExportOpen}
        onOpenChange={setIaCExportOpen}
        ec2Instances={awsData?.ec2Instances || []}
        rdsDatabases={awsData?.rdsDatabases || []}
        vpcs={awsData?.vpcs || []}
        subnets={awsData?.subnets || []}
        securityGroups={awsData?.securityGroups || []}
      />
    </SidebarProvider>
  );
}