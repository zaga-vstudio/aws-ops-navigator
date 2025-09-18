import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MetricCard } from "@/components/MetricCard";
import { ResourceOverview } from "@/components/ResourceOverview";
import { CostChart } from "@/components/CostChart";
import { ActivityLog } from "@/components/ActivityLog";
import { 
  Server, 
  Database, 
  DollarSign, 
  Activity,
  Cpu,
  HardDrive,
  Wifi
} from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar className="w-64 min-h-[calc(100vh-4rem)]" />
        
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Infrastructure Dashboard
              </h1>
              <p className="text-muted-foreground">
                Monitor and manage your AWS resources from a central hub
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Active Instances"
                value="12"
                unit="EC2"
                change={8.2}
                changeType="increase"
                status="healthy"
                icon={<Server className="h-4 w-4 text-primary" />}
              />
              <MetricCard
                title="CPU Utilization"
                value="68"
                unit="%"
                change={-2.1}
                changeType="decrease"
                status="healthy"
                icon={<Cpu className="h-4 w-4 text-cloud-cyan" />}
              />
              <MetricCard
                title="Storage Used"
                value="847"
                unit="GB"
                change={12.5}
                changeType="increase"
                status="warning"
                icon={<HardDrive className="h-4 w-4 text-warning" />}
              />
              <MetricCard
                title="Network I/O"
                value="2.4"
                unit="Gbps"
                change={5.3}
                changeType="increase"
                status="healthy"
                icon={<Wifi className="h-4 w-4 text-cloud-green" />}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <ResourceOverview />
                <CostChart />
              </div>
              
              <div className="space-y-6">
                <ActivityLog />
                
                {/* Quick Actions */}
                <div className="bg-gradient-to-br from-primary/5 to-primary-glow/5 border border-primary/20 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Quick Actions
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                      <Server className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Launch EC2</p>
                        <p className="text-xs text-muted-foreground">Create new instance</p>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                      <Database className="h-5 w-5 text-cloud-purple" />
                      <div>
                        <p className="font-medium text-foreground">Create RDS</p>
                        <p className="text-xs text-muted-foreground">Setup database</p>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                      <DollarSign className="h-5 w-5 text-cloud-cyan" />
                      <div>
                        <p className="font-medium text-foreground">Cost Analysis</p>
                        <p className="text-xs text-muted-foreground">View spending</p>
                      </div>
                    </button>
                    <button className="flex items-center gap-3 p-3 text-left bg-background border border-border/50 rounded-lg hover:bg-accent/50 transition-colors">
                      <Activity className="h-5 w-5 text-cloud-green" />
                      <div>
                        <p className="font-medium text-foreground">Monitor</p>
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
  );
};

export default Index;
