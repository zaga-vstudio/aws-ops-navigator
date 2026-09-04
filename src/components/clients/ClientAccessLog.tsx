import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, History } from "lucide-react";
import { AccessLogEvent } from "@/hooks/useClients";

interface Props {
  clientId?: string;
  fetchAccessLog: (clientId?: string) => Promise<AccessLogEvent[]>;
}

const outcomeBadge = (outcome: AccessLogEvent["outcome"]) => {
  switch (outcome) {
    case "success":
      return <Badge className="bg-success/10 text-success border-success/20">Correcto</Badge>;
    case "denied":
      return <Badge variant="outline" className="text-warning border-warning/30">Denegado</Badge>;
    default:
      return <Badge variant="destructive">Error</Badge>;
  }
};

export function ClientAccessLog({ clientId, fetchAccessLog }: Props) {
  const [events, setEvents] = useState<AccessLogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setEvents(await fetchAccessLog(clientId));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada entrada y cada intento fallido en las cuentas de tus clientes. Este historial no se
          puede modificar ni borrar.
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <History className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no hay accesos registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Quién</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Región</TableHead>
                <TableHead>Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(e.created_at).toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="text-sm">{e.client_name_snapshot ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.actor_email ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{e.operation}</TableCell>
                  <TableCell className="text-xs">{e.region ?? "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {outcomeBadge(e.outcome)}
                      {e.error_message && (
                        <p className="text-xs text-muted-foreground max-w-[280px] truncate">
                          {e.error_message}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
