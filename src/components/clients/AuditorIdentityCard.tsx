import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, ShieldAlert, Loader2, Save, Check } from "lucide-react";
import { AuditorIdentity } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

interface Props {
  auditor: AuditorIdentity | null;
  busy: boolean;
  onSave: (arn: string) => Promise<AuditorIdentity | null>;
  onVerify: () => Promise<{ verified: boolean; error?: string }>;
}

export function AuditorIdentityCard({ auditor, busy, onSave, onVerify }: Props) {
  const { toast } = useToast();
  const [arn, setArn] = useState("");

  useEffect(() => {
    setArn(auditor?.auditor_role_arn ?? "");
  }, [auditor?.auditor_role_arn]);

  const handleSave = async () => {
    const saved = await onSave(arn.trim());
    if (saved) toast({ title: "Identidad guardada", description: "Ahora comprueba que funciona." });
  };

  const handleVerify = async () => {
    const res = await onVerify();
    if (res.verified) {
      toast({ title: "Identidad verificada", description: "Ya puedes conectar clientes." });
    } else {
      toast({
        title: "No se pudo verificar",
        description: res.error ?? "Revisa el rol y su política de confianza.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Tu identidad de auditoría
            </CardTitle>
            <CardDescription>
              Es la identidad fija con la que Clodaro entra en las cuentas de tus clientes. Se
              configura una sola vez: así puedes cambiar tus propias claves sin pedirle nada a
              ningún cliente.
            </CardDescription>
          </div>
          {auditor?.verified ? (
            <Badge className="bg-success/10 text-success border-success/20 shrink-0">
              <Check className="h-3 w-3 mr-1" /> Verificada
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-warning border-warning/30">
              <ShieldAlert className="h-3 w-3 mr-1" /> Sin verificar
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="auditor-arn">Identificador del rol Clodaro-Auditor (en tu cuenta)</Label>
          <Input
            id="auditor-arn"
            placeholder="arn:aws:iam::123456789012:role/Clodaro-Auditor"
            value={arn}
            onChange={(e) => setArn(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Crea en tu propia cuenta un rol llamado <span className="font-mono">Clodaro-Auditor</span>{" "}
            que confíe en tu usuario, y pega aquí su identificador.
          </p>
        </div>

        {auditor?.aws_account_id && (
          <p className="text-xs text-muted-foreground">
            Cuenta detectada: <span className="font-mono">{auditor.aws_account_id}</span>
            {auditor.last_verified_at &&
              ` · última comprobación ${new Date(auditor.last_verified_at).toLocaleString("es-ES")}`}
          </p>
        )}

        {auditor?.last_error && !auditor.verified && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{auditor.last_error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={busy || !arn.trim()} size="sm">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
          <Button
            onClick={handleVerify}
            disabled={busy || !auditor?.auditor_role_arn}
            size="sm"
            variant="outline"
          >
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Comprobar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
