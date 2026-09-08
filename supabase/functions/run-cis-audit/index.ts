import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  IAMClient,
  GetAccountSummaryCommand,
  GetAccountPasswordPolicyCommand,
  ListUsersCommand,
  ListMFADevicesCommand,
  ListAccessKeysCommand,
} from "npm:@aws-sdk/client-iam";
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeVpcsCommand,
  DescribeFlowLogsCommand,
  DescribeInstancesCommand,
  GetEbsEncryptionByDefaultCommand,
} from "npm:@aws-sdk/client-ec2";
import { RDSClient, DescribeDBInstancesCommand } from "npm:@aws-sdk/client-rds";
import { CloudTrailClient, DescribeTrailsCommand } from "npm:@aws-sdk/client-cloudtrail";
import {
  S3Client,
  ListBucketsCommand,
  GetPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
} from "npm:@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "npm:@aws-sdk/client-sts";
import { resolveCredentials } from "../_shared/resolve-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BENCHMARK = "CIS AWS Foundations Benchmark v3.0.0";

type Status = "PASS" | "FAIL" | "NOT_APPLICABLE" | "ERROR";
type Severity = "critical" | "high" | "medium" | "low";

interface CheckResult {
  id: string;
  title: string;
  section: string;
  severity: Severity;
  status: Status;
  summary: string;
  remediation: string;
  evidence: string[];
}

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (d?: Date | string | null) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No authorization header" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    let roleName: string | undefined;
    let clientId: string | undefined;
    try {
      if (req.method === "POST") {
        const body = await req.json();
        roleName = typeof body.roleName === "string" ? body.roleName : undefined;
        clientId = typeof body.clientId === "string" ? body.clientId : undefined;
      }
    } catch { /* no body */ }

    const { data: credentials, error: credError } = await supabaseClient
      .rpc("get_user_aws_credentials", { user_id_param: user.id });

    if (credError || !credentials || credentials.length === 0) {
      return json({ error: "AWS credentials not configured" }, 400);
    }

    const { access_key_id, secret_access_key, region } = credentials[0];
    const ownRegion = region || "us-east-1";

    const resolved = await resolveCredentials(
      supabaseClient,
      user.id,
      user.email || "",
      { accessKeyId: access_key_id, secretAccessKey: secret_access_key },
      ownRegion,
      roleName,
      clientId,
    );

    const creds = resolved.credentials;
    const awsRegion = resolved.region || ownRegion;
    const clientName = resolved.clientName ?? null;

    const iam = new IAMClient({ region: awsRegion, credentials: creds });
    const ec2 = new EC2Client({ region: awsRegion, credentials: creds });
    const rds = new RDSClient({ region: awsRegion, credentials: creds });
    const trail = new CloudTrailClient({ region: awsRegion, credentials: creds });
    const s3 = new S3Client({ region: awsRegion, credentials: creds });
    const sts = new STSClient({ region: awsRegion, credentials: creds });

    let awsAccountId: string | null = null;
    try {
      const id = await sts.send(new GetCallerIdentityCommand({}));
      awsAccountId = id.Account ?? null;
    } catch { /* keep null */ }

    const results: CheckResult[] = [];
    const errors: { check: string; message: string }[] = [];

    const push = (r: CheckResult) => results.push(r);
    const fail = (base: Omit<CheckResult, "status" | "summary" | "evidence">, message: string) => {
      errors.push({ check: base.id, message });
      push({ ...base, status: "ERROR", summary: `No se pudo comprobar: ${message}`, evidence: [] });
    };

    // ---------- Sección 1: Identity and Access Management ----------
    const rootMeta = {
      id: "1.5",
      title: "MFA habilitado en la cuenta root",
      section: "1. Gestión de identidades y accesos",
      severity: "critical" as Severity,
      remediation:
        "Inicia sesión como root y activa un dispositivo MFA en IAM > Credenciales de seguridad.",
    };
    const rootKeysMeta = {
      id: "1.4",
      title: "La cuenta root no tiene claves de acceso",
      section: "1. Gestión de identidades y accesos",
      severity: "critical" as Severity,
      remediation: "Elimina las claves de acceso de root y usa usuarios o roles IAM.",
    };
    try {
      const summary = await iam.send(new GetAccountSummaryCommand({}));
      const m = summary.SummaryMap ?? {};
      const rootMfa = Number(m["AccountMFAEnabled"] ?? 0) === 1;
      push({
        ...rootMeta,
        status: rootMfa ? "PASS" : "FAIL",
        summary: rootMfa ? "La cuenta root tiene MFA activo." : "La cuenta root NO tiene MFA activo.",
        evidence: [`AccountMFAEnabled = ${m["AccountMFAEnabled"] ?? 0}`],
      });
      const rootKeys = Number(m["AccountAccessKeysPresent"] ?? 0);
      push({
        ...rootKeysMeta,
        status: rootKeys === 0 ? "PASS" : "FAIL",
        summary: rootKeys === 0
          ? "No existen claves de acceso de root."
          : "Existen claves de acceso asociadas a root.",
        evidence: [`AccountAccessKeysPresent = ${rootKeys}`],
      });
    } catch (e) {
      fail(rootMeta, (e as Error).message);
      fail(rootKeysMeta, (e as Error).message);
    }

    const pwMeta = {
      id: "1.8",
      title: "Política de contraseñas robusta (mínimo 14 caracteres)",
      section: "1. Gestión de identidades y accesos",
      severity: "medium" as Severity,
      remediation: "Configura una política de contraseñas de cuenta con longitud mínima de 14 caracteres.",
    };
    try {
      const pw = await iam.send(new GetAccountPasswordPolicyCommand({}));
      const len = pw.PasswordPolicy?.MinimumPasswordLength ?? 0;
      const reuse = pw.PasswordPolicy?.PasswordReusePrevention ?? 0;
      push({
        ...pwMeta,
        status: len >= 14 ? "PASS" : "FAIL",
        summary: `Longitud mínima configurada: ${len} caracteres.`,
        evidence: [`MinimumPasswordLength = ${len}`, `PasswordReusePrevention = ${reuse}`],
      });
    } catch (e) {
      const msg = (e as Error).name === "NoSuchEntityException"
        ? "No existe política de contraseñas en la cuenta."
        : null;
      if (msg) {
        push({ ...pwMeta, status: "FAIL", summary: msg, evidence: ["Sin política de contraseñas"] });
      } else {
        fail(pwMeta, (e as Error).message);
      }
    }

    const userMfaMeta = {
      id: "1.10",
      title: "MFA en todos los usuarios IAM con consola",
      section: "1. Gestión de identidades y accesos",
      severity: "high" as Severity,
      remediation: "Activa MFA para cada usuario IAM que pueda iniciar sesión en la consola.",
    };
    const keyRotationMeta = {
      id: "1.14",
      title: "Claves de acceso rotadas en los últimos 90 días",
      section: "1. Gestión de identidades y accesos",
      severity: "medium" as Severity,
      remediation: "Rota o desactiva las claves de acceso con más de 90 días de antigüedad.",
    };
    try {
      const users = await iam.send(new ListUsersCommand({}));
      const list = users.Users ?? [];
      if (list.length === 0) {
        push({
          ...userMfaMeta,
          status: "NOT_APPLICABLE",
          summary: "No hay usuarios IAM en la cuenta.",
          evidence: [],
        });
        push({
          ...keyRotationMeta,
          status: "NOT_APPLICABLE",
          summary: "No hay usuarios IAM con claves de acceso.",
          evidence: [],
        });
      } else {
        const noMfa: string[] = [];
        const oldKeys: string[] = [];
        for (const u of list) {
          const name = u.UserName!;
          try {
            const mfa = await iam.send(new ListMFADevicesCommand({ UserName: name }));
            if ((mfa.MFADevices ?? []).length === 0) noMfa.push(name);
          } catch { /* ignore per-user */ }
          try {
            const keys = await iam.send(new ListAccessKeysCommand({ UserName: name }));
            for (const k of keys.AccessKeyMetadata ?? []) {
              const age = daysSince(k.CreateDate as unknown as Date);
              if (k.Status === "Active" && age !== null && age > 90) {
                oldKeys.push(`${name}: ${k.AccessKeyId} (${age} días)`);
              }
            }
          } catch { /* ignore per-user */ }
        }
        push({
          ...userMfaMeta,
          status: noMfa.length === 0 ? "PASS" : "FAIL",
          summary: noMfa.length === 0
            ? `Los ${list.length} usuarios IAM tienen MFA.`
            : `${noMfa.length} de ${list.length} usuarios IAM sin MFA.`,
          evidence: noMfa.map((n) => `Sin MFA: ${n}`),
        });
        push({
          ...keyRotationMeta,
          status: oldKeys.length === 0 ? "PASS" : "FAIL",
          summary: oldKeys.length === 0
            ? "Ninguna clave activa supera los 90 días."
            : `${oldKeys.length} claves activas con más de 90 días.`,
          evidence: oldKeys,
        });
      }
    } catch (e) {
      fail(userMfaMeta, (e as Error).message);
      fail(keyRotationMeta, (e as Error).message);
    }

    // ---------- Sección 2: Almacenamiento ----------
    const s3PublicMeta = {
      id: "2.1.4",
      title: "Buckets S3 con acceso público bloqueado",
      section: "2. Almacenamiento",
      severity: "critical" as Severity,
      remediation: "Activa Block Public Access a nivel de bucket y de cuenta.",
    };
    const s3EncMeta = {
      id: "2.1.1",
      title: "Cifrado en reposo en todos los buckets S3",
      section: "2. Almacenamiento",
      severity: "high" as Severity,
      remediation: "Activa el cifrado por defecto (SSE-S3 o SSE-KMS) en cada bucket.",
    };
    const s3VerMeta = {
      id: "2.1.3",
      title: "Versionado habilitado en buckets S3",
      section: "2. Almacenamiento",
      severity: "low" as Severity,
      remediation: "Habilita el versionado de objetos en los buckets con datos relevantes.",
    };
    try {
      const buckets = (await s3.send(new ListBucketsCommand({}))).Buckets ?? [];
      if (buckets.length === 0) {
        for (const meta of [s3PublicMeta, s3EncMeta, s3VerMeta]) {
          push({ ...meta, status: "NOT_APPLICABLE", summary: "No hay buckets S3 en la cuenta.", evidence: [] });
        }
      } else {
        const notBlocked: string[] = [];
        const notEncrypted: string[] = [];
        const notVersioned: string[] = [];
        for (const b of buckets.slice(0, 100)) {
          const name = b.Name!;
          try {
            const pab = await s3.send(new GetPublicAccessBlockCommand({ Bucket: name }));
            const c = pab.PublicAccessBlockConfiguration ?? {};
            if (!(c.BlockPublicAcls && c.BlockPublicPolicy && c.IgnorePublicAcls && c.RestrictPublicBuckets)) {
              notBlocked.push(name);
            }
          } catch {
            notBlocked.push(name);
          }
          try {
            await s3.send(new GetBucketEncryptionCommand({ Bucket: name }));
          } catch {
            notEncrypted.push(name);
          }
          try {
            const v = await s3.send(new GetBucketVersioningCommand({ Bucket: name }));
            if (v.Status !== "Enabled") notVersioned.push(name);
          } catch { /* ignore */ }
        }
        push({
          ...s3PublicMeta,
          status: notBlocked.length === 0 ? "PASS" : "FAIL",
          summary: notBlocked.length === 0
            ? `Los ${buckets.length} buckets bloquean el acceso público.`
            : `${notBlocked.length} buckets sin bloqueo completo de acceso público.`,
          evidence: notBlocked.map((n) => `Bucket expuesto o sin configuración: ${n}`),
        });
        push({
          ...s3EncMeta,
          status: notEncrypted.length === 0 ? "PASS" : "FAIL",
          summary: notEncrypted.length === 0
            ? "Todos los buckets tienen cifrado por defecto."
            : `${notEncrypted.length} buckets sin cifrado por defecto.`,
          evidence: notEncrypted.map((n) => `Sin cifrado: ${n}`),
        });
        push({
          ...s3VerMeta,
          status: notVersioned.length === 0 ? "PASS" : "FAIL",
          summary: notVersioned.length === 0
            ? "Todos los buckets tienen versionado."
            : `${notVersioned.length} buckets sin versionado.`,
          evidence: notVersioned.map((n) => `Sin versionado: ${n}`),
        });
      }
    } catch (e) {
      fail(s3PublicMeta, (e as Error).message);
      fail(s3EncMeta, (e as Error).message);
      fail(s3VerMeta, (e as Error).message);
    }

    const ebsMeta = {
      id: "2.2.1",
      title: "Cifrado EBS por defecto activado en la región",
      section: "2. Almacenamiento",
      severity: "high" as Severity,
      remediation: "Activa 'EBS encryption by default' en EC2 > Configuración de la cuenta.",
    };
    try {
      const ebs = await ec2.send(new GetEbsEncryptionByDefaultCommand({}));
      push({
        ...ebsMeta,
        status: ebs.EbsEncryptionByDefault ? "PASS" : "FAIL",
        summary: ebs.EbsEncryptionByDefault
          ? `Cifrado EBS por defecto activo en ${awsRegion}.`
          : `Cifrado EBS por defecto desactivado en ${awsRegion}.`,
        evidence: [`EbsEncryptionByDefault = ${ebs.EbsEncryptionByDefault}`],
      });
    } catch (e) {
      fail(ebsMeta, (e as Error).message);
    }

    // ---------- Sección 3: Registro y monitorización ----------
    const trailMeta = {
      id: "3.1",
      title: "CloudTrail activo en todas las regiones",
      section: "3. Registro y monitorización",
      severity: "critical" as Severity,
      remediation: "Crea o modifica un trail con 'Aplicar a todas las regiones' y validación de logs.",
    };
    const trailValMeta = {
      id: "3.2",
      title: "Validación de integridad de logs de CloudTrail",
      section: "3. Registro y monitorización",
      severity: "medium" as Severity,
      remediation: "Activa 'Log file validation' en los trails existentes.",
    };
    try {
      const trails = (await trail.send(new DescribeTrailsCommand({}))).trailList ?? [];
      const multi = trails.filter((t) => t.IsMultiRegionTrail);
      push({
        ...trailMeta,
        status: multi.length > 0 ? "PASS" : "FAIL",
        summary: multi.length > 0
          ? `${multi.length} trail(s) multirregión configurado(s).`
          : "No existe ningún trail multirregión.",
        evidence: trails.map((t) => `${t.Name}: multirregión=${t.IsMultiRegionTrail}`),
      });
      const noVal = trails.filter((t) => !t.LogFileValidationEnabled).map((t) => t.Name ?? "");
      push({
        ...trailValMeta,
        status: trails.length === 0 ? "FAIL" : noVal.length === 0 ? "PASS" : "FAIL",
        summary: trails.length === 0
          ? "No hay trails que validar."
          : noVal.length === 0
            ? "Todos los trails validan la integridad de sus logs."
            : `${noVal.length} trail(s) sin validación de integridad.`,
        evidence: noVal.map((n) => `Sin validación: ${n}`),
      });
    } catch (e) {
      fail(trailMeta, (e as Error).message);
      fail(trailValMeta, (e as Error).message);
    }

    const flowMeta = {
      id: "3.9",
      title: "VPC Flow Logs habilitados en todas las VPC",
      section: "3. Registro y monitorización",
      severity: "medium" as Severity,
      remediation: "Crea flow logs para cada VPC con destino CloudWatch Logs o S3.",
    };
    try {
      const vpcs = (await ec2.send(new DescribeVpcsCommand({}))).Vpcs ?? [];
      const flows = (await ec2.send(new DescribeFlowLogsCommand({}))).FlowLogs ?? [];
      const withFlows = new Set(flows.map((f) => f.ResourceId));
      const missing = vpcs.filter((v) => !withFlows.has(v.VpcId)).map((v) => v.VpcId ?? "");
      push({
        ...flowMeta,
        status: vpcs.length === 0 ? "NOT_APPLICABLE" : missing.length === 0 ? "PASS" : "FAIL",
        summary: vpcs.length === 0
          ? `No hay VPC en ${awsRegion}.`
          : missing.length === 0
            ? `Las ${vpcs.length} VPC tienen flow logs.`
            : `${missing.length} de ${vpcs.length} VPC sin flow logs.`,
        evidence: missing.map((v) => `Sin flow logs: ${v}`),
      });
    } catch (e) {
      fail(flowMeta, (e as Error).message);
    }

    // ---------- Sección 5: Red y computación ----------
    const sgMeta = {
      id: "5.2",
      title: "Ningún grupo de seguridad expone SSH/RDP a Internet",
      section: "5. Red y computación",
      severity: "critical" as Severity,
      remediation: "Restringe los puertos 22 y 3389 a rangos IP conocidos o usa Session Manager.",
    };
    const defaultSgMeta = {
      id: "5.4",
      title: "Grupo de seguridad por defecto sin reglas",
      section: "5. Red y computación",
      severity: "medium" as Severity,
      remediation: "Elimina todas las reglas de entrada y salida del grupo de seguridad 'default'.",
    };
    try {
      const sgs = (await ec2.send(new DescribeSecurityGroupsCommand({}))).SecurityGroups ?? [];
      const exposed: string[] = [];
      const defaultWithRules: string[] = [];
      for (const sg of sgs) {
        for (const p of sg.IpPermissions ?? []) {
          const from = p.FromPort ?? 0;
          const to = p.ToPort ?? 65535;
          const openWorld = (p.IpRanges ?? []).some((r) => r.CidrIp === "0.0.0.0/0") ||
            (p.Ipv6Ranges ?? []).some((r) => r.CidrIpv6 === "::/0");
          const hitsAdmin = p.IpProtocol === "-1" ||
            [22, 3389].some((port) => port >= from && port <= to);
          if (openWorld && hitsAdmin) {
            exposed.push(`${sg.GroupId} (${sg.GroupName}) puertos ${from}-${to}`);
          }
        }
        if (sg.GroupName === "default" && ((sg.IpPermissions ?? []).length > 0 || (sg.IpPermissionsEgress ?? []).length > 0)) {
          defaultWithRules.push(`${sg.GroupId} en ${sg.VpcId}`);
        }
      }
      push({
        ...sgMeta,
        status: sgs.length === 0 ? "NOT_APPLICABLE" : exposed.length === 0 ? "PASS" : "FAIL",
        summary: exposed.length === 0
          ? "Ningún grupo de seguridad expone administración a 0.0.0.0/0."
          : `${exposed.length} regla(s) exponen SSH/RDP a Internet.`,
        evidence: exposed,
      });
      push({
        ...defaultSgMeta,
        status: sgs.length === 0 ? "NOT_APPLICABLE" : defaultWithRules.length === 0 ? "PASS" : "FAIL",
        summary: defaultWithRules.length === 0
          ? "Los grupos por defecto no tienen reglas."
          : `${defaultWithRules.length} grupo(s) por defecto con reglas activas.`,
        evidence: defaultWithRules,
      });
    } catch (e) {
      fail(sgMeta, (e as Error).message);
      fail(defaultSgMeta, (e as Error).message);
    }

    const imdsMeta = {
      id: "5.6",
      title: "IMDSv2 obligatorio en instancias EC2",
      section: "5. Red y computación",
      severity: "high" as Severity,
      remediation: "Configura HttpTokens=required en los metadatos de cada instancia EC2.",
    };
    try {
      const res = (await ec2.send(new DescribeInstancesCommand({}))).Reservations ?? [];
      const instances = res.flatMap((r) => r.Instances ?? []).filter((i) => i.State?.Name !== "terminated");
      const bad = instances
        .filter((i) => i.MetadataOptions?.HttpTokens !== "required")
        .map((i) => `${i.InstanceId} (HttpTokens=${i.MetadataOptions?.HttpTokens ?? "desconocido"})`);
      push({
        ...imdsMeta,
        status: instances.length === 0 ? "NOT_APPLICABLE" : bad.length === 0 ? "PASS" : "FAIL",
        summary: instances.length === 0
          ? `No hay instancias EC2 en ${awsRegion}.`
          : bad.length === 0
            ? `Las ${instances.length} instancias exigen IMDSv2.`
            : `${bad.length} de ${instances.length} instancias no exigen IMDSv2.`,
        evidence: bad,
      });
    } catch (e) {
      fail(imdsMeta, (e as Error).message);
    }

    // ---------- Sección 2.3: Bases de datos ----------
    const rdsPubMeta = {
      id: "2.3.3",
      title: "Instancias RDS no accesibles públicamente",
      section: "2. Almacenamiento",
      severity: "critical" as Severity,
      remediation: "Desactiva 'Publicly accessible' y coloca la base de datos en subredes privadas.",
    };
    const rdsEncMeta = {
      id: "2.3.1",
      title: "Cifrado en reposo en instancias RDS",
      section: "2. Almacenamiento",
      severity: "high" as Severity,
      remediation: "Crea la instancia con cifrado activado o restaura una snapshot cifrada.",
    };
    const rdsMinorMeta = {
      id: "2.3.2",
      title: "Actualizaciones menores automáticas en RDS",
      section: "2. Almacenamiento",
      severity: "low" as Severity,
      remediation: "Activa 'Auto minor version upgrade' en cada instancia RDS.",
    };
    try {
      const dbs = (await rds.send(new DescribeDBInstancesCommand({}))).DBInstances ?? [];
      if (dbs.length === 0) {
        for (const meta of [rdsPubMeta, rdsEncMeta, rdsMinorMeta]) {
          push({ ...meta, status: "NOT_APPLICABLE", summary: `No hay instancias RDS en ${awsRegion}.`, evidence: [] });
        }
      } else {
        const pub = dbs.filter((d) => d.PubliclyAccessible).map((d) => d.DBInstanceIdentifier ?? "");
        const unenc = dbs.filter((d) => !d.StorageEncrypted).map((d) => d.DBInstanceIdentifier ?? "");
        const noMinor = dbs.filter((d) => !d.AutoMinorVersionUpgrade).map((d) => d.DBInstanceIdentifier ?? "");
        push({
          ...rdsPubMeta,
          status: pub.length === 0 ? "PASS" : "FAIL",
          summary: pub.length === 0
            ? `Las ${dbs.length} instancias RDS son privadas.`
            : `${pub.length} instancia(s) RDS accesibles públicamente.`,
          evidence: pub.map((d) => `Pública: ${d}`),
        });
        push({
          ...rdsEncMeta,
          status: unenc.length === 0 ? "PASS" : "FAIL",
          summary: unenc.length === 0
            ? "Todas las instancias RDS están cifradas."
            : `${unenc.length} instancia(s) RDS sin cifrado.`,
          evidence: unenc.map((d) => `Sin cifrado: ${d}`),
        });
        push({
          ...rdsMinorMeta,
          status: noMinor.length === 0 ? "PASS" : "FAIL",
          summary: noMinor.length === 0
            ? "Todas las instancias aplican actualizaciones menores automáticas."
            : `${noMinor.length} instancia(s) sin actualizaciones menores automáticas.`,
          evidence: noMinor.map((d) => `Manual: ${d}`),
        });
      }
    } catch (e) {
      fail(rdsPubMeta, (e as Error).message);
      fail(rdsEncMeta, (e as Error).message);
      fail(rdsMinorMeta, (e as Error).message);
    }

    // ---------- Puntuación ----------
    const passed = results.filter((r) => r.status === "PASS").length;
    const failed = results.filter((r) => r.status === "FAIL").length;
    const na = results.filter((r) => r.status === "NOT_APPLICABLE").length;
    const errored = results.filter((r) => r.status === "ERROR").length;
    const scored = passed + failed;
    const score = scored === 0 ? 0 : Math.round((passed / scored) * 100);

    const { data: run, error: insertError } = await supabaseClient
      .from("cis_audit_runs")
      .insert({
        user_id: user.id,
        client_id: clientId ?? null,
        client_name_snapshot: clientName,
        aws_account_id: awsAccountId,
        region: awsRegion,
        benchmark: BENCHMARK,
        score,
        passed_count: passed,
        failed_count: failed,
        not_applicable_count: na,
        error_count: errored,
        results,
        errors: errors.length > 0 ? errors : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("cis_audit_runs insert failed", insertError.message);
      return json({ error: "No se pudo guardar la auditoría" }, 500);
    }

    return json({ success: true, run });
  } catch (e) {
    console.error("run-cis-audit error", (e as Error).message);
    const msg = (e as Error).message || "";
    const isClientError = /AccessDenied|ExternalId|role|credentials|not configured|no encontrado/i.test(msg);
    return json({ error: isClientError ? msg : "Error interno al ejecutar la auditoría" }, isClientError ? 400 : 500);
  }
});
