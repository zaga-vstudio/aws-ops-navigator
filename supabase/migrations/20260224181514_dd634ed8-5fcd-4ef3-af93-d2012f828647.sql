
-- Add new columns
ALTER TABLE monitoring_data_cache
  ADD COLUMN instance_id text NOT NULL DEFAULT 'default',
  ADD COLUMN resource_type text NOT NULL DEFAULT 'ec2';

-- Add RDS-specific metric columns
ALTER TABLE monitoring_data_cache
  ADD COLUMN db_connections_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN free_storage_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN read_latency_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN write_latency_metrics jsonb DEFAULT '[]'::jsonb;

-- Clean up duplicate unique constraints, replace with new composite
ALTER TABLE monitoring_data_cache
  DROP CONSTRAINT monitoring_data_cache_user_id_time_range_key,
  DROP CONSTRAINT uq_monitoring_data_cache_user_timerange;

ALTER TABLE monitoring_data_cache
  ADD CONSTRAINT monitoring_data_cache_user_timerange_instance_key
    UNIQUE (user_id, time_range, instance_id, resource_type);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION validate_monitoring_resource_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.resource_type NOT IN ('ec2', 'rds') THEN
    RAISE EXCEPTION 'Invalid resource_type: %. Must be ec2 or rds.', NEW.resource_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_monitoring_resource_type
  BEFORE INSERT OR UPDATE ON monitoring_data_cache
  FOR EACH ROW
  EXECUTE FUNCTION validate_monitoring_resource_type();
