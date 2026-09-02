-- ============================================================
-- Fase 1: clientes externos, identidad auditora y auditoría de AssumeRole
-- ============================================================

CREATE TYPE public.client_policy_scope AS ENUM ('full_readonly', 'security_only');
CREATE TYPE public.client_connection_status AS ENUM ('pending', 'connected', 'failed');
CREATE TYPE public.assume_role_outcome AS ENUM ('success', 'denied', 'error');

-- ---------- clients ----------
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  aws_account_id text,
  role_arn text,
  external_id uuid NOT NULL DEFAULT gen_random_uuid(),
  default_region text NOT NULL DEFAULT 'us-east-1',
  policy_scope public.client_policy_scope NOT NULL DEFAULT 'full_readonly',
  connection_status public.client_connection_status NOT NULL DEFAULT 'pending',
  last_verified_at timestamp with time zone,
  last_error text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_owner_name_key ON public.clients (owner_id, lower(name));
CREATE INDEX clients_owner_idx ON public.clients (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their clients"
  ON public.clients FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owners can create their clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their clients"
  ON public.clients FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- auditor_identity ----------
CREATE TABLE public.auditor_identity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE,
  auditor_role_arn text NOT NULL,
  aws_account_id text,
  verified boolean NOT NULL DEFAULT false,
  last_verified_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auditor_identity TO authenticated;
GRANT ALL ON public.auditor_identity TO service_role;

ALTER TABLE public.auditor_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their auditor identity"
  ON public.auditor_identity FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Owners can create their auditor identity"
  ON public.auditor_identity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their auditor identity"
  ON public.auditor_identity FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their auditor identity"
  ON public.auditor_identity FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_auditor_identity_updated_at
  BEFORE UPDATE ON public.auditor_identity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- assume_role_audit (append-only) ----------
CREATE TABLE public.assume_role_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name_snapshot text,
  actor_user_id uuid NOT NULL,
  actor_email text,
  role_arn text,
  auditor_role_arn text,
  external_id_used text,
  region text,
  operation text NOT NULL,
  outcome public.assume_role_outcome NOT NULL,
  error_message text,
  session_expiry timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX assume_role_audit_client_idx ON public.assume_role_audit (client_id, created_at DESC);
CREATE INDEX assume_role_audit_actor_idx ON public.assume_role_audit (actor_user_id, created_at DESC);

GRANT SELECT ON public.assume_role_audit TO authenticated;
GRANT ALL ON public.assume_role_audit TO service_role;

ALTER TABLE public.assume_role_audit ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner of the client (or the actor); no UPDATE/DELETE policies at all
CREATE POLICY "Owners can read audit entries for their clients"
  ON public.assume_role_audit FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = assume_role_audit.client_id AND c.owner_id = auth.uid()
    )
  );

-- ---------- Aislamiento por cliente en cachés y resultados ----------
ALTER TABLE public.cost_data_cache ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.monitoring_data_cache ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.alert_rules ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.alert_history ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.drift_events ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.resource_snapshots ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.compliance_remediation_log ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.security_change_approvals ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;

-- Rehacer índices únicos incluyendo client_id (NULL = cuenta propia del operador)
ALTER TABLE public.cost_data_cache DROP CONSTRAINT IF EXISTS cost_data_cache_user_region_unique;
ALTER TABLE public.cost_data_cache DROP CONSTRAINT IF EXISTS uq_cost_data_cache_user_region;
DROP INDEX IF EXISTS public.cost_data_cache_user_region_unique;
DROP INDEX IF EXISTS public.uq_cost_data_cache_user_region;
CREATE UNIQUE INDEX cost_data_cache_user_client_region_key
  ON public.cost_data_cache (user_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), aws_region);

ALTER TABLE public.monitoring_data_cache DROP CONSTRAINT IF EXISTS monitoring_data_cache_user_timerange_instance_key;
DROP INDEX IF EXISTS public.monitoring_data_cache_user_timerange_instance_key;
CREATE UNIQUE INDEX monitoring_data_cache_user_client_timerange_instance_key
  ON public.monitoring_data_cache (user_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), time_range, instance_id, resource_type);

ALTER TABLE public.resource_snapshots DROP CONSTRAINT IF EXISTS resource_snapshots_user_id_resource_type_resource_id_key;
DROP INDEX IF EXISTS public.resource_snapshots_user_id_resource_type_resource_id_key;
CREATE UNIQUE INDEX resource_snapshots_user_client_type_resource_key
  ON public.resource_snapshots (user_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), resource_type, resource_id);

CREATE INDEX cost_data_cache_client_idx ON public.cost_data_cache (client_id);
CREATE INDEX monitoring_data_cache_client_idx ON public.monitoring_data_cache (client_id);
CREATE INDEX alert_rules_client_idx ON public.alert_rules (client_id);
CREATE INDEX alert_history_client_idx ON public.alert_history (client_id);
CREATE INDEX drift_events_client_idx ON public.drift_events (client_id);
CREATE INDEX resource_snapshots_client_idx ON public.resource_snapshots (client_id);
CREATE INDEX compliance_remediation_log_client_idx ON public.compliance_remediation_log (client_id);
CREATE INDEX security_change_approvals_client_idx ON public.security_change_approvals (client_id);