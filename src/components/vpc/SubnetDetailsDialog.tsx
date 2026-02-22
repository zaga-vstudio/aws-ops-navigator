import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Server, Router, Shield } from "lucide-react";
import { Subnet, SecurityGroup } from "@/hooks/useAWSData";
import { RouteTable, NACL, InternetGateway } from "@/hooks/useVPCAdvancedData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subnet: Subnet | null;
  securityGroups: SecurityGroup[];
  routeTables: RouteTable[];
  nacls: NACL[];
  internetGateways: InternetGateway[];
}

export function SubnetDetailsDialog({
  open, onOpenChange, subnet, securityGroups, routeTables, nacls, internetGateways,
}: Props) {
  if (!subnet) return null;

  // Find the route table for this subnet (explicit association or main/default)
  const associatedRT = routeTables.find(rt =>
    rt.associations.some(a => a.subnetId === subnet.id)
  ) || routeTables.find(rt =>
    rt.vpcId === subnet.vpcId && rt.associations.some(a => a.main)
  );

  // Find NACLs associated with this subnet
  const associatedNACL = nacls.find(n =>
    n.associations.some(a => a.subnetId === subnet.id)
  ) || nacls.find(n => n.vpcId === subnet.vpcId && n.isDefault);

  // Determine public/private
  const igwIds = internetGateways
    .filter(igw => igw.attachments.some(a => a.vpcId === subnet.vpcId))
    .map(igw => igw.id);
  const isPublic = associatedRT?.routes.some(r =>
    r.gatewayId && igwIds.includes(r.gatewayId) && r.destinationCidr === '0.0.0.0/0'
  ) || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Subnet Details — {subnet.name || subnet.id}
          </DialogTitle>
        </DialogHeader>

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Subnet ID:</span> <span className="font-mono">{subnet.id}</span></div>
          <div><span className="text-muted-foreground">VPC ID:</span> <span className="font-mono">{subnet.vpcId}</span></div>
          <div><span className="text-muted-foreground">CIDR:</span> <span className="font-mono">{subnet.cidrBlock}</span></div>
          <div><span className="text-muted-foreground">AZ:</span> {subnet.availabilityZone}</div>
          <div><span className="text-muted-foreground">Available IPs:</span> {subnet.availableIps.toLocaleString()}</div>
          <div><span className="text-muted-foreground">Type:</span> <Badge variant={isPublic ? 'default' : 'secondary'}>{isPublic ? 'Public' : 'Private'}</Badge></div>
        </div>

        {/* Route Table */}
        <Card className="mt-2">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Router className="h-4 w-4 text-muted-foreground" />
              Route Table: <span className="font-mono">{associatedRT?.id || '—'}</span>
              {associatedRT?.associations.some(a => a.main) && <Badge variant="outline" className="text-xs">Main</Badge>}
            </div>
            {associatedRT && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Destination</TableHead>
                    <TableHead className="text-xs">Target</TableHead>
                    <TableHead className="text-xs">State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {associatedRT.routes.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.destinationCidr}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.gatewayId || r.natGatewayId || r.instanceId || r.vpcPeeringConnectionId || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.state === 'active' ? 'default' : 'secondary'} className="text-xs">{r.state}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* NACL */}
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Network ACL: <span className="font-mono">{associatedNACL?.id || '—'}</span>
              {associatedNACL?.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
            </div>
            {associatedNACL && (
              <div className="text-xs text-muted-foreground">
                {associatedNACL.entries.filter(e => !e.egress).length} inbound rules · {associatedNACL.entries.filter(e => e.egress).length} outbound rules
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
