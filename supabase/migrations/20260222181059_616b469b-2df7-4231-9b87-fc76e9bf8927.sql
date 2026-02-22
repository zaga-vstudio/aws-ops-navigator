
-- Create cloudhub_roles table for server-side role ARN resolution
CREATE TABLE public.cloudhub_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_name TEXT NOT NULL,
  role_arn TEXT NOT NULL,
  description TEXT,
  max_session_duration_seconds INTEGER NOT NULL DEFAULT 900,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_name)
);

-- Enable RLS
ALTER TABLE public.cloudhub_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped to owning user
CREATE POLICY "Users can view own roles"
  ON public.cloudhub_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles"
  ON public.cloudhub_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles"
  ON public.cloudhub_roles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own roles"
  ON public.cloudhub_roles FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_cloudhub_roles_updated_at
  BEFORE UPDATE ON public.cloudhub_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
