import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, ArrowRight, Copy, Check, Loader2, PlugZap, AlertTriangle, PartyPopper,
} from "lucide-react";
import { Client, PolicyScope, TestConnectionResult } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-south-2",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "sa-east-1",
];

const ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@/-]+$/;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditorRoleArn: string | null;
  auditorVerified: boolean;
  existingClient?: Client | null;
  busy: boolean;
  onCreate: (client: Partial<Client>) => Promise<Client | null>;
  onUpdate: (clientId: string, client: Partial<Client>) => Promise<Client | null>;
  onTest: (clientId: string) => Promise<TestConnectionResult>;
  onDone: () => void;
}

function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? <Check className="h-4 w-4 mr-2 text-success" /> : <Copy className="h-4 w-4 mr-2" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function ClientOnboardingWizard({
  open, onOpenChange, auditorRoleArn, auditorVerified, existingClient,
  busy, onCreate, onUpdate, onTest, onDone,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [client, setClient] = useState<Client | null>(null);
  const [result, setResult] = useState<TestConnectionResult | null>(null);
  const [form, setForm] = useState({
    name: "",
    contact_email: "",
    aws_account_id: "",
    default_region: "eu-west-1",
    policy_scope: "full_readonly" as PolicyScope,
    notes: "",
    role_arn: "",
  });

  useEffect(() => {
    if (!open) return;
    setResult(null);
    if (existingClient) {
      setClient(existingClient);
      setForm({
        name: existingClient.name,
        contact_email: existingClient.contact_email ?? "",
        aws_account_id: existingClient.aws_account_id ?? "",
        default_region: existingClient.default_region,
        policy_scope: existingClient.policy_scope,
        notes: existingClient.notes ?? "",
        role_arn: existingClient.role_arn ?? "",
      });
      setStep(existingClient.role_arn ? 4 : 2);
    } else {
      setClient(null);
      setStep(1);
      setForm({
        name: "", contact_email: "", aws_account_id: "",
        default_region: "eu-west-1", policy_scope: "full_readonly", notes: "", role_arn: "",
      });
    }
  }, [open, existingClient]);

  const policies =
    form.policy_scope === "security_only" ? ["SecurityAudit"] : ["SecurityAudit", "ViewOnlyAccess"];

  const trustPolicy = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: auditorRoleArn ?? "arn:aws:iam::<tu-cuenta>:role/Clodaro-Auditor" },
          Action: "sts:AssumeRole",
          Condition: { StringEquals: { "sts:ExternalId": client?.external_id ?? "<identificador>" } },
        },
      ],
    },
    null,
    2
  );

  const saveStep1 = async () => {
    if (!form.name.trim()) {
      toast({ title: "Falta el nombre del cliente", variant: "destructive" });
      return;
    }
    if (form.aws_account_id && !/^\d{12}$/.test(form.aws_account_id)) {
      toast({ title: "El número de cuenta debe tener 12 dígitos", variant: "destructive" });
      return;
    }
    const payload: Partial<Client> = {
      name: form.name.trim(),
      contact_email: form.contact_email.trim() || null,
      aws_account_id: form.aws_account_id.trim() || null,
      default_region: form.default_region,
      policy_scope: form.policy_scope,
      notes: form.notes.trim() || null,
    };
    const saved = client ? await onUpdate(client.id, payload) : await onCreate(payload);
    if (saved) {
      setClient(saved);
      setStep(2);
    }
  };

  const saveRoleArn = async () => {
    if (!client) return;
    if (!ARN_RE.test(form.role_arn.trim())) {
      toast({
        title: "Identificador de rol no válido",
        description: "Debe empezar por arn:aws:iam:: y terminar con el nombre del rol.",
        variant: "destructive",
      });
      return;
    }
    const saved = await onUpdate(client.id, { role_arn: form.role_arn.trim() });
    if (saved) {
      setClient(saved);
      setStep(4);
    }
  };

  const runTest = async () => {
    if (!client) return;
    const res = await onTest(client.id);
    setResult(res);
    if (res.success) {
      toast({ title: "Conexión correcta", description: `Cuenta ${res.awsAccountId ?? ""}` });
      onDone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existingClient ? "Conexión del cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            Paso {step} de 4 — conecta la cuenta de AWS de tu cliente en modo solo lectura.
          </DialogDescription>
        </DialogHeader>

        <Progress value={(step / 4) * 100} className="h-2" />

        {!auditorVerified && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Tu identidad de auditoría todavía no está verificada. Puedes preparar el cliente, pero
              la prueba de conexión fallará hasta que la verifiques.
            </AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-name">Nombre del cliente</Label>
                <Input
                  id="c-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme S.L."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">Email de contacto</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="tecnico@acme.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-account">Número de cuenta de AWS (12 dígitos)</Label>
                <Input
                  id="c-account"
                  value={form.aws_account_id}
                  onChange={(e) => setForm({ ...form, aws_account_id: e.target.value.replace(/\D/g, "").slice(0, 12) })}
                  placeholder="123456789012"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Región principal</Label>
                <Select
                  value={form.default_region}
                  onValueChange={(v) => setForm({ ...form, default_region: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>¿Qué podrá revisar Clodaro?</Label>
              <RadioGroup
                value={form.policy_scope}
                onValueChange={(v) => setForm({ ...form, policy_scope: v as PolicyScope })}
                className="space-y-2"
              >
                <label className="flex gap-3 items-start rounded-lg border border-border/50 p-3 cursor-pointer hover:bg-accent/40">
                  <RadioGroupItem value="full_readonly" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Lectura completa</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20">Recomendado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seguridad, inventario de servidores y bases de datos, redes y costes. Solo
                      lectura: no puede cambiar nada.
                    </p>
                  </div>
                </label>
                <label className="flex gap-3 items-start rounded-lg border border-border/50 p-3 cursor-pointer hover:bg-accent/40">
                  <RadioGroupItem value="security_only" className="mt-1" />
                  <div>
                    <span className="text-sm font-medium">Solo seguridad</span>
                    <p className="text-xs text-muted-foreground">
                      El informe de costes e inventario quedará incompleto.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="c-notes">Notas internas</Label>
              <Textarea
                id="c-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Contacto técnico, fechas de auditoría, etc."
                rows={2}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envía esto a tu cliente. Es el permiso que autoriza a Clodaro —y solo a Clodaro— a
              consultar su cuenta.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Identificador secreto de este cliente</Label>
                <CopyButton value={client?.external_id ?? ""} />
              </div>
              <Input readOnly value={client?.external_id ?? ""} className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Texto de autorización (política de confianza)</Label>
                <CopyButton value={trustPolicy} />
              </div>
              <pre className="rounded-lg border border-border/50 bg-muted/40 p-3 text-xs overflow-x-auto">
                {trustPolicy}
              </pre>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pasos que debe seguir tu cliente en su consola de AWS:
            </p>
            <ol className="space-y-2 text-sm list-decimal pl-5">
              <li>Entrar en <span className="font-medium">IAM → Roles → Crear rol</span>.</li>
              <li>
                Elegir <span className="font-medium">Política de confianza personalizada</span> y
                pegar el texto del paso anterior.
              </li>
              <li>
                Adjuntar {policies.length === 2 ? "las políticas" : "la política"}{" "}
                {policies.map((p, i) => (
                  <span key={p}>
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{p}</span>
                    {i < policies.length - 1 ? " y " : ""}
                  </span>
                ))}
                .
              </li>
              <li>
                Poner nombre al rol (por ejemplo{" "}
                <span className="font-mono text-xs">Clodaro-Audit</span>) y crearlo.
              </li>
              <li>Copiar el identificador del rol creado y pegártelo aquí abajo.</li>
            </ol>
            <div className="space-y-2">
              <Label htmlFor="c-arn">Identificador del rol del cliente</Label>
              <Input
                id="c-arn"
                value={form.role_arn}
                onChange={(e) => setForm({ ...form, role_arn: e.target.value })}
                placeholder="arn:aws:iam::123456789012:role/Clodaro-Audit"
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Comprobamos que podemos entrar en la cuenta de{" "}
              <span className="font-medium">{client?.name}</span> y que tiene los permisos correctos.
            </p>
            <Button onClick={runTest} disabled={busy || !client?.role_arn}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlugZap className="h-4 w-4 mr-2" />}
              Probar conexión
            </Button>

            {result?.success && (
              <Alert className="border-success/40">
                <PartyPopper className="h-4 w-4 text-success" />
                <AlertDescription className="text-xs space-y-1">
                  <p>Conexión correcta con la cuenta {result.awsAccountId}.</p>
                  {result.missingPolicies && result.missingPolicies.length > 0 && (
                    <p className="text-warning">
                      Faltan permisos: {result.missingPolicies.join(", ")}. Parte del informe
                      quedará incompleta.
                    </p>
                  )}
                  {result.sessionExpiry && (
                    <p className="text-muted-foreground">
                      Sesión válida hasta {new Date(result.sessionExpiry).toLocaleTimeString("es-ES")}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {result && !result.success && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{result.error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1 || busy}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atrás
          </Button>

          {step === 1 && (
            <Button size="sm" onClick={saveStep1} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar y continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {step === 2 && (
            <Button size="sm" onClick={() => setStep(3)}>
              Siguiente <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {step === 3 && (
            <Button size="sm" onClick={saveRoleArn} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar rol
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {step === 4 && (
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
