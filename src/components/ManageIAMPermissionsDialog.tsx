import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  Server,
  Database,
  Activity,
  Network,
  Lock,
  ChevronDown,
  ChevronRight,
  Copy,
  AlertTriangle,
  Info,
  Loader2,
  Check,
} from "lucide-react";

// ── Service definitions (mirrors backend) ────────────────────────────────────

const SERVICE_ACTIONS: Record<string, { read: string[]; write: string[]; conditionScoped?: string[] }> = {
  ec2: {
    read: ["ec2:Describe*"],
    write: ["ec2:RunInstances", "ec2:TerminateInstances", "ec2:StartInstances", "ec2:StopInstances"],
    conditionScoped: ["ec2:RunInstances"],
  },
  vpc: {
    read: ["ec2:DescribeVpcs", "ec2:DescribeSubnets", "ec2:DescribeSecurityGroups", "ec2:DescribeRouteTables"],
    write: ["ec2:ModifyVpcAttribute", "ec2:CreateSubnet", "ec2:DeleteSubnet"],
  },
  security_groups: {
    read: ["ec2:DescribeSecurityGroups", "ec2:DescribeSecurityGroupRules"],
    write: [
      "ec2:CreateSecurityGroup",
      "ec2:AuthorizeSecurityGroupIngress",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:RevokeSecurityGroupEgress",
    ],
    conditionScoped: ["ec2:CreateSecurityGroup"],
  },
  rds: {
    read: ["rds:Describe*"],
    write: ["rds:CreateDBInstance", "rds:DeleteDBInstance", "rds:ModifyDBInstance"],
  },
  cloudwatch: {
    read: ["cloudwatch:Describe*", "cloudwatch:GetMetricData", "cloudwatch:ListMetrics"],
    write: ["cloudwatch:PutMetricAlarm", "cloudwatch:DeleteAlarms"],
  },
};

const SERVICE_META: Record<string, { label: string; icon: any; description: string }> = {
  ec2: { label: "EC2 Instances", icon: Server, description: "Launch, stop, terminate instances" },
  vpc: { label: "VPC Networking", icon: Network, description: "Subnets, route tables (no VPC creation)" },
  security_groups: { label: "Security Groups", icon: Lock, description: "Firewall rules management" },
  rds: { label: "RDS Databases", icon: Database, description: "Create, modify, delete databases" },
  cloudwatch: { label: "CloudWatch", icon: Activity, description: "Metrics and alarms" },
};

interface ServicePermState {
  read: boolean;
  write: boolean;
  vpcIds: string[];
  resourceArns: string[];
}

const VPC_ID_RE = /^vpc-[a-z0-9]+$/;
const INSTANCE_ID_RE = /^i-[a-z0-9]+$/;
const ARN_RE = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;

function validateId(id: string): boolean {
  return VPC_ID_RE.test(id) || INSTANCE_ID_RE.test(id) || ARN_RE.test(id);
}

interface ManageIAMPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { userName: string; userId: string } | null;
  vpcs: { id: string; name: string }[];
  ec2Instances: { id: string; name: string }[];
  rdsInstances: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function ManageIAMPermissionsDialog({
  open,
  onOpenChange,
  user,
  vpcs,
  ec2Instances,
  rdsInstances,
  onSuccess,
}: ManageIAMPermissionsDialogProps) {
  const [perms, setPerms] = useState<Record<string, ServicePermState>>({});
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [managedPolicyWarning, setManagedPolicyWarning] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [scopeInputs, setScopeInputs] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  

  // Initialize empty perms
  useEffect(() => {
    if (!open || !user) return;
    const initial: Record<string, ServicePermState> = {};
    for (const svc of Object.keys(SERVICE_ACTIONS)) {
      initial[svc] = { read: false, write: false, vpcIds: [], resourceArns: [] };
    }
    setPerms(initial);
    setScopeInputs({});
    setValidationErrors({});
    setConfirmStep(false);
    setManagedPolicyWarning([]);
    loadExisting();
  }, [open, user]);

  async function loadExisting() {
    if (!user) return;
    setLoading(true);
    try {
      // Load existing inline policies
      const { data: polData, error: polErr } = await supabase.functions.invoke("manage-iam-permissions", {
        body: { action: "listPolicies", userName: user.userName },
      });
      if (polErr) console.error("listPolicies error:", polErr);

      // Load managed policies for conflict detection
      const { data: mpData, error: mpErr } = await supabase.functions.invoke("manage-iam-permissions", {
        body: { action: "listManagedPolicies", userName: user.userName },
      });
      if (mpErr) console.error("listManagedPolicies error:", mpErr);

      if (mpData?.managedPolicies?.length) {
        const broadPolicies = ["AdministratorAccess", "PowerUserAccess", "AmazonEC2FullAccess", "AmazonRDSFullAccess"];
        const conflicts = mpData.managedPolicies
          .filter((p: any) => broadPolicies.some((bp) => p.policyName?.includes(bp)))
          .map((p: any) => p.policyName);
        setManagedPolicyWarning(conflicts);
      }

      // Parse existing CloudHub policies back into state
      if (polData?.policies) {
        setPerms((prev) => {
          const updated = { ...prev };
          for (const [polName, doc] of Object.entries(polData.policies) as [string, any][]) {
            for (const svc of Object.keys(SERVICE_ACTIONS)) {
              const expectedName =
                svc === "security_groups"
                  ? `CloudHub-Scoped-SECURITYGROUPS-${user.userName}`
                  : `CloudHub-Scoped-${svc.toUpperCase()}-${user.userName}`;
              if (polName === expectedName && doc?.Statement) {
                const hasRead = doc.Statement.some((s: any) =>
                  s.Action?.some((a: string) => SERVICE_ACTIONS[svc].read.includes(a))
                );
                const hasWrite = doc.Statement.some((s: any) =>
                  s.Action?.some((a: string) => SERVICE_ACTIONS[svc].write.includes(a))
                );
                updated[svc] = { ...updated[svc], read: hasRead, write: hasWrite };
              }
            }
          }
          return updated;
        });
      }
    } catch (e) {
      console.error("Failed to load permissions:", e);
    } finally {
      setLoading(false);
    }
  }

  function updatePerm(service: string, field: "read" | "write", value: boolean) {
    setPerms((prev) => ({
      ...prev,
      [service]: { ...prev[service], [field]: value },
    }));
  }

  function addVpcScope(service: string, vpcId: string) {
    if (!VPC_ID_RE.test(vpcId)) {
      setValidationErrors((prev) => ({ ...prev, [service]: `Invalid VPC ID: ${vpcId}` }));
      return;
    }
    setValidationErrors((prev) => ({ ...prev, [service]: "" }));
    setPerms((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        vpcIds: prev[service].vpcIds.includes(vpcId) ? prev[service].vpcIds : [...prev[service].vpcIds, vpcId],
      },
    }));
    setScopeInputs((prev) => ({ ...prev, [service]: "" }));
  }

  function addResourceScope(service: string, arn: string) {
    if (!validateId(arn)) {
      setValidationErrors((prev) => ({ ...prev, [service]: `Invalid resource ID: ${arn}` }));
      return;
    }
    setValidationErrors((prev) => ({ ...prev, [service]: "" }));
    setPerms((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        resourceArns: prev[service].resourceArns.includes(arn)
          ? prev[service].resourceArns
          : [...prev[service].resourceArns, arn],
      },
    }));
    setScopeInputs((prev) => ({ ...prev, [service]: "" }));
  }

  function removeScope(service: string, type: "vpcIds" | "resourceArns", value: string) {
    setPerms((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [type]: prev[service][type].filter((v) => v !== value),
      },
    }));
  }

  // Build preview JSON (mirrors backend logic)
  const policyPreview = useMemo(() => {
    if (!user) return {};
    const result: Record<string, any> = {};
    for (const [svc, perm] of Object.entries(perms)) {
      if (!perm.read && !perm.write) continue;
      const statements: any[] = [];
      const def = SERVICE_ACTIONS[svc];

      if (perm.read) {
        statements.push({ Effect: "Allow", Action: def.read, Resource: "*" });
      }
      if (perm.write) {
        const condScoped = def.conditionScoped || [];
        const arnActions = def.write.filter((a) => !condScoped.includes(a));
        const condActions = def.write.filter((a) => condScoped.includes(a));

        if (arnActions.length > 0) {
          statements.push({
            Effect: "Allow",
            Action: arnActions,
            Resource: perm.resourceArns.length > 0 ? perm.resourceArns : "*",
          });
        }
        if (condActions.length > 0) {
          const stmt: any = { Effect: "Allow", Action: condActions, Resource: "*" };
          if (perm.vpcIds.length > 0) {
            const vpcArns = perm.vpcIds.map((id) => `arn:aws:ec2:<region>:<account>:vpc/${id}`);
            stmt.Condition = { StringEquals: { "ec2:Vpc": vpcArns.length === 1 ? vpcArns[0] : vpcArns } };
          }
          statements.push(stmt);
        }
      }
      result[svc] = { Version: "2012-10-17", Statement: statements };
    }
    return result;
  }, [perms, user]);

  // Check if any statement has Resource: "*" without conditions
  const hasWildcardWarning = useMemo(() => {
    for (const doc of Object.values(policyPreview)) {
      for (const stmt of (doc as any)?.Statement || []) {
        if (
          stmt.Resource === "*" &&
          !stmt.Condition &&
          !stmt.Action?.some((a: string) => a.includes("Describe") || a.includes("List") || a.includes("Get"))
        ) {
          return true;
        }
      }
    }
    return false;
  }, [policyPreview]);

  // Changes summary
  const changesSummary = useMemo(() => {
    const changes: { service: string; action: string }[] = [];
    for (const [svc, perm] of Object.entries(perms)) {
      if (perm.read || perm.write) {
        changes.push({ service: SERVICE_META[svc]?.label || svc, action: "create/update" });
      } else {
        changes.push({ service: SERVICE_META[svc]?.label || svc, action: "remove (if exists)" });
      }
    }
    return changes;
  }, [perms]);

  async function applyPermissions() {
    if (!user) return;
    setApplying(true);
    try {
      const permissionsPayload = Object.entries(perms).map(([service, p]) => ({
        service,
        read: p.read,
        write: p.write,
        vpcIds: p.vpcIds,
        resourceArns: p.resourceArns,
      }));

      const { data, error } = await supabase.functions.invoke("manage-iam-permissions", {
        body: { action: "applyPermissions", userName: user.userName, permissions: permissionsPayload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Permissions applied successfully");
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Failed to apply permissions: ${e.message}`);
    } finally {
      setApplying(false);
      setConfirmStep(false);
    }
  }

  function copyPreview() {
    navigator.clipboard.writeText(JSON.stringify(policyPreview, null, 2));
    toast.success("Policy JSON copied to clipboard");
  }

  const hasConditionScoping = (svc: string) => !!SERVICE_ACTIONS[svc]?.conditionScoped?.length;

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions — {user.userName}
          </DialogTitle>
          <DialogDescription>
            Assign scoped inline IAM policies. VPC creation is admin-only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4">
          <div className="space-y-4">
            {/* Managed policy conflict warning */}
            {managedPolicyWarning.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This user has broader managed policies attached ({managedPolicyWarning.join(", ")}). Scoped inline policies may not restrict effective access.
                </AlertDescription>
              </Alert>
            )}

            {/* Wildcard warning */}
            {hasWildcardWarning && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Some write actions use <code className="text-xs">"Resource": "*"</code> without conditions. Consider scoping to specific VPCs or resources.
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading current permissions…
              </div>
            ) : confirmStep ? (
              /* Confirmation step */
              <div className="space-y-3">
                <h3 className="font-semibold">Confirm Changes</h3>
                <div className="space-y-2">
                  {changesSummary.map((c) => (
                    <div key={c.service} className="flex items-center justify-between p-2 border rounded-md">
                      <span className="text-sm font-medium">{c.service}</span>
                      <Badge variant={c.action.startsWith("create") ? "default" : "secondary"}>{c.action}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Service permission cards */
              Object.entries(SERVICE_META).map(([svc, meta]) => {
                const Icon = meta.icon;
                const perm = perms[svc];
                if (!perm) return null;
                return (
                  <Card key={svc}>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {meta.label}
                        <span className="font-normal text-muted-foreground text-xs">— {meta.description}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch checked={perm.read} onCheckedChange={(v) => updatePerm(svc, "read", v)} id={`${svc}-read`} />
                          <Label htmlFor={`${svc}-read`} className="text-sm">Read</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={perm.write} onCheckedChange={(v) => updatePerm(svc, "write", v)} id={`${svc}-write`} />
                          <Label htmlFor={`${svc}-write`} className="text-sm">Write</Label>
                        </div>
                      </div>

                      {perm.write && (
                        <div className="space-y-2 pl-1">
                          {/* VPC scoping for condition-based services */}
                          {hasConditionScoping(svc) && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Scope to VPC (condition-based)</Label>
                              <div className="flex gap-2">
                                {vpcs.length > 0 ? (
                                  <Select onValueChange={(v) => addVpcScope(svc, v)}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                      <SelectValue placeholder="Select VPC…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {vpcs.map((v) => (
                                        <SelectItem key={v.id} value={v.id}>
                                          {v.name || v.id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex gap-2 flex-1">
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="vpc-abc123"
                                      value={scopeInputs[`${svc}-vpc`] || ""}
                                      onChange={(e) => setScopeInputs((p) => ({ ...p, [`${svc}-vpc`]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          addVpcScope(svc, scopeInputs[`${svc}-vpc`] || "");
                                        }
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => addVpcScope(svc, scopeInputs[`${svc}-vpc`] || "")}
                                    >
                                      Add
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {perm.vpcIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {perm.vpcIds.map((id) => (
                                    <Badge key={id} variant="outline" className="text-xs cursor-pointer" onClick={() => removeScope(svc, "vpcIds", id)}>
                                      {id} ×
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Resource ARN scoping for non-condition services */}
                          {!hasConditionScoping(svc) && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Scope to resources (ARNs)</Label>
                              <div className="flex gap-2">
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="arn:aws:... or resource-id"
                                  value={scopeInputs[svc] || ""}
                                  onChange={(e) => setScopeInputs((p) => ({ ...p, [svc]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      addResourceScope(svc, scopeInputs[svc] || "");
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => addResourceScope(svc, scopeInputs[svc] || "")}
                                >
                                  Add
                                </Button>
                              </div>
                              {/* Quick-add from known resources */}
                              {svc === "vpc" && vpcs.length > 0 && (
                                <Select onValueChange={(v) => addResourceScope(svc, v)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Quick add VPC…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {vpcs.map((v) => (
                                      <SelectItem key={v.id} value={v.id}>{v.name || v.id}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {svc === "rds" && rdsInstances.length > 0 && (
                                <Select onValueChange={(v) => addResourceScope(svc, v)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Quick add RDS…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rdsInstances.map((r) => (
                                      <SelectItem key={r.id} value={r.id}>{r.name || r.id}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {perm.resourceArns.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {perm.resourceArns.map((arn) => (
                                    <Badge key={arn} variant="outline" className="text-xs cursor-pointer" onClick={() => removeScope(svc, "resourceArns", arn)}>
                                      {arn} ×
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {validationErrors[svc] && (
                            <p className="text-xs text-destructive">{validationErrors[svc]}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}

            {/* Policy JSON Preview */}
            {!loading && !confirmStep && Object.keys(policyPreview).length > 0 && (
              <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                    Policy JSON Preview
                    {previewOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 text-xs"
                      onClick={copyPreview}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-64 mt-1">
                      {JSON.stringify(policyPreview, null, 2)}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Limitations info */}
            {!loading && !confirmStep && (
              <Alert variant="default">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Limitations:</strong> Describe* actions always apply to all resources. VPC creation is admin-only. Condition-based scoping depends on AWS service support.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          {confirmStep ? (
            <>
              <Button variant="outline" onClick={() => setConfirmStep(false)} disabled={applying}>
                Back
              </Button>
              <Button onClick={applyPermissions} disabled={applying}>
                {applying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Apply Permissions
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => setConfirmStep(true)} disabled={loading}>
                Review & Apply
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
