import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Globe, Shield, Router } from "lucide-react";
import { VPC, Subnet, SecurityGroup } from "@/hooks/useAWSData";
import { RouteTable, NACL, InternetGateway, NATGateway } from "@/hooks/useVPCAdvancedData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vpc: VPC | null;
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  routeTables: RouteTable[];
  nacls: NACL[];
  internetGateways: InternetGateway[];
  natGateways: NATGateway[];
}

export function VPCDetailsDialog({
  open, onOpenChange, vpc, subnets, securityGroups,
  routeTables, nacls, internetGateways, natGateways,
}: Props) {
  if (!vpc) return null;

  const vpcSubnets = subnets.filter(s => s.vpcId === vpc.id);
  const vpcSGs = securityGroups.filter(sg => sg.vpcId === vpc.id);
  const vpcRouteTables = routeTables.filter(rt => rt.vpcId === vpc.id);
  const vpcNACLs = nacls.filter(n => n.vpcId === vpc.id);
  const vpcIGWs = internetGateways.filter(igw => igw.attachments.some(a => a.vpcId === vpc.id));
  const vpcNATs = natGateways.filter(ng => ng.vpcId === vpc.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            VPC Details — {vpc.name || vpc.id}
          </DialogTitle>
        </DialogHeader>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">VPC ID:</span> <span className="font-mono">{vpc.id}</span></div>
          <div><span className="text-muted-foreground">CIDR:</span> <span className="font-mono">{vpc.cidrBlock}</span></div>
          <div><span className="text-muted-foreground">State:</span> <Badge variant={vpc.state === 'available' ? 'default' : 'secondary'}>{vpc.state}</Badge></div>
          <div><span className="text-muted-foreground">Default:</span> <Badge variant={vpc.isDefault ? 'default' : 'outline'}>{vpc.isDefault ? 'Yes' : 'No'}</Badge></div>
          <div><span className="text-muted-foreground">Region:</span> {vpc.region}</div>
        </div>

        {/* Resource summary cards */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { label: "Subnets", count: vpcSubnets.length, icon: Globe },
            { label: "Security Groups", count: vpcSGs.length, icon: Shield },
            { label: "Route Tables", count: vpcRouteTables.length, icon: Router },
          ].map(({ label, count, icon: Icon }) => (
            <Card key={label} className="py-2">
              <CardContent className="flex items-center gap-2 p-2 px-3">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{count}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="subnets" className="mt-2">
          <TabsList className="h-auto flex-wrap gap-1">
            <TabsTrigger value="subnets">Subnets ({vpcSubnets.length})</TabsTrigger>
            <TabsTrigger value="sgs">Security Groups ({vpcSGs.length})</TabsTrigger>
            <TabsTrigger value="routes">Route Tables ({vpcRouteTables.length})</TabsTrigger>
            <TabsTrigger value="gateways">Gateways</TabsTrigger>
          </TabsList>

          <TabsContent value="subnets">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subnet ID</TableHead>
                  <TableHead>CIDR</TableHead>
                  <TableHead>AZ</TableHead>
                  <TableHead>Available IPs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpcSubnets.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No subnets</TableCell></TableRow>
                ) : vpcSubnets.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.id}</TableCell>
                    <TableCell className="font-mono text-xs">{s.cidrBlock}</TableCell>
                    <TableCell>{s.availabilityZone}</TableCell>
                    <TableCell>{s.availableIps}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="sgs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SG ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Inbound Rules</TableHead>
                  <TableHead>Outbound Rules</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpcSGs.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No security groups</TableCell></TableRow>
                ) : vpcSGs.map(sg => (
                  <TableRow key={sg.id}>
                    <TableCell className="font-mono text-xs">{sg.id}</TableCell>
                    <TableCell>{sg.name}</TableCell>
                    <TableCell>{sg.inboundRules.length}</TableCell>
                    <TableCell>{sg.outboundRules.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="routes">
            {vpcRouteTables.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No route tables found</p>
            ) : vpcRouteTables.map(rt => (
              <Card key={rt.id} className="mb-3">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm font-mono flex items-center gap-2">
                    {rt.id}
                    {rt.associations.some(a => a.main) && <Badge variant="outline" className="text-xs">Main</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destination</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rt.routes.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.destinationCidr}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.gatewayId || r.natGatewayId || r.instanceId || r.vpcPeeringConnectionId || '—'}
                          </TableCell>
                          <TableCell><Badge variant={r.state === 'active' ? 'default' : 'secondary'}>{r.state}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="gateways">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium mb-1">Internet Gateways ({vpcIGWs.length})</h4>
                {vpcIGWs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None attached</p>
                ) : vpcIGWs.map(igw => (
                  <div key={igw.id} className="flex items-center gap-2 text-sm font-mono">
                    {igw.id} <Badge variant="default">{igw.attachments.find(a => a.vpcId === vpc.id)?.state}</Badge>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">NAT Gateways ({vpcNATs.length})</h4>
                {vpcNATs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None</p>
                ) : vpcNATs.map(ng => (
                  <div key={ng.id} className="flex items-center gap-2 text-sm font-mono">
                    {ng.id} <Badge variant={ng.state === 'available' ? 'default' : 'secondary'}>{ng.state}</Badge>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-1">NACLs ({vpcNACLs.length})</h4>
                {vpcNACLs.map(n => (
                  <div key={n.id} className="flex items-center gap-2 text-sm font-mono">
                    {n.id}
                    {n.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                    <span className="text-xs text-muted-foreground">{n.entries.length} rules</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
