# Fase 1 — Onboarding de clientes vía cross-account IAM Role

## Lo que encontré en el código actual (verificado)

- **No existe ningún concepto de tenant/cliente.** No hay tabla `tenants` ni columna `tenant_id` en ninguna parte del esquema (`src/integrations/supabase/types.ts`). Todo el aislamiento es por `user_id` = tu propio usuario. Es decir: hoy la app es estrictamente una cuenta AWS por usuario de Clodaro.
- **Credenciales:** `user_aws_credentials` guarda access key + secret cifrados (pgcrypto + Vault) y hay una única fila por usuario. Las Edge Functions llaman `get_user_aws_credentials(user.id)` y pasan esas claves a `resolveCredentials()` (`supabase/functions/_shared/resolve-credentials.ts`).
- **`cloudhub_roles` no sirve para clientes externos:** es AssumeRole *dentro de tu propia cuenta* — `validateRoleArn()` exige que el ARN sea de tu mismo Account ID y que el nombre sea exactamente `CloudHub-Project-<nombre>`. Un rol de cliente (otra cuenta, otro nombre) sería rechazado. El `ExternalId` es derivado (`cloudhub-<userId>`), no un UUID por cliente.
- **`role_audit_log`** existe (action, role_name, role_arn, details, user_id) pero registra ciclo de vida de roles, no cada AssumeRole, y no es append-only ni tiene cliente.
- **Riesgo real de mezcla de datos:** las tablas de caché/resultados (`cost_data_cache` con único `(user_id, aws_region)`, cachés de monitorización, resultados de compliance, `alert_rules`, `alert_history`) están claveadas solo por `user_id`. Si conecto dos clientes con el mismo usuario, la caché del cliente B sobrescribe/muestra la del cliente A. **Esto hay que arreglarlo como parte de la Fase 1**, no después.

## Decisiones de seguridad con trade-off (necesito tu criterio, propongo un default)

1. **Alcance de la policy IAM** — Default propuesto: `SecurityAudit` como recomendación principal, y `ViewOnlyAccess` como opcional adicional cuando quiera inventario completo (listar instancias, buckets, etc.). Razón: son policies gestionadas por AWS, auditables por el cliente en su consola, sin permisos de escritura y mantenidas por AWS cuando salen servicios nuevos; una custom policy obliga al cliente a confiar en un JSON mío y a re-aprobar cada cambio. Trade-off: `SecurityAudit` no permite leer *contenido* (p. ej. `s3:GetObject`) — no lo necesitamos — pero tampoco algunos `Describe`/`List` de inventario, de ahí la opción de sumar `ViewOnlyAccess`.
2. **External ID** — UUID v4 por cliente, generado server-side, guardado en la fila del cliente. No es un secreto de alto valor (previene el "confused deputy"), pero **no debe ser derivable** (hoy es `cloudhub-<userId>`, adivinable). Se mostrará en el wizard y se podrá rotar; rotar invalida el rol hasta que el cliente actualice su trust policy.
3. **Identidad auditora** — El trust policy apuntará al principal IAM de *mi* cuenta (derivado con `sts:GetCallerIdentity` sobre mis claves ya guardadas). Trade-off: si roto mis claves a otro usuario IAM, hay que actualizar la trust policy en cada cliente. Alternativa más robusta (fuera de Fase 1): un rol intermedio fijo `Clodaro-Auditor` en mi cuenta como único principal.
4. **Modo cuenta propia** — Se mantiene: si no hay cliente seleccionado, la app funciona como hoy con tus claves directas. Sin regresión.

## Qué voy a implementar en la Fase 1

### Base de datos (una migración)
- `clients`: `id`, `owner_id` (auth.users), `name`, `contact_email`, `aws_account_id`, `role_arn`, `external_id` (uuid, default gen_random_uuid()), `default_region`, `policy_scope` ('security_audit' | 'view_only'), `connection_status` ('pending' | 'connected' | 'failed'), `last_verified_at`, `notes`, timestamps. RLS: solo el `owner_id` ve/edita sus clientes. GRANTs a `authenticated` y `service_role`.
- `assume_role_audit` (append-only): `id`, `client_id`, `actor_user_id`, `actor_email`, `role_arn`, `external_id_used`, `region`, `operation` (qué función/acción), `outcome` ('success' | 'denied' | 'error'), `error_message`, `session_expiry`, `created_at`. RLS: el owner puede **leer** las filas de sus clientes; sin políticas de UPDATE/DELETE (append-only real); inserta solo `service_role` desde las Edge Functions.
- **Aislamiento de cachés:** añadir `client_id uuid NULL` a `cost_data_cache`, cachés de monitorización y tablas de resultados/alertas, y rehacer los índices únicos para incluir `client_id` (NULL = tu cuenta propia). Sin esto hay fuga entre clientes.

### Edge Functions
- `_shared/resolve-credentials.ts`: nueva rama `clientId`. Busca el cliente por `(id, owner_id)` server-side, valida el ARN (regex ARN válido + `aws_account_id` coincidente + cuenta ≠ mi cuenta), hace `AssumeRole` con el `external_id` del cliente, sesión de 3600s, session tags (`ClodaroActor`, `ClodaroClient`) para atribución en el CloudTrail *del cliente*, y escribe una fila en `assume_role_audit` en éxito y en fallo. Nunca acepta un ARN enviado por el frontend.
- `manage-clients` (nueva): `create`, `update`, `delete`, `rotate_external_id`, `test_connection` (AssumeRole real + `sts:GetCallerIdentity` con la sesión asumida + comprobación de que las policies esperadas están adjuntas si el rol lo permite) y actualización de `connection_status` / `last_verified_at`.
- Las funciones existentes aceptan `clientId` opcional en el body y lo pasan a `resolveCredentials` (cambio mecánico, mismo patrón que `roleName`).

### Frontend
- `ClientContext` + selector de cliente en el header (junto al Role Switcher), que inyecta `clientId` en todas las llamadas a Edge Functions vía `useAWSData` y hooks relacionados.
- Página `/clients`: lista de clientes con estado de conexión, y wizard de onboarding en 4 pasos, en español y no técnico:
  1. Datos del cliente (nombre, email, Account ID, región principal).
  2. Trust policy JSON ya rellenada con mi Account ID y su External ID + botón copiar.
  3. Instrucciones paso a paso para crear el rol en la consola AWS y adjuntar `SecurityAudit` (+ `ViewOnlyAccess` opcional), y pegar el Role ARN resultante.
  4. Botón **Probar conexión** → llama a `test_connection`; solo al pasar en verde el cliente queda `connected`.
- Pestaña "Accesos" por cliente que muestra el `assume_role_audit` (quién, cuándo, qué operación, resultado) — la evidencia que le enseñas al cliente.

### Archivos que voy a tocar
| Archivo | Cambio |
|---|---|
| migración nueva | `clients`, `assume_role_audit`, `client_id` en cachés |
| `supabase/functions/_shared/resolve-credentials.ts` | rama cross-account + auditoría |
| `supabase/functions/manage-clients/index.ts` | nueva |
| `aws-dashboard-data`, `monitoring-metrics`, `detect-drift`, `vpc-advanced-data`, `manage-*` | aceptar y propagar `clientId` |
| `src/contexts/ClientContext.tsx` | nuevo |
| `src/pages/Clients.tsx`, `src/components/clients/*` | wizard + lista + log de accesos |
| `src/components/Header.tsx`, `src/App.tsx` | selector de cliente + ruta |
| `src/hooks/useAWSData.tsx`, `src/contexts/AWSDataContext.tsx` | enviar `clientId`, invalidar al cambiar de cliente |
| `README.md` | por qué `SecurityAudit` y no una policy custom |

## Orden de ejecución (validamos entre bloques)
1. Migración (clientes + auditoría + `client_id` en cachés).
2. `resolve-credentials` cross-account + `manage-clients` + test de conexión.
3. Wizard y página de clientes + selector en el header.
4. Propagar `clientId` en el resto de Edge Functions y hooks; revisión de aislamiento query por query.
5. README interno del modelo de seguridad.

Fases 2, 3 y 4 (checks CIS, informe PDF, pulido) quedan fuera de esta plan y se planifican al cerrar la Fase 1.
