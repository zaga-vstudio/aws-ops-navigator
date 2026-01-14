import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Cpu, 
  TrendingDown, 
  CheckCircle2, 
  Loader2,
  Zap,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  publicIp?: string;
  privateIp?: string;
  launchTime: string;
  cpuUtilization?: number;
}

interface CostAnomaly {
  id: string;
  type: string;
  message: string;
  amount: string;
  resourceId?: string;
}

interface RightsizingRecommendation {
  instanceId: string;
  instanceName: string;
  currentType: string;
  recommendedType: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
  reason: string;
  cpuUtilization: number;
}

interface RightsizingRecommendationsProps {
  ec2Instances: EC2Instance[];
  costAnomalies: CostAnomaly[];
  loading?: boolean;
}

// Instance type cost estimates (monthly, approximate)
const instanceCosts: Record<string, number> = {
  "t2.micro": 8.50,
  "t2.small": 17.00,
  "t2.medium": 34.00,
  "t2.large": 68.00,
  "t2.xlarge": 136.00,
  "t3.micro": 7.50,
  "t3.small": 15.00,
  "t3.medium": 30.00,
  "t3.large": 60.00,
  "t3.xlarge": 120.00,
  "m5.large": 70.00,
  "m5.xlarge": 140.00,
  "m5.2xlarge": 280.00,
  "c5.large": 62.00,
  "c5.xlarge": 124.00,
  "r5.large": 91.00,
  "r5.xlarge": 182.00,
};

// Downgrade paths
const downgradePaths: Record<string, string> = {
  "t2.xlarge": "t2.large",
  "t2.large": "t2.medium",
  "t2.medium": "t2.small",
  "t2.small": "t2.micro",
  "t3.xlarge": "t3.large",
  "t3.large": "t3.medium",
  "t3.medium": "t3.small",
  "t3.small": "t3.micro",
  "m5.2xlarge": "m5.xlarge",
  "m5.xlarge": "m5.large",
  "c5.xlarge": "c5.large",
  "r5.xlarge": "r5.large",
};

export function RightsizingRecommendations({ 
  ec2Instances, 
  costAnomalies,
  loading = false 
}: RightsizingRecommendationsProps) {
  const [selectedRecommendation, setSelectedRecommendation] = useState<RightsizingRecommendation | null>(null);
  const [applyingDowngrade, setApplyingDowngrade] = useState(false);
  const [appliedRecommendations, setAppliedRecommendations] = useState<Set<string>>(new Set());

  // Generate rightsizing recommendations based on idle/underutilized instances
  const recommendations: RightsizingRecommendation[] = ec2Instances
    .filter(instance => {
      // Only consider running instances
      if (instance.state !== "running") return false;
      
      // Check if instance type has a downgrade path
      if (!downgradePaths[instance.type]) return false;
      
      // Consider instance as candidate if:
      // 1. CPU utilization is low (< 20%)
      // 2. Or there's a cost anomaly related to this instance
      const isLowUtilization = instance.cpuUtilization !== undefined && instance.cpuUtilization < 20;
      const hasRelatedAnomaly = costAnomalies.some(
        anomaly => anomaly.resourceId === instance.id || 
                   anomaly.message.toLowerCase().includes("idle") ||
                   anomaly.message.toLowerCase().includes("underutilized")
      );
      
      return isLowUtilization || hasRelatedAnomaly;
    })
    .map(instance => {
      const currentType = instance.type;
      const recommendedType = downgradePaths[currentType];
      const currentCost = instanceCosts[currentType] || 50;
      const projectedCost = instanceCosts[recommendedType] || currentCost * 0.5;
      const savings = currentCost - projectedCost;
      
      let reason = "Low CPU utilization detected";
      if (instance.cpuUtilization !== undefined && instance.cpuUtilization < 10) {
        reason = "Instance appears idle (< 10% CPU)";
      } else if (instance.cpuUtilization !== undefined && instance.cpuUtilization < 20) {
        reason = "Instance underutilized (< 20% CPU)";
      }
      
      return {
        instanceId: instance.id,
        instanceName: instance.name || instance.id,
        currentType,
        recommendedType,
        currentCost,
        projectedCost,
        savings,
        reason,
        cpuUtilization: instance.cpuUtilization || 0,
      };
    })
    .filter(rec => !appliedRecommendations.has(rec.instanceId));

  const totalPotentialSavings = recommendations.reduce((sum, rec) => sum + rec.savings, 0);

  const handleApplyDowngrade = async () => {
    if (!selectedRecommendation) return;
    
    setApplyingDowngrade(true);
    
    // Simulate API call to downgrade instance
    // In a real implementation, this would call the manage-ec2-instances edge function
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setAppliedRecommendations(prev => new Set([...prev, selectedRecommendation.instanceId]));
    
    toast.success(
      `Instance ${selectedRecommendation.instanceName} will be downsized from ${selectedRecommendation.currentType} to ${selectedRecommendation.recommendedType}`,
      {
        description: `Estimated monthly savings: $${selectedRecommendation.savings.toFixed(2)}`,
      }
    );
    
    setApplyingDowngrade(false);
    setSelectedRecommendation(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Rightsizing Recommendations
          </CardTitle>
          <CardDescription>Automated cost optimization suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return null; // Don't show the card if there are no recommendations
  }

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Rightsizing Recommendations
              </CardTitle>
              <CardDescription>
                Optimize idle or underutilized resources to reduce costs
              </CardDescription>
            </div>
            {totalPotentialSavings > 0 && (
              <Badge variant="secondary" className="text-lg px-3 py-1 bg-success/10 text-success border-success/20">
                <DollarSign className="h-4 w-4 mr-1" />
                Save ${totalPotentialSavings.toFixed(2)}/mo
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendations.map((rec) => (
            <div 
              key={rec.instanceId}
              className="flex items-center justify-between p-4 border rounded-lg bg-card hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-full bg-warning/10">
                  <Cpu className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rec.instanceName}</span>
                    <Badge variant="outline" className="text-xs">
                      {rec.cpuUtilization.toFixed(1)}% CPU
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{rec.currentType}</span>
                    <TrendingDown className="h-3 w-3 text-success" />
                    <span className="font-mono text-success">{rec.recommendedType}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground line-through">
                    ${rec.currentCost.toFixed(2)}/mo
                  </div>
                  <div className="font-medium text-success">
                    ${rec.projectedCost.toFixed(2)}/mo
                  </div>
                </div>
                <Button 
                  onClick={() => setSelectedRecommendation(rec)}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  Save ${rec.savings.toFixed(2)}/mo
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedRecommendation} onOpenChange={() => setSelectedRecommendation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Confirm Instance Rightsizing
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  You are about to downgrade the following EC2 instance to save costs:
                </p>
                {selectedRecommendation && (
                  <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Instance:</span>
                      <span className="font-medium text-foreground">{selectedRecommendation.instanceName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Type:</span>
                      <span className="font-mono text-foreground">{selectedRecommendation.currentType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New Type:</span>
                      <span className="font-mono text-success">{selectedRecommendation.recommendedType}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 mt-2">
                      <span className="text-muted-foreground">Monthly Savings:</span>
                      <span className="font-bold text-success">${selectedRecommendation.savings.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <p className="text-sm text-warning">
                  ⚠️ This action will stop the instance, change its type, and restart it. 
                  There will be brief downtime during the resize.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyingDowngrade}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApplyDowngrade}
              disabled={applyingDowngrade}
              className="bg-success hover:bg-success/90"
            >
              {applyingDowngrade ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply Downgrade
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
