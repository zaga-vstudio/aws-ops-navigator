import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  status?: 'healthy' | 'warning' | 'critical';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const MetricCard = ({ 
  title, 
  value, 
  unit, 
  change, 
  changeType = 'neutral',
  status = 'healthy',
  icon,
  loading = false 
}: MetricCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case 'warning': return 'bg-warning text-warning-foreground';
      case 'critical': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-success text-success-foreground';
    }
  };

  const getTrendIcon = () => {
    switch (changeType) {
      case 'increase': return <TrendingUp className="h-4 w-4" />;
      case 'decrease': return <TrendingDown className="h-4 w-4" />;
      default: return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    switch (changeType) {
      case 'increase': return 'text-success';
      case 'decrease': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="transition-all duration-300 hover:shadow-lg border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {icon}
          <Badge className={`text-xs ${getStatusColor()}`}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            {loading ? (
              <div className="w-16 h-8 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold text-foreground">
                {value}
              </div>
            )}
            {unit && !loading && (
              <span className="text-sm text-muted-foreground">{unit}</span>
            )}
          </div>
          {change !== undefined && change !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};