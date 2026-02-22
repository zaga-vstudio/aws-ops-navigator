import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { ResourceOverview } from "@/components/ResourceOverview";
import { CostChart } from "@/components/CostChart";
import { ActivityLog } from "@/components/ActivityLog";
import { LaunchEC2Dialog } from "@/components/LaunchEC2Dialog";
import { CreateRDSDialog } from "@/components/CreateRDSDialog";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { useAWSDataContext } from "@/contexts/AWSDataContext";
import { 
  Server, 
  Database, 
  DollarSign, 
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { data: awsData, loading: awsLoading, refetch } = useAWSDataContext();
  const navigate = useNavigate();
  const [launchEC2Open, setLaunchEC2Open] = useState(false);
  const [createRDSOpen, setCreateRDSOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen w-full bg-background">
        {/* Global Header with Sidebar Trigger */}
        <header className="h-12 flex items-center border-b border-border/50 px-4">
          <SidebarTrigger className="mr-4" />
          <div className="flex-1">
            <Header />
          </div>
        </header>

        <div className="flex w-full">
          <AppSidebar />
          
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header Section */}
              <div className="mb-8 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    Infrastructure Dashboard
                  </h1>
                  <p className="text-muted-foreground">
                    Monitor and manage your AWS resources from a central hub
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetch}
                  disabled={awsLoading}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${awsLoading ? 'animate-spin' : ''}`} />
                  Refresh Data
                </Button>
              </div>

              {/* Metrics Grid - Responsive */}
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total Instances"
                  value={awsData?.metrics.totalInstances || 0}
                  unit="EC2"
                  change={0}
                  changeType={awsData?.metrics.totalInstances ? "increase" : "neutral"}
                  status="healthy"
                  loading={awsLoading}
                  icon={<Server className="h-4 w-4 text-primary" />}
                />
                <MetricCard
                  title="Running Instances"
                  value={awsData?.metrics.runningInstances || 0}
                  unit="Active"
                  change={0}
                  changeType={awsData?.metrics.runningInstances ? "increase" : "neutral"}
                  status="healthy"
                  loading={awsLoading}
                  icon={<Cpu className="h-4 w-4 text-cloud-cyan" />}
                />
                <MetricCard
                  title="RDS Databases"
                  value={awsData?.metrics.totalDatabases || 0}
                  unit="DB"
                  change={0}
                  changeType={awsData?.metrics.totalDatabases ? "increase" : "neutral"}
                  status="healthy"
                  loading={awsLoading}
                  icon={<Database className="h-4 w-4 text-cloud-purple" />}
                />
                <MetricCard
                  title="Monthly Cost"
                  value={awsData?.metrics.estimatedCost ? `$${awsData.metrics.estimatedCost}` : "$0"}
                  unit=""
                  change={0}
                  changeType={awsData?.metrics.estimatedCost && awsData.metrics.estimatedCost > 0 ? "increase" : "neutral"}
                  status={awsData?.metrics.estimatedCost && awsData.metrics.estimatedCost > 0 ? "warning" : "healthy"}
                  loading={awsLoading}
                  icon={<DollarSign className="h-4 w-4 text-warning" />}
                />
              </div>

              {/* Main Content Grid - Responsive */}
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                <div className="space-y-6">
                  <ResourceOverview />
                  <CostChart />
                </div>
                
                <div className="space-y-6">
                  <ActivityLog awsData={awsData} />
                  
                  {/* Quick Actions - Responsive */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary-glow/5 border border-primary/20 rounded-lg p-4 lg:p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Quick Actions
                    </h3>
                     <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                       <button 
                         onClick={() => setLaunchEC2Open(true)}
                         className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
                       >
                         <Server className="h-5 w-5 text-primary flex-shrink-0" />
                         <div className="min-w-0">
                           <p className="font-medium text-foreground truncate">Launch EC2</p>
                           <p className="text-xs text-muted-foreground">Create new instance</p>
                         </div>
                       </button>
                       <button 
                         onClick={() => setCreateRDSOpen(true)}
                         className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
                       >
                         <Database className="h-5 w-5 text-cloud-purple flex-shrink-0" />
                         <div className="min-w-0">
                           <p className="font-medium text-foreground truncate">Create RDS</p>
                           <p className="text-xs text-muted-foreground">Setup database</p>
                         </div>
                       </button>
                       <button 
                         onClick={() => navigate('/costs')}
                         className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors"
                       >
                         <DollarSign className="h-5 w-5 text-cloud-cyan flex-shrink-0" />
                         <div className="min-w-0">
                           <p className="font-medium text-foreground truncate">Cost Analysis</p>
                           <p className="text-xs text-muted-foreground">View spending</p>
                         </div>
                       </button>
                       <button 
                         onClick={() => navigate('/monitoring')}
                         className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 transition-colors"
                       >
                         <Activity className="h-5 w-5 text-cloud-green flex-shrink-0" />
                         <div className="min-w-0">
                           <p className="font-medium text-foreground truncate">Monitor</p>
                           <p className="text-xs text-muted-foreground">View metrics</p>
                         </div>
                       </button>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <LaunchEC2Dialog 
        open={launchEC2Open} 
        onOpenChange={setLaunchEC2Open} 
        onSuccess={refetch} 
      />
      <CreateRDSDialog 
        open={createRDSOpen} 
        onOpenChange={setCreateRDSOpen} 
        onSuccess={refetch} 
      />
    </SidebarProvider>
  );
};

export default Dashboard;