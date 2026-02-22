import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Router } from "lucide-react";
import { VPC, Subnet } from "@/hooks/useAWSData";
import { RouteTable } from "@/hooks/useVPCAdvancedData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vpc: VPC | null;
  routeTables: RouteTable[];
  subnets: Subnet[];
}

export function ManageRouteTablesDialog({ open, onOpenChange, vpc, routeTables, subnets }: Props) {
  if (!vpc) return null;

  const vpcRouteTables = routeTables.filter(rt => rt.vpcId === vpc.id);

  const getSubnetName = (subnetId: string | null) => {
    if (!subnetId) return "—";
    const subnet = subnets.find(s => s.id === subnetId);
    return subnet ? `${subnet.name || subnet.id} (${subnet.cidrBlock})` : subnetId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Router className="h-5 w-5 text-primary" />
            Route Tables — {vpc.name || vpc.id}
          </DialogTitle>
        </DialogHeader>

        {vpcRouteTables.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No route tables found for this VPC.</p>
        ) : (
          <div className="space-y-4">
            {vpcRouteTables.map(rt => (
              <Card key={rt.id}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="font-mono">{rt.id}</span>
                    {rt.name !== rt.id && <span className="text-muted-foreground">({rt.name})</span>}
                    {rt.associations.some(a => a.main) && <Badge variant="outline" className="text-xs">Main</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  {/* Routes */}
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Routes</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Destination</TableHead>
                          <TableHead className="text-xs">Target</TableHead>
                          <TableHead className="text-xs">State</TableHead>
                          <TableHead className="text-xs">Origin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rt.routes.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{r.destinationCidr}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.gatewayId || r.natGatewayId || r.instanceId || r.vpcPeeringConnectionId || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={r.state === 'active' ? 'default' : 'secondary'} className="text-xs">{r.state}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.origin}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Associations */}
                  {rt.associations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-1">Subnet Associations</h4>
                      <div className="flex flex-wrap gap-2">
                        {rt.associations.map(a => (
                          <Badge key={a.id} variant="outline" className="font-mono text-xs">
                            {a.main ? "Main (implicit)" : getSubnetName(a.subnetId)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
