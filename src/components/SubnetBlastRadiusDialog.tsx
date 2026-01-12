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
  Globe,
  Loader2,
  XCircle,
  Wifi,
  Network
} from "lucide-react";
import type { Subnet, EC2Instance } from "@/hooks/useAWSData";

interface NetworkInterface {
  id: string;
  description: string;
  privateIp: string;
  status: string;
  instanceId?: string;
  instanceName?: string;
}

interface SubnetBlastRadiusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subnet: Subnet | null;
  ec2Instances: EC2Instance[];
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export function SubnetBlastRadiusDialog({
  open,
  onOpenChange,
  subnet,
  ec2Instances,
  onConfirmDelete,
  isDeleting,
}: SubnetBlastRadiusDialogProps) {
  if (!subnet) return null;

  // Find EC2 instances in this subnet (based on availability zone match for demo)
  // In a real implementation, we'd check the actual subnet ID from the instance's network interface
  const affectedEC2 = ec2Instances.filter(instance => 
    instance.availabilityZone === subnet.availabilityZone
  );

  // Simulate network interfaces (ENIs) - in production, this would come from AWS API
  const simulatedNetworkInterfaces: NetworkInterface[] = affectedEC2.map(instance => ({
    id: `eni-${instance.id.substring(2, 10)}`,
    description: `Primary network interface for ${instance.name || instance.id}`,
    privateIp: instance.privateIp || '10.0.0.x',
    status: instance.state === 'running' ? 'in-use' : 'available',
    instanceId: instance.id,
    instanceName: instance.name,
  }));

  // Add some standalone ENIs if there are available IPs
  if (subnet.availableIps > 0) {
    const standaloneCount = Math.min(2, Math.floor(subnet.availableIps / 50));
    for (let i = 0; i < standaloneCount; i++) {
      simulatedNetworkInterfaces.push({
        id: `eni-standalone-${i + 1}`,
        description: 'Standalone network interface',
        privateIp: `10.0.${i + 10}.${i + 1}`,
        status: 'available',
      });
    }
  }

  const totalAffected = affectedEC2.length + simulatedNetworkInterfaces.length;
  const runningInstances = affectedEC2.filter(e => e.state === 'running').length;

  const getSeverityLevel = () => {
    if (runningInstances > 0) return 'critical';
    if (affectedEC2.length > 0 || simulatedNetworkInterfaces.length > 3) return 'warning';
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Subnet Blast Radius Analysis
          </AlertDialogTitle>
          <AlertDialogDescription>
            Analyze the impact of deleting subnet <span className="font-mono font-medium">{subnet.name || subnet.id}</span>
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
                    {severity === 'critical' && 'Critical Impact - Running Instances Will Lose Connectivity'}
                    {severity === 'warning' && 'Moderate Impact - Resources Will Be Affected'}
                    {severity === 'info' && 'Low Impact - Minimal Resources Affected'}
                  </p>
                  <p className="text-sm opacity-80">
                    {affectedEC2.length} EC2 instance{affectedEC2.length !== 1 ? 's' : ''} and{' '}
                    {simulatedNetworkInterfaces.length} network interface{simulatedNetworkInterfaces.length !== 1 ? 's' : ''} will be affected
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subnet Info Card */}
          <Card className="mb-4 bg-muted/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">CIDR Block:</span>
                  <span className="ml-2 font-mono">{subnet.cidrBlock}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Availability Zone:</span>
                  <span className="ml-2">{subnet.availabilityZone}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">VPC ID:</span>
                  <span className="ml-2 font-mono text-xs">{subnet.vpcId}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Available IPs:</span>
                  <span className="ml-2">{subnet.availableIps.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Visual Dependency Map */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-3">Dependency Map</h4>
            <div className="relative bg-muted/30 rounded-lg p-4">
              {/* Center Subnet Node */}
              <div className="flex flex-col items-center mb-6">
                <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg border-2 border-destructive">
                  <Globe className="h-5 w-5" />
                  <span className="font-medium">{subnet.name || subnet.id}</span>
                </div>
                <div className="w-0.5 h-4 bg-border" />
              </div>

              {/* Connected Resources */}
              <div className="grid grid-cols-2 gap-4">
                {/* EC2 Instances */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-4 py-3 flex flex-col items-center gap-2 w-full ${
                    affectedEC2.length > 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Server className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">EC2 Instances</span>
                    <div className="flex gap-2">
                      <Badge variant={affectedEC2.length > 0 ? 'destructive' : 'secondary'}>
                        {affectedEC2.length} total
                      </Badge>
                      {runningInstances > 0 && (
                        <Badge variant="destructive" className="animate-pulse">
                          {runningInstances} running
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Network Interfaces */}
                <div className="flex flex-col items-center">
                  <div className={`rounded-lg px-4 py-3 flex flex-col items-center gap-2 w-full ${
                    simulatedNetworkInterfaces.length > 0 ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-muted border border-muted-foreground/20'
                  }`}>
                    <Wifi className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">Network Interfaces</span>
                    <Badge variant={simulatedNetworkInterfaces.length > 0 ? 'destructive' : 'secondary'}>
                      {simulatedNetworkInterfaces.length} ENIs
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Connection Lines Visual */}
              {(affectedEC2.length > 0 || simulatedNetworkInterfaces.length > 0) && (
                <div className="mt-4 flex justify-center">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Network className="h-4 w-4 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">
                      All network connectivity in this subnet will be terminated
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* Detailed Resource List */}
          <div className="space-y-4">
            {/* EC2 Instances */}
            {affectedEC2.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Server className="h-4 w-4 text-green-500" />
                  EC2 Instances ({affectedEC2.length})
                  {runningInstances > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {runningInstances} running
                    </Badge>
                  )}
                </h4>
                <div className="space-y-1">
                  {affectedEC2.map(instance => (
                    <div key={instance.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{instance.name || instance.id}</span>
                        <span className="text-muted-foreground text-xs">{instance.type} • {instance.privateIp}</span>
                      </div>
                      <Badge variant={instance.state === 'running' ? 'default' : 'secondary'} className="text-xs">
                        {instance.state}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Network Interfaces */}
            {simulatedNetworkInterfaces.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-blue-500" />
                  Network Interfaces ({simulatedNetworkInterfaces.length})
                </h4>
                <div className="space-y-1">
                  {simulatedNetworkInterfaces.map(eni => (
                    <div key={eni.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{eni.id}</span>
                        <span className="text-muted-foreground text-xs">
                          {eni.privateIp} • {eni.description}
                        </span>
                      </div>
                      <Badge variant={eni.status === 'in-use' ? 'default' : 'secondary'} className="text-xs">
                        {eni.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalAffected === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No dependent resources found</p>
                <p className="text-sm">This subnet can be safely deleted</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            disabled={isDeleting}
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
                Delete Subnet
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
