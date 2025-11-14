import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RemediationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complianceCheck: any;
  onSuccess: () => void;
}

const remediationMap: Record<string, { type: string; autoFixAvailable: boolean }> = {
  'ebs-encryption': { type: 'enable_ebs_encryption', autoFixAvailable: false },
  's3-encryption': { type: 'enable_s3_encryption', autoFixAvailable: true },
  's3-public-access': { type: 'block_s3_public_access', autoFixAvailable: true },
  'iam-password-policy': { type: 'enable_password_policy', autoFixAvailable: true },
};

export function RemediationDialog({
  open,
  onOpenChange,
  complianceCheck,
  onSuccess,
}: RemediationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ steps: string[]; autoFixed: boolean } | null>(null);

  const remediation = remediationMap[complianceCheck?.id] || { type: 'manual', autoFixAvailable: false };

  const handleRemediation = async (autoFix: boolean) => {
    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('compliance-remediation', {
        body: {
          complianceCheckId: complianceCheck.id,
          remediationType: remediation.type,
          resourceId: complianceCheck.resourceId || 'default',
          resourceType: complianceCheck.resourceType || 'unknown',
          autoFix
        }
      });

      if (response.error) {
        throw response.error;
      }

      const data = response.data;
      setResult({
        steps: data.steps || [],
        autoFixed: data.autoFixed || false
      });

      toast({
        title: autoFix ? "Auto-Fix Applied" : "Manual Steps Provided",
        description: data.message,
      });

      if (autoFix) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error performing remediation:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform remediation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Compliance Remediation</DialogTitle>
          <DialogDescription>
            Fix compliance issue: {complianceCheck?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div>
            <h4 className="font-medium mb-2">Issue Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={complianceCheck?.status === 'NON_COMPLIANT' ? 'destructive' : 'secondary'}>
                  {complianceCheck?.status}
                </Badge>
              </div>
              {complianceCheck?.resourceType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resource Type:</span>
                  <span>{complianceCheck.resourceType}</span>
                </div>
              )}
              {complianceCheck?.resourceId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resource ID:</span>
                  <span className="font-mono text-xs">{complianceCheck.resourceId}</span>
                </div>
              )}
            </div>
          </div>

          {!result && (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {remediation.autoFixAvailable
                    ? 'This issue can be automatically fixed or you can view manual steps.'
                    : 'This issue requires manual intervention. View the recommended steps below.'}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                {remediation.autoFixAvailable && (
                  <Button
                    onClick={() => handleRemediation(true)}
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Auto-Fix
                  </Button>
                )}
                <Button
                  onClick={() => handleRemediation(false)}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  View Manual Steps
                </Button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <Alert variant={result.autoFixed ? 'default' : 'default'}>
                {result.autoFixed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Remediation completed successfully!
                    </AlertDescription>
                  </>
                ) : (
                  <>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Follow these manual steps to fix the issue:
                    </AlertDescription>
                  </>
                )}
              </Alert>

              <div className="flex-1 overflow-hidden">
                <h4 className="font-medium mb-2">
                  {result.autoFixed ? 'Actions Taken:' : 'Remediation Steps:'}
                </h4>
                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <ol className="space-y-2">
                    {result.steps.map((step, index) => (
                      <li key={index} className="text-sm">
                        {result.autoFixed ? (
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{step}</span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground font-mono">{step}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                onOpenChange(false);
              }}
            >
              Close
            </Button>
            {result && result.autoFixed && (
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
