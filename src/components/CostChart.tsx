import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAWSData } from "@/hooks/useAWSData";

const mockCostData = [
  { month: 'Jan', cost: 120 },
  { month: 'Feb', cost: 135 },
  { month: 'Mar', cost: 148 },
  { month: 'Apr', cost: 162 },
  { month: 'May', cost: 155 },
  { month: 'Jun', cost: 178 },
];

export const CostChart = () => {
  const { data, loading } = useAWSData();
  
  const currentCost = data?.metrics.estimatedCost || mockCostData[mockCostData.length - 1].cost;
  const previousCost = mockCostData[mockCostData.length - 2].cost;
  const changePercent = ((currentCost - previousCost) / previousCost * 100).toFixed(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Costs
          </div>
          <div className="flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+{changePercent}%</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {loading ? (
            <div className="space-y-2">
              <div className="w-24 h-8 bg-muted animate-pulse rounded" />
              <div className="w-32 h-4 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold text-foreground">
                ${currentCost}
              </div>
              <p className="text-sm text-muted-foreground">
                Current month estimate
              </p>
            </>
          )}
        </div>
        
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockCostData}>
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
        </div>
      </CardContent>
    </Card>
  );
};