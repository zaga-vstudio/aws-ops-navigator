CREATE TABLE public.cis_audit_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  client_name_snapshot text,
  aws_account_id text,
  region text NOT NULL,
  benchmark text NOT NULL DEFAULT 'CIS AWS Foundations Benchmark v3.0.0',
  score integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  not_applicable_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.cis_audit_runs TO authenticated;
GRANT ALL ON public.cis_audit_runs TO service_role;

ALTER TABLE public.cis_audit_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own CIS runs"
ON public.cis_audit_runs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own CIS runs"
ON public.cis_audit_runs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CIS runs"
ON public.cis_audit_runs FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_cis_audit_runs_user_client_created
ON public.cis_audit_runs (user_id, client_id, created_at DESC);

CREATE TRIGGER update_cis_audit_runs_updated_at
BEFORE UPDATE ON public.cis_audit_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();