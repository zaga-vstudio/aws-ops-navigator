import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  Server, 
  Database, 
  Shield, 
  Network, 
  Link2,
  Globe,
  Loader2,
  XCircle
} from "lucide-react";
import type { VPC, Subnet, SecurityGroup, EC2Instance, RDSDatabase, VPCPeeringConnection } from "@/hooks/useAWSData";

interface VPCBlastRadiusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vpc: VPC | null;
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  vpcPeeringConnections: VPCPeeringConnection[];
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

interface AffectedResource {
  id: string;
  name: string;
  type: 'subnet' | 'security-group' | 'ec2' | 'rds' | 'peering';
  status?: string;
  details?: string;
}

export function VPCBlastRadiusDialog({
  open,
  onOpenChange,
  vpc,
  subnets,
  securityGroups,
  ec2Instances,
  rdsDatabases,
  vpcPeeringConnections,
  onConfirmDelete,
  isDeleting,
}: VPCBlastRadiusDialogProps) {
  if (!vpc) return null;

  // Calculate affected resources
  const affectedSubnets = subnets.filter(s => s.vpcId === vpc.id);
  const affectedSecurityGroups = securityGroups.filter(sg => sg.vpcId === vpc.id);
  
  // Find EC2 instances in this VPC's subnets
  const subnetIds = new Set(affectedSubnets.map(s => s.id));
  // For EC2, we check if they're in the subnets of this VPC (simplified - in real world we'd check subnet association)
  const affectedEC2 = ec2Instances.filter(instance => 
    affectedSubnets.some(subnet => 
      subnet.availabilityZone === instance.availabilityZone && 
      instance.region === vpc.region
    )
  );
  
  // Find RDS instances in this VPC
  const affectedRDS = rdsDatabases.filter(db => db.region === vpc.region);
  
  // Find peering connections involving this VPC
  const affectedPeering = vpcPeeringConnections.filter(
    p => p.requesterVpcId === vpc.id || p.accepterVpcId === vpc.id
  );

  const totalAffected = 
    affectedSubnets.length + 
    affectedSecurityGroups.length + 
    affectedEC2.length + 
    affectedRDS.length + 
    affectedPeering.length;

  const getSeverityLevel = () => {
    if (affectedEC2.filter(e => e.state === 'running').length > 0 || affectedRDS.filter(r => r.state === 'available').length > 0) {
      return 'critical';
    }
    if (totalAffected > 5) return 'warning';
    return 'info';
  };

  const severity = getSeverityLevel();

  const getSeverityColor = () => {
    switch (severity) {
      case 'critical': return 'bg-destructive/10 border-destructive text-destructive';
      case 'warning': return 'bg-warning/10 border-warning text-warning';
      default: return 'bg-muted border-muted-foreground/20 text-muted-foreground';
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'subnet': return <Globe className="h-4 w-4" />;
      case 'security-group': return <Shield className="h-4 w-4" />;
      case 'ec2': return <Server className="h-4 w-4" />;
      case 'rds': return <Database className="h-4 w-4" />;
      case 'peering': return <Link2 className="h-4 w-4" />;
      default: return <Network className="h-4 w-4" />;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Blast Radius Analysis
          </AlertDialogTitle>
          <AlertDialogDescription>
            Analyze the impact of deleting VPC <span className="font-mono font-medium">{vpc.name || vpc.id}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="flex-1 max-h-[50vh] pr-4">
          {/* Severity Banner */}
          <Card className={`mb-4 border ${getSeverityColor()}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {severity === 'critical' ? (
                  <XCircle className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
                <div>
                  <p className="font-semibold">
                    {severity === 'critical' && 'Critical Impact - Active Resources Will Be Terminated'}
                    {severity === 'warning' && 'Significant Impact - Multiple Resources Affected'}
                    {severity === 'info' && 'Low Impact - Minimal Resources Affected'}
                  </p>
                  <p className="text-sm opacity-80">
                    {totalAffected} resource{totalAffected !== 1 ? 's' : ''} will be affected by this deletion
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Dependency Map */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-3">Dependency Map</h4>
            <div className="relative bg-muted/30 rounded-lg p-4">
              {/* Center VPC Node */}
              <div className="flex flex-col items-center mb-6">
                <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg border-2 border-destructive">
                  <Network className="h-5 w-5" />
                  <span className="font-medium">{vpc.name || vpc.id}</span>
                </div>
                <div className="w-0.5 h-4 bg-border" />
              </div>

              {/* Connected Resources */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Subnets */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-3 py-2 flex flex-col items-center gap-1 w-full ${
                    affectedSubnets.length > 0 ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Globe className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-medium">Subnets</span>
                    <Badge variant={affectedSubnets.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {affectedSubnets.length}
                    </Badge>
                  </div>
                </div>

                {/* Security Groups */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-3 py-2 flex flex-col items-center gap-1 w-full ${
                    affectedSecurityGroups.length > 0 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-medium">Sec Groups</span>
                    <Badge variant={affectedSecurityGroups.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {affectedSecurityGroups.length}
                    </Badge>
                  </div>
                </div>

                {/* EC2 Instances */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-3 py-2 flex flex-col items-center gap-1 w-full ${
                    affectedEC2.length > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Server className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-medium">EC2</span>
                    <Badge variant={affectedEC2.filter(e => e.state === 'running').length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {affectedEC2.length}
                    </Badge>
                  </div>
                </div>

                {/* RDS Databases */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-3 py-2 flex flex-col items-center gap-1 w-full ${
                    affectedRDS.length > 0 ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Database className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-medium">RDS</span>
                    <Badge variant={affectedRDS.filter(r => r.state === 'available').length > 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {affectedRDS.length}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Peering Connections */}
              {affectedPeering.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs font-medium">Peering Connections</span>
                    <Badge variant="destructive" className="text-xs">
                      {affectedPeering.length}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Detailed Resource List */}
          <div className="space-y-4">
            {/* Subnets */}
            {affectedSubnets.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-orange-500" />
                  Subnets ({affectedSubnets.length})
                </h4>
                <div className="space-y-1">
                  {affectedSubnets.map(subnet => (
                    <div key={subnet.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{subnet.name || subnet.id}</span>
                      <span className="text-muted-foreground text-xs">{subnet.cidrBlock}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Security Groups */}
            {affectedSecurityGroups.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  Security Groups ({affectedSecurityGroups.length})
                </h4>
                <div className="space-y-1">
                  {affectedSecurityGroups.map(sg => (
                    <div key={sg.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{sg.name}</span>
                      <span className="text-muted-foreground text-xs">{sg.inboundRules + sg.outboundRules} rules</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EC2 Instances */}
            {affectedEC2.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4 text-green-500" />
                  EC2 Instances ({affectedEC2.length})
                  {affectedEC2.filter(e => e.state === 'running').length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {affectedEC2.filter(e => e.state === 'running').length} running
                    </Badge>
                  )}
                </h4>
                <div className="space-y-1">
                  {affectedEC2.map(instance => (
                    <div key={instance.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{instance.name || instance.id}</span>
                      <Badge variant={instance.state === 'running' ? 'default' : 'secondary'} className="text-xs">
                        {instance.state}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RDS Databases */}
            {affectedRDS.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-500" />
                  RDS Databases ({affectedRDS.length})
                  {affectedRDS.filter(r => r.state === 'available').length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {affectedRDS.filter(r => r.state === 'available').length} active
                    </Badge>
                  )}
                </h4>
                <div className="space-y-1">
                  {affectedRDS.map(db => (
                    <div key={db.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{db.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{db.engine}</span>
                        <Badge variant={db.state === 'available' ? 'default' : 'secondary'} className="text-xs">
                          {db.state}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Peering Connections */}
            {affectedPeering.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-yellow-500" />
                  VPC Peering Connections ({affectedPeering.length})
                </h4>
                <div className="space-y-1">
                  {affectedPeering.map(peering => (
                    <div key={peering.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <span className="font-mono text-xs">{peering.id}</span>
                      <Badge variant="secondary" className="text-xs">
                        {peering.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalAffected === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No dependent resources found</p>
                <p className="text-sm">This VPC can be safely deleted</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={isDeleting || vpc.isDefault}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Delete VPC
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
