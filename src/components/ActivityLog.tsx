import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Database, Shield, DollarSign, Network } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  user: string;
  type: 'create' | 'modify' | 'delete' | 'security' | 'cost' | 'network';
  status?: 'success' | 'warning' | 'error';
}

interface AWSData {
  ec2Instances?: any[];
  rdsDatabases?: any[];
  vpcs?: any[];
  securityGroups?: any[];
  cloudWatchAlarms?: any[];
}

interface ActivityLogProps {
  awsData?: AWSData;
}

const generateActivityLogs = (awsData?: AWSData): LogEntry[] => {
  const logs: LogEntry[] = [];
  
  if (!awsData) return logs;

  // Generate logs from EC2 instances
  awsData.ec2Instances?.forEach((instance, idx) => {
    logs.push({
      id: `ec2-${idx}`,
      timestamp: instance.launchTime || new Date().toISOString(),
      action: `EC2 Instance ${instance.state}`,
      resource: instance.name || instance.instanceId,
      user: 'AWS',
      type: instance.state === 'running' ? 'modify' : 'create',
      status: instance.state === 'running' ? 'success' : undefined
    });
  });

  // Generate logs from RDS databases
  awsData.rdsDatabases?.forEach((db, idx) => {
    logs.push({
      id: `rds-${idx}`,
      timestamp: db.instanceCreateTime || new Date().toISOString(),
      action: `RDS Database ${db.status}`,
      resource: db.dbInstanceIdentifier,
      user: 'AWS',
      type: 'create',
      status: db.status === 'available' ? 'success' : undefined
    });
  });

  // Generate logs from VPCs
  awsData.vpcs?.forEach((vpc, idx) => {
    logs.push({
      id: `vpc-${idx}`,
      timestamp: new Date().toISOString(),
      action: 'VPC Network configured',
      resource: vpc.vpcId,
      user: 'AWS',
      type: 'network',
      status: 'success'
    });
  });

  // Generate logs from Security Groups
  awsData.securityGroups?.forEach((sg, idx) => {
    logs.push({
      id: `sg-${idx}`,
      timestamp: new Date().toISOString(),
      action: 'Security Group updated',
      resource: sg.groupName || sg.groupId,
      user: 'AWS',
      type: 'security',
      status: 'success'
    });
  });

  // Generate logs from CloudWatch Alarms
  awsData.cloudWatchAlarms?.forEach((alarm, idx) => {
    logs.push({
      id: `alarm-${idx}`,
      timestamp: alarm.stateUpdatedTimestamp || new Date().toISOString(),
      action: `CloudWatch Alarm ${alarm.stateValue}`,
      resource: alarm.alarmName,
      user: 'system',
      type: alarm.stateValue === 'ALARM' ? 'cost' : 'modify',
      status: alarm.stateValue === 'ALARM' ? 'warning' : 'success'
    });
  });

  // Sort by timestamp descending and take top 5
  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
};

export const ActivityLog = ({ awsData }: ActivityLogProps) => {
  const logs = generateActivityLogs(awsData);
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'create':
      case 'modify':
        return <Server className="h-4 w-4" />;
      case 'delete':
        return <Database className="h-4 w-4" />;
      case 'security':
        return <Shield className="h-4 w-4" />;
      case 'cost':
        return <DollarSign className="h-4 w-4" />;
      case 'network':
        return <Network className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-success text-success-foreground';
      case 'warning':
        return 'bg-warning text-warning-foreground';
      case 'error':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'create':
        return 'text-success bg-success/10';
      case 'modify':
        return 'text-primary bg-primary/10';
      case 'delete':
        return 'text-destructive bg-destructive/10';
      case 'security':
        return 'text-warning bg-warning/10';
      case 'cost':
        return 'text-cloud-purple bg-cloud-purple/10';
      case 'network':
        return 'text-cloud-cyan bg-cloud-cyan/10';
      default:
        return 'text-muted-foreground bg-muted/10';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity to display
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-3 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className={`p-2 rounded-md ${getTypeColor(log.type)}`}>
                  {getTypeIcon(log.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground truncate">
                      {log.action}
                    </h4>
                    {log.status && (
                      <Badge className={`ml-2 ${getStatusColor(log.status)}`}>
                        {log.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {log.resource} • by {log.user}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.timestamp), 'PPp')}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};