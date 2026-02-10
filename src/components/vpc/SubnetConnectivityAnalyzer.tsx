import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, Lock, Wifi, WifiOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { CostBadge } from "./CostBadge";
import type { Subnet, SecurityGroup } from "@/hooks/useAWSData";
import type { RouteTable, NACL, NATGateway, InternetGateway } from "@/hooks/useVPCAdvancedData";

interface SubnetConnectivityAnalyzerProps {
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  routeTables: RouteTable[];
  nacls: NACL[];
  natGateways: NATGateway[];
  internetGateways: InternetGateway[];
  loading: boolean;
}

interface SubnetAnalysis {
  subnet: Subnet;
  type: 'Public' | 'Private';
  hasIGWRoute: boolean;
  hasNATGateway: boolean;
  port22Reachable: boolean;
  port22BlockedBy: string | null;
}

export function SubnetConnectivityAnalyzer({
  subnets, securityGroups, routeTables, nacls, natGateways, internetGateways, loading,
}: SubnetConnectivityAnalyzerProps) {

  const analysis = useMemo<SubnetAnalysis[]>(() => {
    return subnets.map((subnet) => {
      // Find route table for this subnet
      const rt = routeTables.find(r =>
        r.associations.some(a => a.subnetId === subnet.id)
      ) || routeTables.find(r =>
        r.vpcId === subnet.vpcId && r.associations.some(a => a.main)
      );

      // Check for IGW route (public subnet indicator)
      const igwIds = internetGateways
        .filter(igw => igw.attachments.some(a => a.vpcId === subnet.vpcId))
        .map(igw => igw.id);

      const hasIGWRoute = rt?.routes.some(r =>
        r.gatewayId && igwIds.includes(r.gatewayId) && r.destinationCidr === '0.0.0.0/0'
      ) || false;

      // Check for NAT Gateway route
      const hasNATGateway = rt?.routes.some(r =>
        r.natGatewayId && r.destinationCidr === '0.0.0.0/0'
      ) || false;

      // Check Port 22 reachability via SG + NACL
      const subnetNacl = nacls.find(n =>
        n.associations.some(a => a.subnetId === subnet.id)
      ) || nacls.find(n => n.vpcId === subnet.vpcId && n.isDefault);

      // Check NACL allows port 22 inbound
      const naclAllowsSSH = subnetNacl?.entries
        .filter(e => !e.egress && e.ruleAction === 'allow')
        .some(e => {
          if (e.protocol === '-1') return true;
          if (e.protocol === '6' && e.portRange) {
            return e.portRange.from <= 22 && e.portRange.to >= 22;
          }
          return false;
        }) ?? true;

      const naclDeniesSSH = subnetNacl?.entries
        .filter(e => !e.egress && e.ruleAction === 'deny')
        .sort((a, b) => a.ruleNumber - b.ruleNumber)
        .some(e => {
          if (e.ruleNumber === 32767) return false; // default deny
          if (e.protocol === '-1') return true;
          if (e.protocol === '6' && e.portRange) {
            return e.portRange.from <= 22 && e.portRange.to >= 22;
          }
          return false;
        }) ?? false;

      // Check if any SG in this VPC allows port 22
      const vpcSGs = securityGroups.filter(sg => sg.vpcId === subnet.vpcId);
      const sgAllowsSSH = vpcSGs.some(sg =>
        sg.inboundRules.some(r => {
          if (r.ipProtocol === '-1') return true;
          if (r.ipProtocol === 'tcp' && r.fromPort !== undefined && r.toPort !== undefined) {
            return r.fromPort <= 22 && r.toPort >= 22;
          }
          return false;
        })
      );

      let port22BlockedBy: string | null = null;
      if (!hasIGWRoute && !hasNATGateway) port22BlockedBy = 'No internet route';
      else if (naclDeniesSSH) port22BlockedBy = 'NACL deny rule';
      else if (!naclAllowsSSH) port22BlockedBy = 'NACL (no allow rule)';
      else if (!sgAllowsSSH) port22BlockedBy = 'Security Group';

      return {
        subnet,
        type: hasIGWRoute ? 'Public' : 'Private',
        hasIGWRoute,
        hasNATGateway,
        port22Reachable: hasIGWRoute && naclAllowsSSH && !naclDeniesSSH && sgAllowsSSH,
        port22BlockedBy,
      };
    });
  }, [subnets, securityGroups, routeTables, nacls, natGateways, internetGateways]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Subnet Connectivity Analyzer
        </CardTitle>
        <CostBadge type="free" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subnet</TableHead>
                <TableHead>VPC</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>NAT Gateway</TableHead>
                <TableHead>Port 22 Reachability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(5).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : analysis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No subnets to analyze
                  </TableCell>
                </TableRow>
              ) : (
                analysis.map((item) => (
                  <TableRow key={item.subnet.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{item.subnet.id}</div>
                      <div className="text-xs text-muted-foreground">{item.subnet.name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.subnet.vpcId}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === 'Public' ? 'default' : 'secondary'} className="gap-1">
                        {item.type === 'Public' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.type === 'Private' ? (
                        item.hasNATGateway ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Available</Badge>
                        ) : (
                          <Badge variant="destructive" className="opacity-80">Not configured</Badge>
                        )
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A (Public)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.port22Reachable ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Reachable
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Blocked
                          </Badge>
                          {item.port22BlockedBy && (
                            <span className="text-xs text-muted-foreground">({item.port22BlockedBy})</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
