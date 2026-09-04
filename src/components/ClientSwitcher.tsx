import { useClientContext } from "@/contexts/ClientContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Home, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ClientSwitcher() {
  const { activeClient, clients, setActiveClient } = useClientContext();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {activeClient ? (
            <Building2 className="h-4 w-4 text-primary" />
          ) : (
            <Home className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="max-w-[140px] truncate">
            {activeClient ? activeClient.name : "Mi cuenta"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 bg-popover z-50">
        <DropdownMenuLabel>Cuenta que estás viendo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setActiveClient(null)}
          className={!activeClient ? "bg-accent" : ""}
        >
          <Home className="h-4 w-4 mr-2 text-muted-foreground" />
          Mi cuenta
        </DropdownMenuItem>
        {clients.length > 0 && <DropdownMenuSeparator />}
        {clients.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => setActiveClient(c)}
            className={activeClient?.id === c.id ? "bg-accent" : ""}
          >
            {c.connection_status === "connected" ? (
              <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2 text-warning" />
            )}
            <div className="flex flex-col">
              <span className="text-sm">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.default_region}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/clients")}>
          <Plus className="h-4 w-4 mr-2" />
          Gestionar clientes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
