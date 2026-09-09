import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck, Play, FileDown, Loader2, CheckCircle2, XCircle,
  MinusCircle, AlertTriangle, Trash2, History,
} from "lucide-react";
import { useCISAudit, CISAuditRun, CISCheckResult, CISSeverity, CISStatus } from "@/hooks/useCISAudit";
import { useClientContext } from "@/contexts/ClientContext";
import { generateCISReportPdf } from "@/lib/cisReportPdf";

const SEVERITY_LABEL: Record<CISSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SEVERITY_ORDER: CISSeverity[] = ["critical", "high", "medium", "low"];

const statusIcon = (status: CISStatus) => {
  switch (status) {
    case "PASS":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "FAIL":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "ERROR":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    default:
      return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
  }
};

const severityBadge = (severity: CISSeverity) => (
  <Badge
    variant="outline"
    className={
      severity === "critical"
        ? "border-destructive/30 text-destructive"
        : severity === "high"
          ? "border-warning/30 text-warning"
          : "text-muted-foreground"
    }
  >
    {SEVERITY_LABEL[severity]}
  </Badge>
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export default function CISAudit() {
  const { activeClient } = useClientContext();
  const { runs, loading, running, runAudit, deleteRun } = useCISAudit();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected: CISAuditRun | null = useMemo(() => {
    if (runs.length === 0) return null;
    return runs.find((r) => r.id === selectedId) ?? runs[0];
  }, [runs, selectedId]);

  const subject = activeClient?.name ?? "Mi cuenta AWS";

  const sections = useMemo(() => {
    if (!selected) return [];
    const map = new Map<string, CISCheckResult[]>();
    for (const check of selected.results) {
      const list = map.get(check.section) ?? [];
      list.push(check);
      map.set(check.section, list);
    }
    return Array.from(map.entries());
  }, [selected]);

  const failedBySeverity = useMemo(() => {
    const failed = selected?.results.filter((r) => r.status === "FAIL") ?? [];
    return SEVERITY_ORDER.map((sev) => ({
      severity: sev,
      count: failed.filter((r) => r.severity === sev).length,
    }));
  }, [selected]);

  const handleRun = async () => {
    const run = await runAudit();
    if (run) setSelectedId(run.id);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                    Auditoría CIS
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Controles CIS AWS Foundations ejecutados en modo lectura sobre {subject}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected && (
                  <Button variant="outline" onClick={() => generateCISReportPdf(selected)}>
                    <FileDown className="h-4 w-4 mr-2" />
                    Descargar informe PDF
                  </Button>
                )}
                <Button onClick={handleRun} disabled={running}>
                  {running
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Play className="h-4 w-4 mr-2" />}
                  {running ? "Ejecutando…" : "Ejecutar auditoría"}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : !selected ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Todavía no hay auditorías para {subject}</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Ejecuta la primera auditoría para evaluar los controles CIS de esta cuenta.
                    Solo se realizan operaciones de lectura.
                  </p>
                  <Button onClick={handleRun} disabled={running}>
                    <Play className="h-4 w-4 mr-2" /> Ejecutar auditoría
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Cumplimiento</CardDescription>
                      <CardTitle className="text-3xl">{selected.score}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress
                        value={selected.score}
                        className={`h-2 ${
                          selected.score >= 80 ? "[&>div]:bg-success"
                            : selected.score >= 50 ? "[&>div]:bg-warning"
                              : "[&>div]:bg-destructive"
                        }`}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(selected.created_at)} · {selected.region}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Correctos</CardDescription>
                      <CardTitle className="text-3xl text-success">{selected.passed_count}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      Controles superados
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Incumplimientos</CardDescription>
                      <CardTitle className="text-3xl text-destructive">{selected.failed_count}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {failedBySeverity.filter((s) => s.count > 0).map((s) => (
                        <span key={s.severity} className="text-xs">
                          {SEVERITY_LABEL[s.severity]}: {s.count}
                        </span>
                      ))}
                      {selected.failed_count === 0 && (
                        <span className="text-xs text-muted-foreground">Sin hallazgos</span>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>No aplicables / sin datos</CardDescription>
                      <CardTitle className="text-3xl">
                        {selected.not_applicable_count} / {selected.error_count}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                      {selected.aws_account_id
                        ? `Cuenta ${selected.aws_account_id}`
                        : "Cuenta AWS no identificada"}
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="results">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <TabsList>
                      <TabsTrigger value="results">Resultados</TabsTrigger>
                      <TabsTrigger value="history">
                        <History className="h-4 w-4 mr-1" /> Historial ({runs.length})
                      </TabsTrigger>
                    </TabsList>
                    {runs.length > 1 && (
                      <Select value={selected.id} onValueChange={setSelectedId}>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {runs.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {formatDate(r.created_at)} — {r.score}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <TabsContent value="results" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {cisScopeTitle(selected.results.length, selected.benchmark)}
                        </CardTitle>
                        <CardDescription>
                          Detalle por sección de los controles evaluados
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground space-y-2">
                          <p>{cisRegionNotice(selected.region)}</p>
                          <p>
                            <span className="font-medium text-foreground">
                              Áreas del benchmark no cubiertas todavía:{" "}
                            </span>
                            {CIS_UNCOVERED_AREAS.join(" · ")}
                          </p>
                        </div>
                        <Accordion type="multiple" defaultValue={sections.map(([s]) => s)}>
                          {sections.map(([section, checks]) => (
                            <AccordionItem key={section} value={section}>
                              <AccordionTrigger>
                                <span className="flex items-center gap-3 text-left">
                                  {section}
                                  <Badge variant="outline">
                                    {checks.filter((c) => c.status === "FAIL").length} incumplen
                                  </Badge>
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3">
                                {checks.map((check) => (
                                  <div
                                    key={check.id}
                                    className={`p-4 rounded-lg border ${
                                      check.status === "FAIL"
                                        ? "border-destructive/20 bg-destructive/5"
                                        : check.status === "PASS"
                                          ? "border-success/20 bg-success/5"
                                          : "border-muted bg-muted/40"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start gap-3">
                                        {statusIcon(check.status)}
                                        <div>
                                          <p className="font-medium">
                                            <span className="text-muted-foreground mr-2">{check.id}</span>
                                            {check.title}
                                          </p>
                                          <p className="text-sm text-muted-foreground mt-1">{check.summary}</p>
                                          {check.evidence.length > 0 && (
                                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground font-mono">
                                              {check.evidence.slice(0, 8).map((e, i) => (
                                                <li key={i}>· {e}</li>
                                              ))}
                                            </ul>
                                          )}
                                          {check.status === "FAIL" && (
                                            <p className="text-xs mt-2">
                                              <span className="font-medium">Remediación: </span>
                                              {check.remediation}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {severityBadge(check.severity)}
                                    </div>
                                  </div>
                                ))}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Historial de auditorías</CardTitle>
                        <CardDescription>Últimas 50 ejecuciones de {subject}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Región</TableHead>
                              <TableHead className="text-right">Cumplimiento</TableHead>
                              <TableHead className="text-right">Correctos</TableHead>
                              <TableHead className="text-right">Incumplen</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {runs.map((r) => (
                              <TableRow key={r.id}>
                                <TableCell>{formatDate(r.created_at)}</TableCell>
                                <TableCell>{r.region}</TableCell>
                                <TableCell className="text-right font-medium">{r.score}%</TableCell>
                                <TableCell className="text-right text-success">{r.passed_count}</TableCell>
                                <TableCell className="text-right text-destructive">{r.failed_count}</TableCell>
                                <TableCell className="text-right space-x-1">
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(r.id)}>
                                    Ver
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => generateCISReportPdf(r)}
                                  >
                                    <FileDown className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteRun(r.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
