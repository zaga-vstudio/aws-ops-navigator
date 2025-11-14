-- Create enum for change types
CREATE TYPE public.security_change_type AS ENUM (
  'security_group_rule',
  'iam_user_create',
  'iam_user_delete',
  'iam_key_rotation',
  'compliance_remediation'
);

-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed'
);

-- Create security change approvals table
CREATE TABLE public.security_change_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type public.security_change_type NOT NULL,
  change_details JSONB NOT NULL,
  reason TEXT,
  status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  execution_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  webhook_url TEXT,
  email_enabled BOOLEAN DEFAULT true,
  slack_webhook TEXT,
  discord_webhook TEXT,
  notify_on_approval_needed BOOLEAN DEFAULT true,
  notify_on_compliance_issue BOOLEAN DEFAULT true,
  notify_on_security_alert BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create security dashboard configurations table
CREATE TABLE public.security_dashboard_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create compliance remediation log table
CREATE TABLE public.compliance_remediation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compliance_check_id TEXT NOT NULL,
  remediation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_change_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_dashboard_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_remediation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for security_change_approvals
CREATE POLICY "Users can view their own change requests"
  ON public.security_change_approvals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create change requests"
  ON public.security_change_approvals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending requests"
  ON public.security_change_approvals FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for security_dashboard_configs
CREATE POLICY "Users can view their own dashboards"
  ON public.security_dashboard_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own dashboards"
  ON public.security_dashboard_configs FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for compliance_remediation_log
CREATE POLICY "Users can view their own remediation logs"
  ON public.compliance_remediation_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create remediation logs"
  ON public.compliance_remediation_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_security_change_approvals_updated_at
  BEFORE UPDATE ON public.security_change_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_security_dashboard_configs_updated_at
  BEFORE UPDATE ON public.security_dashboard_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();