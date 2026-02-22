
CREATE TABLE public.role_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  role_name text NOT NULL,
  role_arn text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON public.role_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs" ON public.role_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_role_audit_log_user_id ON public.role_audit_log(user_id);
CREATE INDEX idx_role_audit_log_created_at ON public.role_audit_log(created_at DESC);
