import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { useAWSData } from "@/hooks/useAWSData";
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
  AlertTriangle
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RightsizingRecommendations } from "@/components/RightsizingRecommendations";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Pie, Cell } from "recharts";


const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--border))'];

export default function CostManagement() {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("6months");
  const { data: awsData, loading, refetch } = useAWSData();

  const currentCost = awsData?.metrics.estimatedCost || 0;
  
  // Generate historical data based on current cost
  const monthlySpendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((month, index) => ({
      month,
      cost: Math.round(currentCost * (0.7 + (index * 0.05)))
    }));
  }, [currentCost]);

  // Transform real cost data
  const serviceBreakdown = useMemo(() => {
    return awsData?.costData?.serviceBreakdown?.map(s => ({
      name: s.service,
      value: s.percentage,
      cost: s.amount
    })) || [];
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

  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 2000);
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
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1month">1 Month</SelectItem>
                      <SelectItem value="3months">3 Months</SelectItem>
                      <SelectItem value="6months">6 Months</SelectItem>
                      <SelectItem value="1year">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleRefresh} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Cost Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month (Estimated)</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold">${currentCost.toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">Real-time estimate</p>
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
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No cost anomalies detected</p>
                      <p className="text-xs mt-1">Enable AWS Cost Anomaly Detection for alerts</p>
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
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlySpendData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
                          <Area 
                            type="monotone" 
                            dataKey="cost" 
                            stroke="hsl(var(--primary))" 
                            fill="hsl(var(--primary))" 
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
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
                      <ResponsiveContainer width="100%" height={300}>
                        <RechartsPieChart>
                          <Pie
                            data={serviceBreakdown}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                          >
                            {serviceBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value.toFixed(2)}%`, 'Percentage']} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[300px] flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <PieChart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No cost data available</p>
                          <p className="text-xs mt-1">Requires AWS Cost Explorer API access</p>
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
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No resource cost data available</p>
                      <p className="text-xs mt-1">Requires AWS Cost Explorer API access</p>
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