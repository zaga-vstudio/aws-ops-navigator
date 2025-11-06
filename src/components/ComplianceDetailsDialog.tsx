import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertTriangle, Info, XCircle, ShieldCheck, FileText } from "lucide-react";

interface ComplianceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  check: {
    id: string;
    name: string;
    status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
    description: string;
    resourceType?: string;
    resourceId?: string;
  };
}

export function ComplianceDetailsDialog({ 
  open, 
  onOpenChange, 
  check 
}: ComplianceDetailsDialogProps) {
  // Mock remediation steps based on compliance check type
  const getRemediationSteps = () => {
    if (check.status === 'COMPLIANT') {
      return [];
    }

    // Common remediation patterns
    const commonSteps = {
      encryption: [
        "Navigate to the AWS service console",
        "Select the non-compliant resource",
        "Enable encryption using AWS KMS or service-managed keys",
        "Apply encryption settings to the resource",
        "Verify encryption is enabled in resource properties",
        "Wait 5-10 minutes for AWS Config to re-evaluate compliance"
      ],
      logging: [
        "Navigate to the service's logging settings",
        "Enable CloudWatch Logs or CloudTrail logging",
        "Configure log retention period (recommended: 90+ days)",
        "Set up log delivery to S3 bucket if required",
        "Test that logs are being generated",
        "Wait for AWS Config to re-evaluate"
      ],
      accessControl: [
        "Review current access policies and permissions",
        "Apply principle of least privilege",
        "Remove public access if not required",
        "Update security group or IAM policies",
        "Test that legitimate access still works",
        "Monitor for any access issues"
      ],
      backup: [
        "Navigate to AWS Backup console",
        "Create a backup plan with appropriate schedule",
        "Assign resources to the backup plan",
        "Configure backup retention policy",
        "Test backup restoration process",
        "Enable backup notifications"
      ]
    };

    // Determine which steps to show based on check name/description
    const lowerName = check.name.toLowerCase();
    const lowerDesc = check.description.toLowerCase();

    if (lowerName.includes('encrypt') || lowerDesc.includes('encrypt')) {
      return commonSteps.encryption;
    }
    if (lowerName.includes('log') || lowerDesc.includes('log')) {
      return commonSteps.logging;
    }
    if (lowerName.includes('public') || lowerName.includes('access')) {
      return commonSteps.accessControl;
    }
    if (lowerName.includes('backup') || lowerDesc.includes('backup')) {
      return commonSteps.backup;
    }

    // Generic steps
    return [
      "Review the compliance requirement documentation",
      "Identify the specific resource(s) causing non-compliance",
      "Plan changes required to meet compliance",
      "Apply changes in a test environment first",
      "Deploy changes to production",
      "Verify compliance status after changes"
    ];
  };

  const remediationSteps = getRemediationSteps();

  const getStatusIcon = () => {
    switch (check.status) {
      case 'COMPLIANT':
        return <CheckCircle className="h-6 w-6 text-success" />;
      case 'NON_COMPLIANT':
        return <XCircle className="h-6 w-6 text-destructive" />;
      case 'NOT_APPLICABLE':
        return <Info className="h-6 w-6 text-muted-foreground" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-warning" />;
    }
  };

  const getStatusBadge = () => {
    switch (check.status) {
      case 'COMPLIANT':
        return <Badge variant="outline" className="text-success border-success">Compliant</Badge>;
      case 'NON_COMPLIANT':
        return <Badge variant="outline" className="text-destructive border-destructive">Non-Compliant</Badge>;
      case 'NOT_APPLICABLE':
        return <Badge variant="outline">Not Applicable</Badge>;
      default:
        return <Badge variant="outline">Insufficient Data</Badge>;
    }
  };

  const getSeverityLevel = () => {
    if (check.status === 'COMPLIANT') return null;
    
    // Determine severity based on check type
    const highSeverityKeywords = ['encrypt', 'public', 'mfa', 'root', 'password'];
    const mediumSeverityKeywords = ['log', 'monitor', 'backup', 'versioning'];
    
    const lowerName = check.name.toLowerCase();
    const lowerDesc = check.description.toLowerCase();
    
    if (highSeverityKeywords.some(keyword => 
      lowerName.includes(keyword) || lowerDesc.includes(keyword)
    )) {
      return 'high';
    }
    
    if (mediumSeverityKeywords.some(keyword => 
      lowerName.includes(keyword) || lowerDesc.includes(keyword)
    )) {
      return 'medium';
    }
    
    return 'low';
  };

  const severity = getSeverityLevel();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Compliance Check Details
          </DialogTitle>
          <DialogDescription>
            {check.id}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {getStatusIcon()}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{check.name}</h3>
                    {getStatusBadge()}
                    {severity && (
                      <Badge variant={
                        severity === 'high' ? 'destructive' : 
                        severity === 'medium' ? 'secondary' : 
                        'outline'
                      }>
                        {severity.toUpperCase()} SEVERITY
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{check.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resource Information */}
          {(check.resourceType || check.resourceId) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Affected Resource</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {check.resourceType && (
                  <div>
                    <span className="text-muted-foreground text-sm">Resource Type:</span>
                    <p className="font-medium">{check.resourceType}</p>
                  </div>
                )}
                {check.resourceId && (
                  <div>
                    <span className="text-muted-foreground text-sm">Resource ID:</span>
                    <p className="font-mono text-sm">{check.resourceId}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Remediation Steps */}
          {remediationSteps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Remediation Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Follow these steps to remediate this compliance issue. Always test changes in a 
                    non-production environment first.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-3">
                  {remediationSteps.map((step, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-sm">{step}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <p className="font-medium">Additional Resources:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• AWS Config documentation: https://docs.aws.amazon.com/config/</li>
                    <li>• AWS Well-Architected Framework guidance</li>
                    <li>• AWS Security Best Practices whitepaper</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliant State Message */}
          {check.status === 'COMPLIANT' && (
            <Card className="border-success">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-success flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-success">Compliance Check Passed</p>
                    <p className="text-sm text-muted-foreground">
                      This resource meets the compliance requirements. No action needed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Impact Assessment */}
          {severity && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Impact Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  {severity === 'high' && (
                    <>
                      <p className="font-medium text-destructive">High Severity Impact:</p>
                      <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
                        <li>May expose sensitive data or resources</li>
                        <li>Could lead to security breaches or data loss</li>
                        <li>Requires immediate attention and remediation</li>
                        <li>May violate compliance frameworks (PCI-DSS, HIPAA, etc.)</li>
                      </ul>
                    </>
                  )}
                  {severity === 'medium' && (
                    <>
                      <p className="font-medium text-warning">Medium Severity Impact:</p>
                      <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
                        <li>Reduces security posture and visibility</li>
                        <li>May complicate incident response and auditing</li>
                        <li>Should be addressed within 30 days</li>
                        <li>Recommended by security best practices</li>
                      </ul>
                    </>
                  )}
                  {severity === 'low' && (
                    <>
                      <p className="font-medium">Low Severity Impact:</p>
                      <ul className="space-y-1 text-muted-foreground ml-4 list-disc">
                        <li>Minor deviation from best practices</li>
                        <li>Low risk but should be addressed</li>
                        <li>Can be scheduled for future maintenance</li>
                        <li>Helps maintain optimal security posture</li>
                      </ul>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
