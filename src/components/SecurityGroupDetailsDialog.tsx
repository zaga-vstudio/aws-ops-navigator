import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Shield, Lock, Unlock, Info, CheckCircle } from "lucide-react";
import { useMemo } from "react";

interface SecurityGroupRule {
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  cidrIpv4?: string;
  cidrIpv6?: string;
  sourceSecurityGroupId?: string;
  prefixListId?: string;
  description?: string;
}

interface SecurityGroupDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  securityGroup: {
    id: string;
    name: string;
    description: string;
    vpcId: string;
    inboundRules: SecurityGroupRule[];
    outboundRules: SecurityGroupRule[];
  };
}

// Helper function to format protocol
const formatProtocol = (protocol: string): string => {
  if (protocol === "-1") return "All";
  return protocol.toUpperCase();
};

// Helper function to format port range
const formatPortRange = (rule: SecurityGroupRule): string => {
  if (rule.ipProtocol === "-1") return "All";
  if (rule.fromPort === undefined && rule.toPort === undefined) return "All";
  if (rule.fromPort === rule.toPort) return String(rule.fromPort);
  return `${rule.fromPort}-${rule.toPort}`;
};

// Helper function to get source/destination
const getSource = (rule: SecurityGroupRule): string => {
  if (rule.cidrIpv4) return rule.cidrIpv4;
  if (rule.cidrIpv6) return rule.cidrIpv6;
  if (rule.sourceSecurityGroupId) return rule.sourceSecurityGroupId;
  if (rule.prefixListId) return rule.prefixListId;
  return "Unknown";
};

export function SecurityGroupDetailsDialog({ 
  open, 
  onOpenChange, 
  securityGroup 
}: SecurityGroupDetailsDialogProps) {
  // Use actual rules from the security group
  const inboundRules = securityGroup.inboundRules;
  const outboundRules = securityGroup.outboundRules;

  // Security analysis based on actual rules
  const vulnerabilities = useMemo(() => {
    const vulns: { severity: "high" | "medium"; rule: string; recommendation: string; protocol: string; port: string }[] = [];
    
    for (const rule of inboundRules) {
      const port = formatPortRange(rule);
      const source = getSource(rule);
      
      // Check for SSH open to the world
      if ((rule.fromPort === 22 || port === "22") && source === "0.0.0.0/0") {
        vulns.push({
          severity: "high",
          rule: "SSH (Port 22) open to 0.0.0.0/0",
          recommendation: "Restrict SSH access to specific IP ranges or use AWS Systems Manager Session Manager",
          protocol: formatProtocol(rule.ipProtocol),
          port: "22"
        });
      }
      
      // Check for RDP open to the world
      if ((rule.fromPort === 3389 || port === "3389") && source === "0.0.0.0/0") {
        vulns.push({
          severity: "high",
          rule: "RDP (Port 3389) open to 0.0.0.0/0",
          recommendation: "Restrict RDP access to specific IP ranges or use a bastion host",
          protocol: formatProtocol(rule.ipProtocol),
          port: "3389"
        });
      }
      
      // Check for all traffic open to the world
      if (rule.ipProtocol === "-1" && source === "0.0.0.0/0") {
        vulns.push({
          severity: "high",
          rule: "All traffic open to 0.0.0.0/0",
          recommendation: "Restrict inbound access to only necessary ports and specific IP ranges",
          protocol: "All",
          port: "All"
        });
      }
    }
    
    return vulns;
  }, [inboundRules]);

  const hasPublicSSH = inboundRules.some(rule => 
    (rule.fromPort === 22 || formatPortRange(rule) === "22") && getSource(rule) === "0.0.0.0/0"
  );

  const hasPublicRDP = inboundRules.some(rule => 
    (rule.fromPort === 3389 || formatPortRange(rule) === "3389") && getSource(rule) === "0.0.0.0/0"
  );

  const hasUnrestrictedPorts = inboundRules.some(rule => {
    const source = getSource(rule);
    const port = formatPortRange(rule);
    return source === "0.0.0.0/0" && !["443", "80"].includes(port);
  });

  const securityScore = hasPublicSSH || hasPublicRDP ? 40 : hasUnrestrictedPorts ? 60 : 85;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Group Details
          </DialogTitle>
          <DialogDescription>
            {securityGroup.name} ({securityGroup.id})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Security Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  securityScore >= 80 ? 'text-success' : 
                  securityScore >= 60 ? 'text-warning' : 
                  'text-destructive'
                }`}>
                  {securityScore}/100
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Inbound Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{securityGroup.inboundRules.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Outbound Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{securityGroup.outboundRules.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Security Alerts */}
          {vulnerabilities.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Security Vulnerabilities Detected</div>
                <ul className="space-y-1 text-sm">
                  {vulnerabilities.map((vuln, index) => (
                    <li key={index}>
                      <span className="font-medium capitalize">{vuln.severity}:</span> {vuln.rule}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Group ID:</span>
                  <p className="font-mono">{securityGroup.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">VPC ID:</span>
                  <p className="font-mono">{securityGroup.vpcId}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Description:</span>
                  <p>{securityGroup.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rules Tabs */}
          <Tabs defaultValue="inbound" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inbound">Inbound Rules ({inboundRules.length})</TabsTrigger>
              <TabsTrigger value="outbound">Outbound Rules ({outboundRules.length})</TabsTrigger>
              <TabsTrigger value="analysis">Security Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="inbound" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {inboundRules.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No inbound rules configured</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Port Range</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Risk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboundRules.map((rule, index) => {
                          const source = getSource(rule);
                          const port = formatPortRange(rule);
                          const isRisky = source === "0.0.0.0/0" && !["443", "80"].includes(port);
                          return (
                            <TableRow key={index}>
                              <TableCell><Badge variant="outline">{formatProtocol(rule.ipProtocol)}</Badge></TableCell>
                              <TableCell className="font-mono">{port}</TableCell>
                              <TableCell className="font-mono text-sm">{source}</TableCell>
                              <TableCell className="text-sm">{rule.description || "-"}</TableCell>
                              <TableCell>
                                {isRisky ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <Unlock className="h-3 w-3" />
                                    High Risk
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <Lock className="h-3 w-3" />
                                    Secure
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="outbound" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {outboundRules.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No outbound rules configured</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Port Range</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboundRules.map((rule, index) => (
                          <TableRow key={index}>
                            <TableCell><Badge variant="outline">{formatProtocol(rule.ipProtocol)}</Badge></TableCell>
                            <TableCell className="font-mono">{formatPortRange(rule)}</TableCell>
                            <TableCell className="font-mono text-sm">{getSource(rule)}</TableCell>
                            <TableCell className="text-sm">{rule.description || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analysis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Security Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {vulnerabilities.length > 0 ? (
                    vulnerabilities.map((vuln, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                            vuln.severity === 'high' ? 'text-destructive' : 'text-warning'
                          }`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={vuln.severity === 'high' ? 'destructive' : 'secondary'}>
                                {vuln.severity.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{vuln.rule}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Protocol: {vuln.protocol}, Port: {vuln.port}
                            </p>
                            <div className="bg-muted p-3 rounded-md">
                              <p className="text-sm font-medium mb-1">Recommendation:</p>
                              <p className="text-sm">{vuln.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-success" />
                      <p className="font-medium">No security issues detected</p>
                      <p className="text-sm text-muted-foreground">
                        This security group follows AWS best practices
                      </p>
                    </div>
                  )}

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-1">Best Practices:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Avoid opening SSH (22) and RDP (3389) to 0.0.0.0/0</li>
                        <li>Use VPN or bastion hosts for administrative access</li>
                        <li>Apply principle of least privilege for all rules</li>
                        <li>Regularly audit and remove unused rules</li>
                        <li>Use AWS Systems Manager Session Manager instead of SSH</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
