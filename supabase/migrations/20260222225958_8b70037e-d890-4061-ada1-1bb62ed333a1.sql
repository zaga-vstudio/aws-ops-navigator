
CREATE OR REPLACE FUNCTION public.cleanup_old_records(retention_days integer DEFAULT 90)
 RETURNS TABLE(deleted_drift_events bigint, deleted_resource_snapshots bigint, deleted_compliance_logs bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cutoff TIMESTAMP WITH TIME ZONE := now() - (retention_days || ' days')::INTERVAL;
  d1 BIGINT; d2 BIGINT; d3 BIGINT;
  calling_user UUID;
BEGIN
  -- Require authenticated user
  calling_user := auth.uid();
  IF calling_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required to run cleanup';
  END IF;

  -- Only delete records belonging to the calling user
  DELETE FROM public.drift_events WHERE detected_at < cutoff AND user_id = calling_user;
  GET DIAGNOSTICS d1 = ROW_COUNT;
  DELETE FROM public.resource_snapshots WHERE created_at < cutoff AND user_id = calling_user;
  GET DIAGNOSTICS d2 = ROW_COUNT;
  DELETE FROM public.compliance_remediation_log WHERE created_at < cutoff AND user_id = calling_user;
  GET DIAGNOSTICS d3 = ROW_COUNT;
  deleted_drift_events := d1; deleted_resource_snapshots := d2; deleted_compliance_logs := d3;
  RETURN NEXT;
END;
$function$;
