
-- alert_history table
CREATE TABLE public.alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  cloudwatch_alarm_name text,
  alert_name text NOT NULL,
  metric text NOT NULL,
  threshold numeric,
  current_value numeric,
  state_value text,
  severity text NOT NULL DEFAULT 'warning',
  event_type text NOT NULL DEFAULT 'triggered',
  notification_results jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for event_type
CREATE OR REPLACE FUNCTION public.validate_alert_history_event_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.event_type NOT IN ('triggered', 'resolved', 'acknowledged') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be triggered, resolved, or acknowledged.', NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_alert_history_event_type
  BEFORE INSERT OR UPDATE ON public.alert_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_alert_history_event_type();

-- RLS
ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON public.alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alert history"
  ON public.alert_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can insert alert history"
  ON public.alert_history FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX idx_alert_history_user_created
  ON public.alert_history(user_id, created_at DESC);
CREATE INDEX idx_alert_history_rule
  ON public.alert_history(alert_rule_id);

-- Add sns_topic_arn to notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS sns_topic_arn text;
