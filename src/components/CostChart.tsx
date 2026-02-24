import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { useMemo } from "react";

export const CostChart = () => {
  const { data, loading } = useAWSDataContext();
  
  const hasRealCostData = (data?.costData?.totalCost ?? 0) > 0 || (data?.costData?.serviceBreakdown?.length ?? 0) > 0;
  
  const currentCost = useMemo(() => {
    if (data?.costData?.totalCost && data.costData.totalCost > 0) return data.costData.totalCost;
    if (data?.costData?.serviceBreakdown?.length) {
      return data.costData.serviceBreakdown.reduce((sum, s) => sum + s.amount, 0);
    }
    return 0;
  }, [data?.costData?.totalCost, data?.costData?.serviceBreakdown]);

  const costData = useMemo(() => {
    if (data?.costData?.historicalCosts && data.costData.historicalCosts.length > 0) {
      return data.costData.historicalCosts;
    }
    return [];
  }, [data?.costData?.historicalCosts]);
  
  const previousCost = costData.length > 1 ? costData[costData.length - 2].cost : 0;
  const changePercent = previousCost > 0 ? ((currentCost - previousCost) / previousCost * 100).toFixed(1) : '0.0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Costs
          </div>
          {currentCost > 0 && (
            <div className={`flex items-center gap-1 text-sm ${parseFloat(changePercent) >= 0 ? 'text-destructive' : 'text-success'}`}>
              <TrendingUp className={`h-4 w-4 ${parseFloat(changePercent) < 0 ? 'rotate-180' : ''}`} />
              <span>{parseFloat(changePercent) >= 0 ? '+' : ''}{changePercent}%</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {loading ? (
            <div className="space-y-2">
              <div className="w-24 h-8 bg-muted animate-pulse rounded" />
              <div className="w-32 h-4 bg-muted animate-pulse rounded" />
            </div>
          ) : hasRealCostData ? (
            <>
              <div className="text-3xl font-bold text-foreground">
                ${currentCost.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground">
                Current month from Cost Explorer
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-muted-foreground">—</div>
              <p className="text-sm text-muted-foreground">
                Enable Cost Explorer to view spending
              </p>
            </>
          )}
        </div>
        
        <div className="h-[200px]">
          {costData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="month" 
                  className="text-muted-foreground"
                  fontSize={12}
                />
                <YAxis 
                  className="text-muted-foreground"
                  fontSize={12}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  formatter={(value) => [`$${value}`, 'Cost']}
                />
                <Line 
                  type="monotone" 
                  dataKey="cost" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground">
              <div>
                <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No cost data available</p>
                <p className="text-xs mt-1">Enable Cost Explorer in Cost Management</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
