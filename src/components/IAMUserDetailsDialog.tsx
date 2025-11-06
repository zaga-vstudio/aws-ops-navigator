import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, Shield, AlertTriangle, Clock, CheckCircle, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AccessKey {
  accessKeyId: string;
  status: "Active" | "Inactive";
  createDate: string;
  lastUsed?: string;
}

interface IAMUserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    userName: string;
    userId: string;
    arn: string;
    createDate: string;
    passwordLastUsed?: string;
    mfaEnabled: boolean;
    accessKeys: number;
  };
}

export function IAMUserDetailsDialog({ 
  open, 
  onOpenChange, 
  user 
}: IAMUserDetailsDialogProps) {
  // Mock data for demonstration - In production, this would come from AWS SDK
  const accessKeys: AccessKey[] = [
    {
      accessKeyId: "AKIA...XYZ123",
      status: "Active",
      createDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const policies = [
    "AmazonEC2ReadOnlyAccess",
    "AmazonS3ReadOnlyAccess",
    "CloudWatchReadOnlyAccess",
  ];

  // Security analysis
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const isInactive = !user.passwordLastUsed || new Date(user.passwordLastUsed) < thirtyDaysAgo;
  const hasOldAccessKeys = accessKeys.some(key => new Date(key.createDate) < ninetyDaysAgo);
  
  const securityIssues = [];
  if (!user.mfaEnabled) {
    securityIssues.push({
      severity: "high" as const,
      issue: "MFA not enabled",
      recommendation: "Enable Multi-Factor Authentication to add an extra layer of security"
    });
  }
  if (hasOldAccessKeys) {
    securityIssues.push({
      severity: "medium" as const,
      issue: "Access keys older than 90 days",
      recommendation: "Rotate access keys regularly (recommended: every 90 days)"
    });
  }
  if (isInactive) {
    securityIssues.push({
      severity: "low" as const,
      issue: "Inactive user (no activity in 30+ days)",
      recommendation: "Consider disabling or removing inactive users to reduce security risks"
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            IAM User Details
          </DialogTitle>
          <DialogDescription>
            {user.userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Security Status Alert */}
          {securityIssues.length > 0 && (
            <Alert variant={securityIssues.some(i => i.severity === 'high') ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">
                  {securityIssues.length} Security {securityIssues.length === 1 ? 'Issue' : 'Issues'} Detected
                </div>
                <ul className="space-y-1 text-sm">
                  {securityIssues.map((issue, index) => (
                    <li key={index}>
                      <span className="font-medium capitalize">{issue.severity}:</span> {issue.issue}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  MFA Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={user.mfaEnabled ? "default" : "destructive"} className="gap-1">
                  {user.mfaEnabled ? <CheckCircle className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Access Keys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{user.accessKeys}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={isInactive ? "secondary" : "default"}>
                  {isInactive ? 'Inactive' : 'Active'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Username:</span>
                  <p className="font-medium">{user.userName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <p className="font-mono text-xs">{user.userId}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">ARN:</span>
                  <p className="font-mono text-xs break-all">{user.arn}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p>{formatDistanceToNow(new Date(user.createDate), { addSuffix: true })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Activity:</span>
                  <p>{user.passwordLastUsed 
                    ? formatDistanceToNow(new Date(user.passwordLastUsed), { addSuffix: true })
                    : 'Never'
                  }</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Access Keys</CardTitle>
            </CardHeader>
            <CardContent>
              {accessKeys.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Access Key ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Age</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessKeys.map((key) => {
                      const keyAge = Math.floor((Date.now() - new Date(key.createDate).getTime()) / (1000 * 60 * 60 * 24));
                      const isOld = keyAge > 90;
                      
                      return (
                        <TableRow key={key.accessKeyId}>
                          <TableCell className="font-mono text-sm">{key.accessKeyId}</TableCell>
                          <TableCell>
                            <Badge variant={key.status === "Active" ? "default" : "secondary"}>
                              {key.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDistanceToNow(new Date(key.createDate), { addSuffix: true })}
                          </TableCell>
                          <TableCell>
                            {key.lastUsed 
                              ? formatDistanceToNow(new Date(key.lastUsed), { addSuffix: true })
                              : 'Never'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge variant={isOld ? "destructive" : "secondary"}>
                              {keyAge} days
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No access keys configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Policies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attached Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {policies.map((policy, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium text-sm">{policy}</span>
                    <Badge variant="outline">Managed Policy</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security Recommendations */}
          {securityIssues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {securityIssues.map((issue, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                        issue.severity === 'high' ? 'text-destructive' : 
                        issue.severity === 'medium' ? 'text-warning' : 
                        'text-muted-foreground'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={
                            issue.severity === 'high' ? 'destructive' : 
                            issue.severity === 'medium' ? 'secondary' : 
                            'outline'
                          }>
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{issue.issue}</span>
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm font-medium mb-1">Recommendation:</p>
                          <p className="text-sm">{issue.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
