
-- ============================================================
-- CloudHub Schema Patch: UNIQUE constraints + partial indexes
-- FKs with CASCADE already exist on all 5 tables. Skipped.
-- ============================================================

-- 1️⃣ UNIQUE constraint on cost_data_cache(user_id, aws_region)
ALTER TABLE public.cost_data_cache
  ADD CONSTRAINT uq_cost_data_cache_user_region
  UNIQUE (user_id, aws_region);

-- 2️⃣ UNIQUE constraint on monitoring_data_cache(user_id, time_range)
ALTER TABLE public.monitoring_data_cache
  ADD CONSTRAINT uq_monitoring_data_cache_user_timerange
  UNIQUE (user_id, time_range);

-- 3️⃣ Partial indexes for soft-delete performance (active rows only)
CREATE INDEX idx_alert_rules_user_active
  ON public.alert_rules(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_drift_events_user_active
  ON public.drift_events(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_security_approvals_user_active
  ON public.security_change_approvals(user_id)
  WHERE deleted_at IS NULL;
