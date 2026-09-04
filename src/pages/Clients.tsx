import { useState } from "react";
import { Header } from "@/components/Header";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, Plus, Users, RefreshCw, Trash2, PlugZap, KeyRound, Loader2,
  CheckCircle2, AlertTriangle, Clock, Eye,
} from "lucide-react";
import { useClients, Client } from "@/hooks/useClients";
import { useClientContext } from "@/contexts/ClientContext";
import { AuditorIdentityCard } from "@/components/clients/AuditorIdentityCard";
import { ClientOnboardingWizard } from "@/components/clients/ClientOnboardingWizard";
import { ClientAccessLog } from "@/components/clients/ClientAccessLog";
import { useToast } from "@/hooks/use-toast";

const statusBadge = (status: Client["connection_status"]) => {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" /> Error
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" /> Pendiente
        </Badge>
      );
  }
};

export default function Clients() {
  const { toast } = useToast();
  const {
    clients, auditor, loading, busy, refetch,
    createClient, updateClient, deleteClient, rotateExternalId,
    testConnection, saveAuditor, verifyAuditor, fetchAccessLog,
  } = useClients();
  const { reloadClients, setActiveClient } = useClientContext();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [logClientId, setLogClientId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState("clients");

  const connectedCount = clients.filter((c) => c.connection_status === "connected").length;

  const openNew = () => {
    setEditing(null);
    setWizardOpen(true);
  };

  const openExisting = (client: Client) => {
    setEditing(client);
    setWizardOpen(true);
  };

  const handleTest = async (client: Client) => {
    const res = await testConnection(client.id);
    await reloadClients();
    toast({
      title: res.success ? "Conexión correcta" : "La conexión falló",
      description: res.success
        ? `Cuenta ${res.awsAccountId ?? client.aws_account_id ?? ""}`
        : res.error,
      variant: res.success ? undefined : "destructive",
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteClient(deleteTarget.id);
    setDeleteTarget(null);
    await reloadClients();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 flex items-center gap-4 border-b border-border/50 bg-card px-6">
            <SidebarTrigger />
            <Header />
          </header>

          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  Clientes
                </h1>
                <p className="text-sm text-muted-foreground">
                  Cuentas de AWS que auditas. {connectedCount} de {clients.length} conectadas.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
                <Button size="sm" onClick={openNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo cliente
                </Button>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="clients">Clientes</TabsTrigger>
                <TabsTrigger value="identity">Identidad de auditoría</TabsTrigger>
                <TabsTrigger value="access">Accesos</TabsTrigger>
              </TabsList>

              <TabsContent value="clients" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cuentas conectadas</CardTitle>
                    <CardDescription>
                      Cada cliente autoriza una lectura de su cuenta con un identificador secreto
                      propio, que puedes renovar cuando quieras.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-2">
                        {[0, 1, 2].map((i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : clients.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <Building2 className="h-10 w-10 text-muted-foreground" />
                        <div>
                          <p className="font-medium">Todavía no tienes clientes</p>
                          <p className="text-sm text-muted-foreground">
                            Añade el primero y te guiamos paso a paso para conectar su cuenta.
                          </p>
                        </div>
                        <Button size="sm" onClick={openNew}>
                          <Plus className="h-4 w-4 mr-2" />
                          Nuevo cliente
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border/50 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Cuenta</TableHead>
                              <TableHead>Región</TableHead>
                              <TableHead>Alcance</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clients.map((c) => (
                              <TableRow key={c.id}>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{c.name}</span>
                                    {c.contact_email && (
                                      <span className="text-xs text-muted-foreground">
                                        {c.contact_email}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {c.aws_account_id ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs">{c.default_region}</TableCell>
                                <TableCell className="text-xs">
                                  {c.policy_scope === "security_only"
                                    ? "Solo seguridad"
                                    : "Lectura completa"}
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {statusBadge(c.connection_status)}
                                    {c.last_error && c.connection_status === "failed" && (
                                      <p className="text-xs text-muted-foreground max-w-[220px] truncate">
                                        {c.last_error}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Probar conexión"
                                      onClick={() => handleTest(c)}
                                      disabled={busy || !c.role_arn}
                                    >
                                      {busy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <PlugZap className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Ver y editar la conexión"
                                      onClick={() => openExisting(c)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Renovar identificador secreto"
                                      onClick={() => rotateExternalId(c.id)}
                                      disabled={busy}
                                    >
                                      <KeyRound className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Ver accesos de este cliente"
                                      onClick={() => {
                                        setLogClientId(c.id);
                                        setTab("access");
                                      }}
                                    >
                                      <Clock className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Eliminar cliente"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => setDeleteTarget(c)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="identity">
                <AuditorIdentityCard
                  auditor={auditor}
                  busy={busy}
                  onSave={saveAuditor}
                  onVerify={verifyAuditor}
                />
              </TabsContent>

              <TabsContent value="access" className="space-y-4">
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">Registro de accesos</CardTitle>
                      <CardDescription>
                        {logClientId
                          ? clients.find((c) => c.id === logClientId)?.name ?? "Cliente"
                          : "Todos los clientes"}
                      </CardDescription>
                    </div>
                    {logClientId && (
                      <Button variant="outline" size="sm" onClick={() => setLogClientId(undefined)}>
                        Ver todos
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ClientAccessLog clientId={logClientId} fetchAccessLog={fetchAccessLog} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <ClientOnboardingWizard
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) {
            setEditing(null);
            reloadClients();
          }
        }}
        auditorRoleArn={auditor?.auditor_role_arn ?? null}
        auditorVerified={!!auditor?.verified}
        existingClient={editing}
        busy={busy}
        onCreate={createClient}
        onUpdate={updateClient}
        onTest={testConnection}
        onDone={async () => {
          await reloadClients();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán sus datos guardados en Clodaro. El registro de accesos se conserva. En la
              cuenta del cliente no se cambia nada: si quieres cortar el acceso del todo, pídele que
              borre el rol.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
