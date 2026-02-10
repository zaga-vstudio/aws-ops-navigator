import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Search, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { CostBadge } from "./CostBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { EC2Instance } from "@/hooks/useAWSData";

interface ConnectivityTroubleshooterProps {
  ec2Instances: EC2Instance[];
  safetyMode: boolean;
}

interface AnalysisResult {
  reachable: boolean;
  forwardPath: { sequenceNumber: number; component: string }[];
  explanations: { component: string; explanation: string; resourceId: string; resourceType: string }[];
}

export function ConnectivityTroubleshooter({ ec2Instances, safetyMode }: ConnectivityTroubleshooterProps) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [port, setPort] = useState('443');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const runningInstances = ec2Instances.filter(i => i.state === 'running');

  const handleRunClick = () => {
    if (!sourceId || !destinationId) {
      toast({ title: 'Missing fields', description: 'Select both source and destination.', variant: 'destructive' });
      return;
    }
    setConfirmOpen(true);
  };

  const executeAnalysis = async () => {
    setConfirmOpen(false);
    setAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reachability-analyzer', {
        body: {
          action: 'analyze',
          sourceId,
          destinationId,
          protocol: 'tcp',
          destinationPort: parseInt(port) || 443,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult(data.result);
      toast({ title: 'Analysis Complete', description: data.result.reachable ? 'Path is reachable!' : 'Path is NOT reachable.' });
    } catch (err: any) {
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Connectivity Troubleshooter
          </CardTitle>
          <CostBadge type="paid" label="Paid — $0.10 per run" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Instance</label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                <SelectContent>
                  {runningInstances.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination Instance</label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger><SelectValue placeholder="Select destination..." /></SelectTrigger>
                <SelectContent>
                  {runningInstances.filter(i => i.id !== sourceId).map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination Port</label>
              <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="443" />
            </div>
          </div>

          <Button
            onClick={handleRunClick}
            disabled={safetyMode || analyzing || !sourceId || !destinationId}
            className="gap-2"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <div className="flex flex-col items-start">
              <span>Run Analysis</span>
              <span className="text-[10px] opacity-70 font-normal">($0.10 per run)</span>
            </div>
          </Button>

          {safetyMode && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Safety Mode is enabled — reachability analysis is disabled
            </p>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                {result.reachable ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1 text-sm py-1">
                    <CheckCircle className="h-4 w-4" />
                    Path is Reachable
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-sm py-1">
                    <XCircle className="h-4 w-4" />
                    Path is NOT Reachable
                  </Badge>
                )}
              </div>

              {/* Visual Path */}
              {result.forwardPath.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Packet Journey</h4>
                  <div className="flex items-center gap-1 flex-wrap">
                    {result.forwardPath.map((hop, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs font-mono">
                          {hop.component}
                        </div>
                        {i < result.forwardPath.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanations / Blocking Points */}
              {result.explanations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Blocking Points</h4>
                  {result.explanations.map((exp, i) => (
                    <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Blocked by {exp.resourceType} ({exp.resourceId})</p>
                          <p className="text-muted-foreground text-xs mt-1">{exp.explanation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Reachability Analysis
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>AWS charges $0.10 for each Reachability Analysis.</strong>
              </p>
              <p>This will be billed directly to your AWS account. Confirm execution?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAnalysis}>
              Confirm & Run ($0.10)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
