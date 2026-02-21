
-- ============================================================
-- CloudHub Schema Refactoring Migration (50K Users) - All Phases
-- ============================================================

-- PHASE 2a: New ENUM Types
CREATE TYPE severity_level AS ENUM ('info', 'warning', 'critical');
CREATE TYPE drift_scan_frequency_enum AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE remediation_status AS ENUM ('pending', 'success', 'failed');
CREATE TYPE monitoring_time_range AS ENUM ('1h', '6h', '24h', '7d');

-- PHASE 1: Foreign Keys with CASCADE
ALTER TABLE public.alert_rules ADD CONSTRAINT fk_alert_rules_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.drift_events ADD CONSTRAINT fk_drift_events_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.monitoring_data_cache ADD CONSTRAINT fk_monitoring_cache_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.resource_snapshots ADD CONSTRAINT fk_resource_snapshots_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_aws_credentials ADD CONSTRAINT fk_user_aws_credentials_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- PHASE 2b: TEXT to ENUM (drop default, change type, set new default)
ALTER TABLE public.alert_rules ALTER COLUMN severity DROP DEFAULT;
ALTER TABLE public.alert_rules ALTER COLUMN severity TYPE severity_level USING severity::severity_level;
ALTER TABLE public.alert_rules ALTER COLUMN severity SET DEFAULT 'warning'::severity_level;

ALTER TABLE public.drift_events ALTER COLUMN severity DROP DEFAULT;
ALTER TABLE public.drift_events ALTER COLUMN severity TYPE severity_level USING severity::severity_level;
ALTER TABLE public.drift_events ALTER COLUMN severity SET DEFAULT 'warning'::severity_level;

ALTER TABLE public.notification_preferences ALTER COLUMN drift_scan_frequency DROP DEFAULT;
ALTER TABLE public.notification_preferences ALTER COLUMN drift_scan_frequency TYPE drift_scan_frequency_enum USING drift_scan_frequency::drift_scan_frequency_enum;
ALTER TABLE public.notification_preferences ALTER COLUMN drift_scan_frequency SET DEFAULT 'daily'::drift_scan_frequency_enum;

ALTER TABLE public.compliance_remediation_log ALTER COLUMN status TYPE remediation_status USING status::remediation_status;

ALTER TABLE public.monitoring_data_cache ALTER COLUMN time_range DROP DEFAULT;
ALTER TABLE public.monitoring_data_cache ALTER COLUMN time_range TYPE monitoring_time_range USING time_range::monitoring_time_range;
ALTER TABLE public.monitoring_data_cache ALTER COLUMN time_range SET DEFAULT '24h'::monitoring_time_range;

-- PHASE 3: Remove credential columns from aws_configurations
ALTER TABLE public.aws_configurations
  DROP COLUMN IF EXISTS encrypted_access_key,
  DROP COLUMN IF EXISTS encrypted_secret_key,
  DROP COLUMN IF EXISTS encrypted_session_token,
  DROP COLUMN IF EXISTS key_nonce;

-- PHASE 4: Webhook Encryption
ALTER TABLE public.notification_preferences
  ADD COLUMN encrypted_webhook_url bytea DEFAULT NULL,
  ADD COLUMN encrypted_slack_webhook bytea DEFAULT NULL,
  ADD COLUMN encrypted_discord_webhook bytea DEFAULT NULL,
  ADD COLUMN webhook_nonce bytea DEFAULT extensions.gen_random_bytes(24);

ALTER TABLE public.notification_preferences
  DROP COLUMN IF EXISTS webhook_url,
  DROP COLUMN IF EXISTS slack_webhook,
  DROP COLUMN IF EXISTS discord_webhook;

-- PHASE 5: Indexes
CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_drift_events_user_created ON public.drift_events (user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_drift_events_user_resource ON public.drift_events (user_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_compliance_log_user_created ON public.compliance_remediation_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_approvals_status ON public.security_change_approvals (status);
CREATE INDEX IF NOT EXISTS idx_security_approvals_user_created ON public.security_change_approvals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_cache_expires ON public.monitoring_data_cache (expires_at);

-- PHASE 6: Soft Delete columns FIRST (before RLS references them)
ALTER TABLE public.alert_rules ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.drift_events ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.security_change_approvals ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- PHASE 6b: RLS policies with soft delete (drop old, create new with unique names)
DROP POLICY IF EXISTS "Users can view their own alert rules " ON public.alert_rules;
CREATE POLICY "Users can view own alert rules"
  ON public.alert_rules FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update their own alert rules " ON public.alert_rules;
CREATE POLICY "Users can update own alert rules"
  ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can delete their own alert rules " ON public.alert_rules;
CREATE POLICY "Users can delete own alert rules"
  ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own drift events " ON public.drift_events;
CREATE POLICY "Users can view own drift events"
  ON public.drift_events FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update their own drift events " ON public.drift_events;
CREATE POLICY "Users can update own drift events"
  ON public.drift_events FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can view their own change requests " ON public.security_change_approvals;
CREATE POLICY "Users can view own change requests"
  ON public.security_change_approvals FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can update their pending requests " ON public.security_change_approvals;
CREATE POLICY "Users can update own pending requests"
  ON public.security_change_approvals FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending'::approval_status AND deleted_at IS NULL);

-- PHASE 7: Cache Table Flexibility
ALTER TABLE public.cost_data_cache ADD COLUMN aws_region TEXT NOT NULL DEFAULT 'us-east-1';
ALTER TABLE public.cost_data_cache DROP CONSTRAINT IF EXISTS cost_data_cache_user_id_key;
ALTER TABLE public.cost_data_cache ADD CONSTRAINT cost_data_cache_user_region_unique UNIQUE (user_id, aws_region);

-- PHASE 8: Retention Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_records(retention_days INT DEFAULT 90)
RETURNS TABLE(deleted_drift_events BIGINT, deleted_resource_snapshots BIGINT, deleted_compliance_logs BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cutoff TIMESTAMP WITH TIME ZONE := now() - (retention_days || ' days')::INTERVAL;
  d1 BIGINT; d2 BIGINT; d3 BIGINT;
BEGIN
  DELETE FROM public.drift_events WHERE detected_at < cutoff;
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM public.resource_snapshots WHERE created_at < cutoff;
  GET DIAGNOSTICS d2 = ROW_COUNT;
  DELETE FROM public.compliance_remediation_log WHERE created_at < cutoff;
  GET DIAGNOSTICS d3 = ROW_COUNT;
  deleted_drift_events := d1; deleted_resource_snapshots := d2; deleted_compliance_logs := d3;
  RETURN NEXT;
END;
$$;

-- PHASE 9: Missing triggers + updated_at columns
ALTER TABLE public.drift_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
DROP TRIGGER IF EXISTS update_drift_events_updated_at ON public.drift_events;
CREATE TRIGGER update_drift_events_updated_at BEFORE UPDATE ON public.drift_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.compliance_remediation_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
DROP TRIGGER IF EXISTS update_compliance_remediation_log_updated_at ON public.compliance_remediation_log;
CREATE TRIGGER update_compliance_remediation_log_updated_at BEFORE UPDATE ON public.compliance_remediation_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
