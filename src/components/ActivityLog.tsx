import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Server, Database, Shield, DollarSign } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  user: string;
  type: 'create' | 'modify' | 'delete' | 'security' | 'cost';
  status: 'success' | 'warning' | 'error';
}

const mockLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-01-15 14:32:00',
    action: 'Created EC2 instance',
    resource: 'web-server-01',
    user: 'john.doe@company.com',
    type: 'create',
    status: 'success'
  },
  {
    id: '2',
    timestamp: '2024-01-15 13:45:00',
    action: 'Updated security group',
    resource: 'sg-web-servers',
    user: 'jane.smith@company.com',
    type: 'security',
    status: 'success'
  },
  {
    id: '3',
    timestamp: '2024-01-15 12:20:00',
    action: 'Cost alert triggered',
    resource: 'Monthly budget',
    user: 'system',
    type: 'cost',
    status: 'warning'
  },
  {
    id: '4',
    timestamp: '2024-01-15 11:15:00',
    action: 'Stopped EC2 instance',
    resource: 'staging-server',
    user: 'bob.wilson@company.com',
    type: 'modify',
    status: 'success'
  },
  {
    id: '5',
    timestamp: '2024-01-15 10:30:00',
    action: 'Database backup completed',
    resource: 'main-database',
    user: 'system',
    type: 'modify',
    status: 'success'
  }
];

export const ActivityLog = () => {
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
          {mockLogs.map((log) => (
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
                  <Badge className={`ml-2 ${getStatusColor(log.status)}`}>
                    {log.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {log.resource} • by {log.user}
                </p>
                <p className="text-xs text-muted-foreground">
                  {log.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};