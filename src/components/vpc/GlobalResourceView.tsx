import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Network, Globe, Zap } from "lucide-react";
import { CostBadge } from "./CostBadge";
import type { VPC } from "@/hooks/useAWSData";
import type { VPCQuotas, NATGateway } from "@/hooks/useVPCAdvancedData";

interface GlobalResourceViewProps {
  vpcs: VPC[];
  quotas: VPCQuotas | null;
  natGateways: NATGateway[];
  loading: boolean;
}

export function GlobalResourceView({ vpcs, quotas, natGateways, loading }: GlobalResourceViewProps) {
  const vpcLimit = 5; // Default AWS limit per region

  const items = [
    {
      label: 'VPCs',
      icon: Network,
      used: vpcs.length,
      limit: vpcLimit,
    },
    {
      label: 'Elastic IPs',
      icon: Globe,
      used: quotas?.eipsUsed ?? 0,
      limit: quotas?.eipsLimit ?? 5,
    },
    {
      label: 'NAT Gateways',
      icon: Zap,
      used: quotas?.natGatewaysUsed ?? natGateways.length,
      limit: quotas?.natGatewaysLimit ?? 5,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Resource Quotas
        </CardTitle>
        <CostBadge type="free" label="Free" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {items.map((item) => {
            const percentage = item.limit > 0 ? (item.used / item.limit) * 100 : 0;
            const isHigh = percentage >= 80;
            return (
              <div key={item.label} className="space-y-2">
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <Badge variant={isHigh ? 'destructive' : 'secondary'} className="text-xs">
                        {item.used} / {item.limit}
                      </Badge>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    {isHigh && (
                      <p className="text-xs text-destructive">Approaching limit — request quota increase</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
