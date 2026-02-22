import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateRoleDialog } from "@/components/CreateRoleDialog";
import { useCloudHubRoles } from "@/hooks/useCloudHubRoles";
import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { Plus, Trash2, ShieldCheck, Clock, ChevronDown, ScrollText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function RoleManagementTab() {
  const { roles, loading, createRole, deleteRole, auditLog, auditLoading, fetchAuditLog } = useCloudHubRoles();
  const { activeRole, setActiveRole } = useActiveRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteFromAWS, setDeleteFromAWS] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const handleDelete = async (id: string, roleName: string) => {
    if (activeRole.roleName === roleName) {
      setActiveRole({ roleName: null });
    }
    await deleteRole(id, deleteFromAWS);
    setDeleteFromAWS(false);
  };

  useEffect(() => {
    if (auditOpen) fetchAuditLog();
  }, [auditOpen, fetchAuditLog]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              CloudHub Roles
            </CardTitle>
            <CardDescription>
              Create and manage IAM roles for STS AssumeRole. Actions performed under a role are attributed in CloudTrail.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Role
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>ARN</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Session Duration</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array(2).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(7).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No roles created. Click "Create Role" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      CloudHub-Project-{role.role_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate" title={role.role_arn}>
                      {role.role_arn}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {Math.floor(role.max_session_duration_seconds / 60)}m
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {activeRole.roleName === role.role_name ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Role</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove "CloudHub-Project-{role.role_name}" from CloudHub?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="px-6 pb-2">
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={deleteFromAWS}
                                onCheckedChange={(v) => setDeleteFromAWS(!!v)}
                              />
                              Also delete the IAM role from AWS
                            </label>
                            {deleteFromAWS && (
                              <p className="text-xs text-muted-foreground mt-1 ml-6">
                                All inline and managed policies will be detached before deletion.
                              </p>
                            )}
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeleteFromAWS(false)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(role.id, role.role_name)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
        <Card className="mt-4">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScrollText className="h-4 w-4" />
                Role Audit Log
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${auditOpen ? "rotate-180" : ""}`} />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-2">
                  {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No audit events yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>ARN</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <Badge variant={entry.action === "created" ? "default" : "destructive"} className="text-xs">
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">CloudHub-Project-{entry.role_name}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">{entry.role_arn || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createRole}
      />
    </>
  );
}
