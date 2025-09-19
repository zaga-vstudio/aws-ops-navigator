import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Pie, Cell } from "recharts";

const monthlySpend = [
  { month: "Jan", cost: 450 },
  { month: "Feb", cost: 520 },
  { month: "Mar", cost: 480 },
  { month: "Apr", cost: 690 },
  { month: "May", cost: 720 },
  { month: "Jun", cost: 650 }
];

const serviceBreakdown = [
  { name: "EC2", value: 65, cost: 468 },
  { name: "RDS", value: 20, cost: 144 },
  { name: "S3", value: 8, cost: 58 },
  { name: "CloudWatch", value: 4, cost: 29 },
  { name: "Other", value: 3, cost: 22 }
];

const topResources = [
  { resource: "i-0123456789abcdef0", type: "EC2", cost: "$156.23", trend: "up" },
  { resource: "db-prod-mysql", type: "RDS", cost: "$89.45", trend: "down" },
  { resource: "i-0987654321fedcba0", type: "EC2", cost: "$78.90", trend: "up" },
  { resource: "cloudfront-dist", type: "CloudFront", cost: "$45.67", trend: "stable" }
];

const costAlerts = [
  { type: "warning", message: "Monthly spend 15% higher than last month", amount: "$721.00" },
  { type: "critical", message: "EC2 instance i-abc123 running for 72+ hours", amount: "$45.60" },
  { type: "info", message: "Reserved Instance savings opportunity available", amount: "Save $120/month" }
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))', 'hsl(var(--border))'];

export default function CostManagement() {
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState("6months");

  const handleRefresh = () => {
    setRefreshing(true);
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
                  <h1 className="text-3xl font-bold text-foreground">Cost Management</h1>
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
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$721.00</div>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1 text-destructive" />
                      +15% from last month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Last Month</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$650.00</div>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <TrendingDown className="h-3 w-3 mr-1 text-success" />
                      -8% from previous month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Projected</CardTitle>
                    <BarChart3 className="h-4 w-4 text-warning" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$795.00</div>
                    <p className="text-xs text-muted-foreground">End of month estimate</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Budget</CardTitle>
                    <PieChart className="h-4 w-4 text-success" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$1,000</div>
                    <p className="text-xs text-muted-foreground">72% utilized</p>
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
                  <div className="space-y-3">
                    {costAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
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
                </CardContent>
              </Card>

              {/* Charts and Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Spending Trend</CardTitle>
                    <CardDescription>Monthly AWS spend over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={monthlySpend}>
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Service Breakdown</CardTitle>
                    <CardDescription>Cost distribution by AWS service</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={serviceBreakdown}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {serviceBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
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
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}