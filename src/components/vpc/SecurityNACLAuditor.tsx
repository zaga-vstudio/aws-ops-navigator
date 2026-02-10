import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, AlertTriangle, Copy, CheckCircle, Lock, Unlock } from "lucide-react";
import { CostBadge } from "./CostBadge";
import { useToast } from "@/hooks/use-toast";
import type { SecurityGroup } from "@/hooks/useAWSData";
import type { NACL } from "@/hooks/useVPCAdvancedData";

interface SecurityNACLAuditorProps {
  securityGroups: SecurityGroup[];
  nacls: NACL[];
  loading: boolean;
}

const formatProtocol = (protocol: string): string => {
  if (protocol === "-1" || protocol === '-1') return "All";
  if (protocol === "6") return "TCP";
  if (protocol === "17") return "UDP";
  if (protocol === "1") return "ICMP";
  return protocol.toUpperCase();
};

export function SecurityNACLAuditor({ securityGroups, nacls, loading }: SecurityNACLAuditorProps) {
  const { toast } = useToast();
  const [cloneSource, setCloneSource] = useState<string>('');
  const [cloneTarget, setCloneTarget] = useState<string>('');

  // Audit: find "Allow All" rules
  const sgAuditFindings = useMemo(() => {
    const findings: { sgId: string; sgName: string; direction: string; rule: string; severity: 'high' | 'medium' }[] = [];
    for (const sg of securityGroups) {
      for (const rule of sg.inboundRules) {
        const source = rule.cidrIpv4 || rule.cidrIpv6 || '';
        if (source === '0.0.0.0/0' || source === '::/0') {
          const port = rule.fromPort === rule.toPort
            ? String(rule.fromPort ?? 'All')
            : `${rule.fromPort}-${rule.toPort}`;
          const isAllTraffic = rule.ipProtocol === '-1';
          findings.push({
            sgId: sg.id,
            sgName: sg.name,
            direction: 'Inbound',
            rule: isAllTraffic
              ? `All traffic from ${source}`
              : `${rule.ipProtocol?.toUpperCase()} port ${port} from ${source}`,
            severity: isAllTraffic || ['22', '3389'].includes(String(rule.fromPort)) ? 'high' : 'medium',
          });
        }
      }
    }
    return findings;
  }, [securityGroups]);

  const naclAuditFindings = useMemo(() => {
    const findings: { naclId: string; naclName: string; direction: string; ruleNumber: number; rule: string; severity: 'high' | 'medium' }[] = [];
    for (const nacl of nacls) {
      for (const entry of nacl.entries) {
        if (entry.ruleNumber === 32767) continue; // Skip default deny
        if (entry.ruleAction === 'allow' && (entry.cidrBlock === '0.0.0.0/0' || entry.cidrBlock === '::/0')) {
          const isAllTraffic = entry.protocol === '-1';
          const portStr = entry.portRange ? `${entry.portRange.from}-${entry.portRange.to}` : 'All';
          findings.push({
            naclId: nacl.id,
            naclName: nacl.name,
            direction: entry.egress ? 'Outbound' : 'Inbound',
            ruleNumber: entry.ruleNumber,
            rule: isAllTraffic
              ? `All traffic from ${entry.cidrBlock}`
              : `${formatProtocol(entry.protocol)} port ${portStr} from ${entry.cidrBlock}`,
            severity: !entry.egress && isAllTraffic ? 'high' : 'medium',
          });
        }
      }
    }
    return findings;
  }, [nacls]);

  const handleClone = () => {
    if (!cloneSource || !cloneTarget || cloneSource === cloneTarget) {
      toast({ title: 'Invalid selection', description: 'Select different source and target security groups.', variant: 'destructive' });
      return;
    }
    const source = securityGroups.find(sg => sg.id === cloneSource);
    if (!source) return;
    toast({
      title: 'Clone Rules',
      description: `To clone rules from ${source.name}, use the AWS Console or CLI. Rule cloning is a metadata-only preview.`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Group & NACL Auditor
        </CardTitle>
        <CostBadge type="free" label="Local Metadata Analysis (Free)" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="sg-audit">
          <TabsList>
            <TabsTrigger value="sg-audit">
              SG Audit
              {sgAuditFindings.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">{sgAuditFindings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nacl-audit">
              NACL Audit
              {naclAuditFindings.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 px-1.5">{naclAuditFindings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="clone">Clone Utility</TabsTrigger>
          </TabsList>

          <TabsContent value="sg-audit" className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : sgAuditFindings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                <p className="font-medium">No open "Allow All" rules detected</p>
                <p className="text-sm text-muted-foreground">Security groups follow least-privilege principles</p>
              </div>
            ) : (
              <>
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {sgAuditFindings.length} rule(s) with unrestricted access (0.0.0.0/0) detected
                  </AlertDescription>
                </Alert>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Security Group</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sgAuditFindings.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium text-sm">{f.sgName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{f.sgId}</div>
                        </TableCell>
                        <TableCell>{f.direction}</TableCell>
                        <TableCell className="text-sm">{f.rule}</TableCell>
                        <TableCell>
                          <Badge variant={f.severity === 'high' ? 'destructive' : 'secondary'} className="gap-1">
                            {f.severity === 'high' ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {f.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          <TabsContent value="nacl-audit" className="space-y-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : naclAuditFindings.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                <p className="font-medium">No open NACL rules detected</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NACL</TableHead>
                    <TableHead>Rule #</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {naclAuditFindings.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="font-medium text-sm">{f.naclName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{f.naclId}</div>
                      </TableCell>
                      <TableCell>{f.ruleNumber}</TableCell>
                      <TableCell>{f.direction}</TableCell>
                      <TableCell className="text-sm">{f.rule}</TableCell>
                      <TableCell>
                        <Badge variant={f.severity === 'high' ? 'destructive' : 'secondary'}>
                          {f.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="clone" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Clone security group rules from a source group to a target group. This previews the rules to be copied.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Security Group</label>
                <Select value={cloneSource} onValueChange={setCloneSource}>
                  <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>
                    {securityGroups.map(sg => (
                      <SelectItem key={sg.id} value={sg.id}>{sg.name} ({sg.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Security Group</label>
                <Select value={cloneTarget} onValueChange={setCloneTarget}>
                  <SelectTrigger><SelectValue placeholder="Select target..." /></SelectTrigger>
                  <SelectContent>
                    {securityGroups.filter(sg => sg.id !== cloneSource).map(sg => (
                      <SelectItem key={sg.id} value={sg.id}>{sg.name} ({sg.id})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {cloneSource && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <h4 className="text-sm font-medium">Rules to clone from {securityGroups.find(s => s.id === cloneSource)?.name}:</h4>
                <p className="text-xs text-muted-foreground">
                  {securityGroups.find(s => s.id === cloneSource)?.inboundRules.length || 0} inbound, {' '}
                  {securityGroups.find(s => s.id === cloneSource)?.outboundRules.length || 0} outbound rules
                </p>
              </div>
            )}
            <Button onClick={handleClone} disabled={!cloneSource || !cloneTarget} className="gap-2">
              <Copy className="h-4 w-4" />
              Clone Rules
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
