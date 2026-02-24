

## Updated Plan: Multi-Instance Monitoring with Validation Trigger

Good call on constraining `resource_type`. Per Supabase guidelines, CHECK constraints can cause restoration issues, so we will use a **validation trigger** instead to enforce that `resource_type` is one of `'ec2'` or `'rds'`.

### Current State

- `monitoring_data_cache` has no `instance_id` or `resource_type` columns
- Two duplicate unique constraints exist on `(user_id, time_range)` — we will clean those up
- `time_range` is a custom enum `monitoring_time_range`
- The edge function hardcodes `instanceIds[0]` and only fetches EC2 metrics

### Changes

**1. Database Migration**

```sql
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
```

This prevents invalid values like `'RDS'`, `'db'`, or `'EC2'` from ever being stored, using a trigger (not a CHECK) per project guidelines.

**2. Backend: `supabase/functions/monitoring-metrics/index.ts`**

- Accept `instanceId` (string, optional) and `resourceType` (`'ec2'` | `'rds'`, default `'ec2'`) from request body
- **Validate instance ownership**:
  - EC2: call `DescribeInstances({ InstanceIds: [instanceId] })`, return 400 if not found
  - RDS: call `DescribeDBInstances({ DBInstanceIdentifier: instanceId })`, return 400 if not found
  - Skip validation when no `instanceId` provided (auto-select first running EC2)
- **Resource-type-aware period granularity** via updated `getTimeRangeParams(timeRange, resourceType)`:
  - EC2: `1h→300s`, `6h→900s`, `24h→3600s`, `7d→21600s` (unchanged)
  - RDS: `1h→60s`, `6h→300s`, `24h→900s`, `7d→3600s` (finer, matching RDS publishing intervals)
- **RDS metrics** (namespace `AWS/RDS`, dimension `DBInstanceIdentifier`):
  - Free: `CPUUtilization`, `DatabaseConnections`, `FreeStorageSpace`
  - Paid: `ReadLatency`, `WriteLatency`
- **Updated `MonitoringResult`** interface adds: `resourceType`, `instanceId`, `databaseConnections?`, `freeStorageSpace?`, `readLatency?`, `writeLatency?`
- **Cache functions** updated to key on `(user_id, time_range, instance_id, resource_type)` and store/retrieve RDS-specific columns

**3. Frontend Hook: `src/hooks/useMonitoringData.tsx`**

- Add `instanceId` and `resourceType` to `fetchMetrics` options
- Extend `MonitoringData` interface with `resourceType`, `instanceId`, and RDS metric fields
- Pass new params in the edge function body

**4. Frontend UI: `src/pages/Monitoring.tsx`**

- Add `selectedResource` state: `{ id: string; name: string; type: 'ec2' | 'rds' } | null`
- Add a grouped `Select` dropdown next to the time range selector:
  - **EC2 Instances** group: all EC2 instances (name tag + ID + state badge)
  - **RDS Databases** group: all RDS databases (identifier + engine + state badge)
  - Default option: "Auto (first running EC2)"
- On selection change, call `fetchMetrics` with `instanceId` and `resourceType`
- **Dynamic chart titles by resource type**:
  - EC2: "CPU Usage", "Network Traffic" (dual line), paid: "Disk I/O", "Status Checks"
  - RDS: "CPU Usage", "Database Connections" (single line), "Free Storage Space", paid: "Read/Write Latency"
- **Info banner**: "Showing [EC2|RDS] metrics for [instance-name]. Metric types vary by resource."
- **No simulated data for RDS**: show empty state with message instead of random charts

### Technical Details

- The validation trigger fires on INSERT and UPDATE, rejecting any `resource_type` not in `('ec2', 'rds')`. This is functionally equivalent to a CHECK constraint but avoids Supabase restoration issues.
- Instance validation adds one `DescribeInstances` or `DescribeDBInstances` call per non-cached request — negligible cost, already free tier.
- `@aws-sdk/client-rds` is already used in `manage-rds-instances`, so importing `DescribeDBInstancesCommand` adds no new dependency.
- The duplicate unique constraints (`monitoring_data_cache_user_id_time_range_key` and `uq_monitoring_data_cache_user_timerange`) will both be dropped and replaced by the new 4-column composite key.

