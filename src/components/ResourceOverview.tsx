import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Database, Network, DollarSign } from "lucide-react";

interface Resource {
  id: string;
  name: string;
  type: 'EC2' | 'RDS' | 'VPC';
  status: 'running' | 'stopped' | 'pending';
  region: string;
  cost: number;
}

const mockResources: Resource[] = [
  { id: 'i-1234567890abcdef0', name: 'web-server-01', type: 'EC2', status: 'running', region: 'us-east-1', cost: 24.50 },
  { id: 'i-0987654321fedcba0', name: 'api-server-01', type: 'EC2', status: 'running', region: 'us-east-1', cost: 48.75 },
  { id: 'db-1234567890abcdef0', name: 'main-database', type: 'RDS', status: 'running', region: 'us-east-1', cost: 65.20 },
  { id: 'vpc-1234567890abcdef0', name: 'production-vpc', type: 'VPC', status: 'running', region: 'us-east-1', cost: 0.00 },
  { id: 'i-abcdef1234567890', name: 'staging-server', type: 'EC2', status: 'stopped', region: 'us-west-2', cost: 0.00 },
];

export const ResourceOverview = () => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-success text-success-foreground';
      case 'stopped': return 'bg-muted text-muted-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'EC2': return <Server className="h-4 w-4" />;
      case 'RDS': return <Database className="h-4 w-4" />;
      case 'VPC': return <Network className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EC2': return 'text-primary bg-primary/10';
      case 'RDS': return 'text-cloud-purple bg-cloud-purple/10';
      case 'VPC': return 'text-cloud-cyan bg-cloud-cyan/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Active Resources
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockResources.map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between p-4 border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${getTypeColor(resource.type)}`}>
                  {getTypeIcon(resource.type)}
                </div>
                <div>
                  <h4 className="font-medium text-foreground">{resource.name}</h4>
                  <p className="text-sm text-muted-foreground">{resource.id}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{resource.region}</p>
                  <div className="flex items-center gap-1 text-sm">
                    <DollarSign className="h-3 w-3" />
                    <span>${resource.cost.toFixed(2)}/month</span>
                  </div>
                </div>
                
                <Badge className={getStatusColor(resource.status)}>
                  {resource.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};