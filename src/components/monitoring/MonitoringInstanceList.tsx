import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Database, CheckCircle, AlertCircle } from "lucide-react";
import { EC2Instance, RDSDatabase, CloudWatchAlarm } from "@/hooks/useAWSData";
import { CostBadge } from "@/components/CostBadge";

interface MonitoringInstanceListProps {
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  cloudWatchAlarms: CloudWatchAlarm[];
  loading: boolean;
}

const getStatusIcon = (status: string) => {
  const s = status?.toLowerCase();
  if (['running', 'available', 'healthy', 'ok'].includes(s)) return <CheckCircle className="h-4 w-4 text-success" />;
  if (['pending', 'starting', 'stopping', 'insufficient_data'].includes(s)) return <AlertCircle className="h-4 w-4 text-warning" />;
  if (['stopped', 'terminated', 'alarm', 'critical'].includes(s)) return <AlertCircle className="h-4 w-4 text-destructive" />;
  return <div className="h-4 w-4 rounded-full bg-muted" />;
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  const s = status?.toLowerCase();
  if (['running', 'available', 'healthy', 'ok'].includes(s)) return "default";
  if (['pending', 'starting', 'stopping', 'insufficient_data'].includes(s)) return "secondary";
  if (['stopped', 'terminated', 'alarm', 'critical'].includes(s)) return "destructive";
  return "outline";
};

export function MonitoringInstanceList({ ec2Instances, rdsDatabases, cloudWatchAlarms, loading }: MonitoringInstanceListProps) {
  return (
    <div className="space-y-6">
      {/* EC2 Instances */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>EC2 Instance Status</CardTitle>
              <CardDescription>Real-time status for your EC2 instances</CardDescription>
            </div>
            <CostBadge type="free" label="Free" costNote="DescribeInstances API: included in EC2 free tier." />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : ec2Instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No EC2 instances found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ec2Instances.map(instance => (
                <div key={instance.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(instance.state)}
                    <div>
                      <p className="font-medium">{instance.name || 'Unnamed Instance'}</p>
                      <p className="text-sm text-muted-foreground">{instance.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center"><p className="text-sm text-muted-foreground">Type</p><p className="font-medium text-sm">{instance.type}</p></div>
                    <div className="text-center"><p className="text-sm text-muted-foreground">Region</p><p className="font-medium text-sm">{instance.region || 'N/A'}</p></div>
                    <div className="text-center"><p className="text-sm text-muted-foreground">IP</p><p className="font-medium text-sm">{instance.publicIp || instance.privateIp || 'N/A'}</p></div>
                    <Badge variant={getStatusBadgeVariant(instance.state)}>{instance.state}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RDS Databases */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>RDS Database Status</CardTitle>
              <CardDescription>Real-time status for your RDS instances</CardDescription>
            </div>
            <CostBadge type="free" label="Free" costNote="DescribeDBInstances API: included in RDS free tier." />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">{[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : rdsDatabases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No RDS databases found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rdsDatabases.map(db => (
                <div key={db.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(db.state)}
                    <div>
                      <p className="font-medium">{db.name}</p>
                      <p className="text-sm text-muted-foreground">{db.engine} {db.engineVersion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center"><p className="text-sm text-muted-foreground">Class</p><p className="font-medium text-sm">{db.instanceClass}</p></div>
                    <div className="text-center"><p className="text-sm text-muted-foreground">Storage</p><p className="font-medium text-sm">{db.allocatedStorage} GB</p></div>
                    <div className="text-center"><p className="text-sm text-muted-foreground">Region</p><p className="font-medium text-sm">{db.region}</p></div>
                    <Badge variant={getStatusBadgeVariant(db.state)}>{db.state}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CloudWatch Alarms */}
      {cloudWatchAlarms.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CloudWatch Alarms</CardTitle>
                <CardDescription>Active monitoring alarms</CardDescription>
              </div>
              <CostBadge type="free" label="Free (10 alarms)" costNote="First 10 alarm metrics are free. Additional alarms: $0.10/alarm/month for standard, $0.30 for high-resolution." />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cloudWatchAlarms.map(alarm => (
                <div key={alarm.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {getStatusIcon(alarm.state === 'ALARM' ? 'alarm' : alarm.state === 'OK' ? 'ok' : 'warning')}
                    <div>
                      <p className="font-medium">{alarm.name}</p>
                      <p className="text-sm text-muted-foreground">{alarm.metric}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center"><p className="text-sm text-muted-foreground">Threshold</p><p className="font-medium text-sm">{alarm.threshold}</p></div>
                    <Badge variant={alarm.state === 'ALARM' ? 'destructive' : alarm.state === 'OK' ? 'default' : 'secondary'}>{alarm.state}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
