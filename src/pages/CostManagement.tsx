import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  PieChart,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Power,
  Loader2,
  Info,
  Clock,
  History
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RightsizingRecommendations } from "@/components/RightsizingRecommendations";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Pie, Cell, Line, ComposedChart } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";


const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

// Get available time periods from historical data
const getAvailableTimePeriods = (historicalCosts?: { month: string; cost: number }[]) => {
  if (!historicalCosts || historicalCosts.length === 0) return [];
  return historicalCosts.map(h => h.month);
};

// Filter historical data based on selected range
const filterHistoricalByRange = (historicalCosts: { month: string; cost: number }[], range: string) => {
  if (!historicalCosts || historicalCosts.length === 0) return [];
  
  const monthsToShow = range === "1month" ? 1 
    : range === "3months" ? 3 
    : range === "6months" ? 6 
    : 12;
  
  // Return the last N months of data
  return historicalCosts.slice(-monthsToShow);
};

export default function CostManagement() {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("6months");
  const { data: awsData, loading, refetch, refetchWithForceRefreshCost, costExplorerState, enableCostExplorer, disableCostExplorer } = useAWSDataContext();

  const isCostExplorerDisabled = awsData?.costData?.costExplorerDisabled === true;
  const isHistoricalData = awsData?.costData?.isHistoricalData === true;
  const noCachedDataExists = awsData?.costData?.noCachedDataExists === true;
  

  // Only use real cost data — no estimations
  const currentCost = useMemo(() => {
    if (awsData?.costData?.totalCost && awsData.costData.totalCost > 0) {
      return awsData.costData.totalCost;
    }
    if (awsData?.costData?.serviceBreakdown && awsData.costData.serviceBreakdown.length > 0) {
      return awsData.costData.serviceBreakdown.reduce((sum, s) => sum + s.amount, 0);
    }
    return 0;
  }, [awsData?.costData?.totalCost, awsData?.costData?.serviceBreakdown]);
  
  const hasRealCostData = currentCost > 0;
  
  // Use real historical data if available, filtered by time range
  const monthlySpendData = useMemo(() => {
    const historical = awsData?.costData?.historicalCosts && awsData.costData.historicalCosts.length > 0
      ? filterHistoricalByRange(awsData.costData.historicalCosts, timeRange)
      : [];

    // Append forecast point if available
    if (awsData?.costData?.forecastTotal && awsData.costData.forecastTotal > 0 && awsData?.costData?.forecastPeriodStart) {
      const forecastDate = new Date(awsData.costData.forecastPeriodStart);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const forecastMonth = monthNames[forecastDate.getMonth()];
      
      // Add bridge point (last actual cost) and forecast point
      const lastActual = historical.length > 0 ? historical[historical.length - 1].cost : 0;
      return [
        ...historical.map(h => ({ ...h, forecast: undefined as number | undefined })),
        { month: forecastMonth, cost: undefined as number | undefined, forecast: awsData.costData.forecastTotal, bridgeCost: lastActual },
      ];
    }
    
    return historical.map(h => ({ ...h, forecast: undefined as number | undefined }));
  }, [awsData?.costData?.historicalCosts, awsData?.costData?.forecastTotal, awsData?.costData?.forecastPeriodStart, timeRange]);

  // Check if we have historical data to show time range options
  const hasHistoricalData = (awsData?.costData?.historicalCosts?.length ?? 0) > 0;
  const maxMonthsAvailable = awsData?.costData?.historicalCosts?.length ?? 0;

  // Transform real cost data - filter out services with zero or negligible cost
  const serviceBreakdown = useMemo(() => {
    const breakdown = awsData?.costData?.serviceBreakdown?.map(s => ({
      name: s.service,
      value: s.percentage,
      cost: s.amount
    })) || [];
    
    // Filter out services with essentially zero cost (less than $0.01)
    return breakdown.filter(s => s.cost >= 0.01);
  }, [awsData?.costData?.serviceBreakdown]);

  const topResources = useMemo(() => {
    return awsData?.costData?.topResources?.map(r => ({
      resource: r.resourceId,
      type: r.resourceType,
      cost: `$${r.cost.toFixed(2)}`,
      trend: r.trend
    })) || [];
  }, [awsData?.costData?.topResources]);

  const costAlerts = useMemo(() => {
    return awsData?.costData?.anomalies || [];
  }, [awsData?.costData?.anomalies]);

  // Cache info with human-readable formatting
  const costCacheInfo = useMemo(() => {
    if (awsData?.costData?.cachedAt) {
      const cachedAt = new Date(awsData.costData.cachedAt);
      const now = new Date();
      const hoursSinceUpdate = Math.floor((now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60));
      const daysSinceUpdate = Math.floor(hoursSinceUpdate / 24);
      
      let formattedAge: string;
      if (daysSinceUpdate > 0) {
        formattedAge = `${daysSinceUpdate} day${daysSinceUpdate > 1 ? 's' : ''} ago`;
      } else if (hoursSinceUpdate > 0) {
        formattedAge = `${hoursSinceUpdate} hour${hoursSinceUpdate > 1 ? 's' : ''} ago`;
      } else {
        formattedAge = 'Just now';
      }
      
      return {
        cachedAt,
        fromCache: awsData.costData.fromCache ?? false,
        formattedTime: cachedAt.toLocaleString(),
        formattedAge,
        isHistorical: isHistoricalData,
      };
    }
    return null;
  }, [awsData?.costData?.cachedAt, awsData?.costData?.fromCache, isHistoricalData]);

  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleForceRefreshCost = () => {
    setRefreshing(true);
    refetchWithForceRefreshCost();
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleEnableCostExplorer = async () => {
    const success = await enableCostExplorer();
    if (success) {
      refetchWithForceRefreshCost();
    }
  };

  const handleDisableCostExplorer = async () => {
    await disableCostExplorer();
    refetch();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border/50 bg-card px-6 flex items-center">
            <SidebarTrigger className="mr-4" />
            <Header />
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-foreground">Cost Management</h1>
                    <NotificationBadge source="cost" className="text-base px-2 py-1" />
                  </div>
                  <p className="text-muted-foreground">Monitor and optimize your AWS spending</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={timeRange} onValueChange={setTimeRange} disabled={!hasHistoricalData}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1month" disabled={maxMonthsAvailable < 1}>
                        1 Month
                      </SelectItem>
                      <SelectItem value="3months" disabled={maxMonthsAvailable < 3}>
                        3 Months
                      </SelectItem>
                      <SelectItem value="6months" disabled={maxMonthsAvailable < 6}>
                        6 Months
                      </SelectItem>
                      <SelectItem value="1year" disabled={maxMonthsAvailable < 12}>
                        1 Year
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {/* Show cache info / Last Updated */}
                  {costCacheInfo && hasRealCostData && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Last updated: {costCacheInfo.formattedAge}</span>
                      {costCacheInfo.isHistorical && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <History className="h-3 w-3" />
                          Historical Data
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  {/* Refresh Data Button - only show when Cost Explorer is disabled but has historical data */}
                  {isCostExplorerDisabled && hasRealCostData && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleEnableCostExplorer}
                      disabled={costExplorerState.loading}
                      title="This will enable Cost Explorer and make a new API call (~$0.01)"
                    >
                      {costExplorerState.loading ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3 mr-1" />
                      )}
                      Refresh Data
                    </Button>
                  )}
                  
                  {/* Force Refresh for when Cost Explorer is enabled */}
                  {!isCostExplorerDisabled && costCacheInfo && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleForceRefreshCost}
                      disabled={refreshing}
                      title="Force refresh cost data from AWS (bypasses cache)"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                      Force Refresh
                    </Button>
                  )}
                  
                  <Button onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Historical Data Notice - when disabled but has cached data */}
              {isCostExplorerDisabled && hasRealCostData && costCacheInfo && (
                <Alert className="border-primary/30 bg-primary/5">
                  <History className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Viewing historical data</span> from {costCacheInfo.formattedTime}. 
                    Cost Explorer is currently disabled. Click "Refresh Data" above to fetch fresh data 
                    <span className="text-muted-foreground"> (incurs ~$0.01 AWS API charge)</span>.
                  </AlertDescription>
                </Alert>
              )}

              {/* No Historical Data - when disabled and never had data */}
              {isCostExplorerDisabled && noCachedDataExists && (
                <Alert variant="default" className="border-warning/50 bg-warning/10">
                  <Info className="h-4 w-4 text-warning" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">No historical data found.</span> You haven't enabled Cost Explorer before, 
                    so there's no cached cost data to display. Enable Cost Explorer below to fetch your AWS spending data.
                  </AlertDescription>
                </Alert>
              )}

              {/* Cost Explorer Enable/Disable Banner */}
              {isCostExplorerDisabled && (
                <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      AWS Cost Explorer
                    </CardTitle>
                    <CardDescription>
                      Get detailed insights into your AWS spending
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Features</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Service-by-service cost breakdown</li>
                          <li>• 6-month spending trends</li>
                          <li>• Automatic cost anomaly detection</li>
                          <li>• Top spending resources</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Caching</h4>
                        <p className="text-sm text-muted-foreground">
                          Cost data is cached for 6 hours to minimize API calls. 
                          Historical trends are cached for 24 hours.
                        </p>
                      </div>
                    </div>
                    
                    <Alert variant="default" className="border-warning/50 bg-warning/10">
                      <Info className="h-4 w-4 text-warning" />
                      <AlertDescription className="text-sm">
                        <strong>Note:</strong> AWS charges ~$0.01 per Cost Explorer API request. 
                        With caching enabled, typical usage costs less than $1/month.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      onClick={handleEnableCostExplorer}
                      disabled={costExplorerState.loading}
                      className="w-full md:w-auto"
                    >
                      {costExplorerState.loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4 mr-2" />
                      )}
                      Enable Cost Explorer
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Cost Explorer Status when enabled */}
              {!isCostExplorerDisabled && costExplorerState.enabled && (
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-muted-foreground">Cost Explorer is active</span>
                    {costCacheInfo && (
                      <span className="text-xs text-muted-foreground">
                        • Last updated: {costCacheInfo.formattedTime} {costCacheInfo.fromCache && "(cached)"}
                      </span>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleDisableCostExplorer}
                    disabled={costExplorerState.loading}
                    className="text-xs"
                  >
                    {costExplorerState.loading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Disable"
                    )}
                  </Button>
                </div>
              )}

              {/* Cost Overview Cards */}
              <div className={`grid grid-cols-1 md:grid-cols-2 ${awsData?.costData?.forecastTotal ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-6`}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    ) : hasRealCostData ? (
                      <>
                        <div className="text-2xl font-bold">${currentCost.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                          {isHistoricalData 
                            ? `From ${costCacheInfo?.formattedAge || 'cache'}`
                            : "From AWS Cost Explorer"
                          }
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-muted-foreground">—</div>
                        <p className="text-xs text-muted-foreground">
                          Enable Cost Explorer to view
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">EC2 Instances</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{awsData?.metrics.totalInstances || 0}</div>
                        <p className="text-xs text-muted-foreground">
                          {awsData?.metrics.runningInstances || 0} running
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">RDS Databases</CardTitle>
                    <BarChart3 className="h-4 w-4 text-warning" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{awsData?.metrics.totalDatabases || 0}</div>
                        <p className="text-xs text-muted-foreground">Database instances</p>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Projected Next Month - only shown when forecast data exists */}
                {awsData?.costData?.forecastTotal != null && awsData.costData.forecastTotal > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Projected Next Month</CardTitle>
                      {awsData.costData.forecastTotal > currentCost ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-success" />
                      )}
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                      ) : (
                        <>
                          <div className="text-2xl font-bold">${awsData.costData.forecastTotal.toFixed(2)}</div>
                          <p className="text-xs text-muted-foreground">
                            Projected next month spend
                          </p>
                          {currentCost > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {awsData.costData.forecastTotal > currentCost ? (
                                <span className="text-destructive">
                                  +{((awsData.costData.forecastTotal - currentCost) / currentCost * 100).toFixed(0)}% vs this month
                                </span>
                              ) : (
                                <span className="text-success">
                                  {((awsData.costData.forecastTotal - currentCost) / currentCost * 100).toFixed(0)}% vs this month
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1 italic">Based on AWS Cost Explorer forecast</p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">S3 Buckets</CardTitle>
                    <PieChart className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">{awsData?.metrics.totalBuckets || 0}</div>
                        <p className="text-xs text-muted-foreground">Storage buckets</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Cost Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Cost Alerts
                  </CardTitle>
                  <CardDescription>Important cost notifications and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : costAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {costAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className={`h-4 w-4 ${
                              alert.type === "critical" ? "text-destructive" : 
                              alert.type === "warning" ? "text-warning" : "text-primary"
                            }`} />
                            <span className="text-sm">{alert.message}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {alert.amount}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : noCachedDataExists ? (
                    <div className="text-center text-muted-foreground py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No historical data found</p>
                      <p className="text-xs mt-1">Enable Cost Explorer to fetch anomaly data</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No cost anomalies detected</p>
                      <p className="text-xs mt-1">Anomaly detection runs automatically</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Rightsizing Recommendations - Shows when idle/underutilized instances detected */}
              <RightsizingRecommendations 
                ec2Instances={awsData?.ec2Instances || []}
                costAnomalies={costAlerts}
                loading={loading}
              />

              {/* Charts and Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Spending Trend</CardTitle>
                    <CardDescription>Monthly AWS spend over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : monthlySpendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={monthlySpendData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="month" className="text-muted-foreground" fontSize={12} />
                          <YAxis className="text-muted-foreground" fontSize={12} tickFormatter={(v) => `$${v}`} />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 'var(--radius)',
                              color: 'hsl(var(--foreground))',
                            }}
                            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                            formatter={(value: any, name: string) => {
                              if (value == null) return [null, null];
                              if (name === 'forecast') return [`$${value}`, 'Forecast'];
                              return [`$${value}`, 'Actual'];
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="cost" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary))" 
                            fillOpacity={0.3}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="hsl(var(--primary))"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={{ r: 4, fill: 'hsl(var(--primary))', strokeDasharray: '0' }}
                            connectNulls={false}
                          />
                          {/* Bridge line connecting last actual to forecast */}
                          <Line
                            type="monotone"
                            dataKey="bridgeCost"
                            stroke="hsl(var(--primary))"
                            strokeDasharray="5 5"
                            strokeWidth={1}
                            dot={false}
                            connectNulls={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : noCachedDataExists ? (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No historical data found</p>
                          <p className="text-xs mt-1">Enable Cost Explorer to fetch spending trends</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No historical cost data</p>
                          <p className="text-xs mt-1">Data will appear after first API sync</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Service Breakdown</CardTitle>
                    <CardDescription>Cost distribution by AWS service</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : serviceBreakdown.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="50%" height={220}>
                          <RechartsPieChart>
                            <Pie
                              data={serviceBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              fill="hsl(var(--primary))"
                              dataKey="value"
                              paddingAngle={2}
                            >
                              {serviceBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 'var(--radius)',
                                color: 'hsl(var(--foreground))',
                              }}
                              itemStyle={{ color: 'hsl(var(--foreground))' }}
                              formatter={(value: number, name: string, props: any) => [
                                `$${props.payload.cost.toFixed(2)} (${value.toFixed(1)}%)`, 
                                props.payload.name
                              ]} 
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="flex-1 space-y-2 overflow-auto max-h-[220px]">
                          {serviceBreakdown.map((entry, index) => (
                            <div key={entry.name} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full shrink-0" 
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                                />
                                <span className="truncate max-w-[120px]" title={entry.name}>
                                  {entry.name}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">${entry.cost.toFixed(2)}</span>
                                <span className="text-muted-foreground ml-1">({entry.value.toFixed(1)}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : noCachedDataExists ? (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <PieChart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No historical data found</p>
                          <p className="text-xs mt-1">Enable Cost Explorer to fetch service breakdown</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <PieChart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No service cost data</p>
                          <p className="text-xs mt-1">Data will appear after first API sync</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Top Spending Resources */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Spending Resources</CardTitle>
                  <CardDescription>Resources with highest costs this month</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  ) : topResources.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Resource</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Monthly Cost</TableHead>
                          <TableHead>Trend</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topResources.map((resource, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{resource.resource}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{resource.type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{resource.cost}</TableCell>
                            <TableCell>
                              {resource.trend === "up" && <TrendingUp className="h-4 w-4 text-destructive" />}
                              {resource.trend === "down" && <TrendingDown className="h-4 w-4 text-success" />}
                              {resource.trend === "stable" && <div className="h-4 w-4 rounded-full bg-muted" />}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm">Optimize</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : noCachedDataExists ? (
                    <div className="text-center text-muted-foreground py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No historical data found</p>
                      <p className="text-xs mt-1">Enable Cost Explorer to fetch resource costs</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No resource cost data available</p>
                      <p className="text-xs mt-1">Data will appear after first API sync</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}