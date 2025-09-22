import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Database, Network, DollarSign } from "lucide-react";
import { useAWSData, type EC2Instance, type RDSDatabase, type S3Bucket } from "@/hooks/useAWSData";

interface DisplayResource {
  id: string;
  name: string;
  type: 'EC2' | 'RDS' | 'S3';
  status: string;
  region: string;
  details: string;
}

export const ResourceOverview = () => {
  const { data, loading, error } = useAWSData();

  // Transform AWS data into display format
  const getDisplayResources = (): DisplayResource[] => {
    if (!data) return [];
    
    const resources: DisplayResource[] = [];
    
    // Add EC2 instances
    data.ec2Instances.forEach(instance => {
      resources.push({
        id: instance.id,
        name: instance.name,
        type: 'EC2',
        status: instance.state,
        region: instance.region,
        details: instance.type
      });
    });
    
    // Add RDS databases
    data.rdsDatabases.forEach(db => {
      resources.push({
        id: db.id,
        name: db.name,
        type: 'RDS',
        status: db.state,
        region: db.region,
        details: `${db.engine} ${db.engineVersion}`
      });
    });
    
    // Add S3 buckets
    data.s3Buckets.forEach(bucket => {
      resources.push({
        id: bucket.name,
        name: bucket.name,
        type: 'S3',
        status: 'active',
        region: bucket.region,
        details: 'S3 Bucket'
      });
    });
    
    return resources;
  };
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
      case 'S3': return <Network className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'EC2': return 'text-primary bg-primary/10';
      case 'RDS': return 'text-cloud-purple bg-cloud-purple/10';
      case 'S3': return 'text-cloud-cyan bg-cloud-cyan/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const resources = getDisplayResources();

  if (loading) {
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted animate-pulse rounded-md" />
                  <div className="space-y-2">
                    <div className="w-32 h-4 bg-muted animate-pulse rounded" />
                    <div className="w-48 h-3 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <div className="w-20 h-3 bg-muted animate-pulse rounded" />
                    <div className="w-16 h-3 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="w-16 h-6 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Active Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Failed to load AWS resources</p>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
          {resources.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No AWS resources found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Configure your AWS credentials in Settings to see your resources
              </p>
            </div>
          ) : (
            resources.map((resource) => (
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
                    <p className="text-xs text-muted-foreground">{resource.details}</p>
                  </div>
                  
                  <Badge className={getStatusColor(resource.status)}>
                    {resource.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};