import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Database, Bell, Shield } from "lucide-react";

interface MonitoringResourceCardsProps {
  runningEC2: number;
  totalEC2: number;
  availableRDS: number;
  totalRDS: number;
  alarmsInAlarm: number;
  totalAlarms: number;
  securityGroupsCount: number;
  loading: boolean;
}

export function MonitoringResourceCards({
  runningEC2, totalEC2, availableRDS, totalRDS,
  alarmsInAlarm, totalAlarms, securityGroupsCount, loading,
}: MonitoringResourceCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">EC2 Instances</CardTitle>
          <Server className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <>
              <div className="text-2xl font-bold">{runningEC2}/{totalEC2}</div>
              <p className="text-xs text-muted-foreground">{runningEC2} running, {totalEC2 - runningEC2} stopped</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">RDS Databases</CardTitle>
          <Database className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <>
              <div className="text-2xl font-bold">{availableRDS}/{totalRDS}</div>
              <p className="text-xs text-muted-foreground">{availableRDS} available</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CloudWatch Alarms</CardTitle>
          <Bell className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <>
              <div className="text-2xl font-bold flex items-center gap-2">
                {totalAlarms}
                {alarmsInAlarm > 0 && (
                  <Badge variant="destructive" className="text-xs">{alarmsInAlarm} active</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {alarmsInAlarm === 0 ? "All clear" : `${alarmsInAlarm} in alarm state`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Security Groups</CardTitle>
          <Shield className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-8 w-20" /> : (
            <>
              <div className="text-2xl font-bold">{securityGroupsCount}</div>
              <p className="text-xs text-muted-foreground">Active security groups</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
