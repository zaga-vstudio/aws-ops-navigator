

# Database Schema Refactoring Plan for CloudHub (50K Users)

## Current State Assessment

After reviewing both prompts against the actual database, here is what already exists and what needs work:

**Already in good shape:**
- `updated_at` triggers exist on most tables (profiles, aws_configurations, user_setup, user_aws_credentials, security_change_approvals, notification_preferences, security_dashboard_configs, alert_rules, cost_data_cache, monitoring_data_cache)
- RLS policies are properly configured on all tables
- Some foreign keys exist (profiles, aws_configurations, user_setup, security_change_approvals, notification_preferences, security_dashboard_configs, compliance_remediation_log, cost_data_cache)
- Some useful indexes exist (drift_events user/acknowledged, resource_snapshots user/type, cost_data_cache expires_at, monitoring_data_cache user/time_range)
- ENUMs exist for `approval_status` and `security_change_type`
- Database is currently empty (0 rows in all operational tables, 1 credential row) -- early stage

**Gaps to address (filtered for 50K-user scale, not hyperscale):**

---

## Phase 1: Missing Foreign Keys with CASCADE

Tables missing FK to `auth.users(id)`:
- `alert_rules.user_id`
- `drift_events.user_id`
- `monitoring_data_cache.user_id`
- `resource_snapshots.user_id`
- `user_aws_credentials.user_id`

All will get `ON DELETE CASCADE` so user deletion cleans up data automatically.

---

## Phase 2: New ENUM Types (Selective)

Create ENUMs only for columns with stable, well-defined value sets:

| ENUM Name | Values | Replaces |
|-----------|--------|----------|
| `severity_level` | `info`, `warning`, `critical` | `alert_rules.severity`, `drift_events.severity` |
| `drift_scan_frequency` | `daily`, `weekly`, `monthly` | `notification_preferences.drift_scan_frequency` |
| `remediation_status` | `pending`, `success`, `failed` | `compliance_remediation_log.status` |
| `monitoring_time_range` | `1h`, `6h`, `24h`, `7d` | `monitoring_data_cache.time_range` |

The `6h` value is included because the monitoring hook already supports it. Values like alert metric names are left as TEXT since they expand frequently.

---

## Phase 3: Credential Storage Consolidation

Current state: Both `aws_configurations` and `user_aws_credentials` store encrypted credentials. The `get_user_aws_credentials` DB function reads from `user_aws_credentials`. The `aws_configurations` table has 0 rows while `user_aws_credentials` has 1.

**Decision: Keep `user_aws_credentials` as the single source of truth.** Remove encrypted credential columns (`encrypted_access_key`, `encrypted_secret_key`, `encrypted_session_token`, `key_nonce`) from `aws_configurations`. This table becomes a configuration/metadata store only (region, name, thresholds, projects).

This requires updating any edge functions that reference `aws_configurations` credential fields.

---

## Phase 4: Webhook Encryption

Replace plaintext webhook fields in `notification_preferences`:

| Remove (plaintext) | Add (encrypted) |
|---|---|
| `webhook_url` | `encrypted_webhook_url` (bytea) |
| `slack_webhook` | `encrypted_slack_webhook` (bytea) |
| `discord_webhook` | `encrypted_discord_webhook` (bytea) |
| -- | `webhook_nonce` (bytea) |

Encryption/decryption will use the same Vault-backed `encrypt_secret`/`decrypt_secret` functions already used for AWS credentials. All 5 edge functions that read these webhooks will be updated to decrypt via the DB function.

---

## Phase 5: Smart Indexing (Targeted)

New indexes to add (only where query patterns justify them):

| Index | Table | Rationale |
|-------|-------|-----------|
| `idx_alert_rules_user_id` | alert_rules | RLS + user-scoped queries |
| `idx_drift_events_user_created` | drift_events | `ORDER BY detected_at DESC` queries |
| `idx_drift_events_user_resource` | drift_events | Drift lookup by resource |
| `idx_resource_snapshots_user_resource` | resource_snapshots | Already exists as unique constraint |
| `idx_compliance_log_user_created` | compliance_remediation_log | User-scoped log queries |
| `idx_security_approvals_status` | security_change_approvals | Status filtering |
| `idx_security_approvals_user_created` | security_change_approvals | User-scoped queries |
| `idx_monitoring_cache_expires` | monitoring_data_cache | Cache expiry checks |

No JSONB indexes (not justified at this scale).

---

## Phase 6: Soft Delete for Core Tables

Add `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL` to:
- `alert_rules`
- `drift_events`
- `security_change_approvals`

Update RLS policies to filter out soft-deleted rows (`deleted_at IS NULL`). This enables audit trails without losing data.

---

## Phase 7: Cache Table Flexibility

- `monitoring_data_cache`: Already has `UNIQUE(user_id, time_range)` -- good.
- `cost_data_cache`: Currently has `UNIQUE(user_id)`. Change to `UNIQUE(user_id, aws_region)` by adding an `aws_region TEXT NOT NULL DEFAULT 'us-east-1'` column. This supports future multi-region cost tracking without schema redesign.

---

## Phase 8: Retention Strategy (No Partitioning)

For high-volume tables (`drift_events`, `resource_snapshots`, `compliance_remediation_log`), partitioning is premature at 50K users. Instead:
- Add a database function `cleanup_old_records(retention_days INT DEFAULT 90)` that can be called via a scheduled edge function
- Deletes rows older than the retention period from these tables
- Can be triggered weekly via a cron-style edge function

---

## Phase 9: Consistency Fixes

- Add missing `updated_at` triggers to `drift_events` and `compliance_remediation_log` (currently missing)
- Ensure all JSONB defaults use explicit casting (already done)
- Ensure all boolean defaults are explicit (already done)

---

## Technical Details: Migration SQL

The migration will be a single SQL file covering:
1. New ENUM types
2. Foreign key additions with CASCADE
3. Column alterations (TEXT to ENUM with casts)
4. New columns (deleted_at, aws_region on cost_data_cache, encrypted webhook fields)
5. Drop old plaintext webhook columns
6. Remove credential columns from aws_configurations
7. New indexes
8. Updated RLS policies for soft delete
9. Retention cleanup function
10. Missing triggers

## Edge Function Updates Required

After the migration, these edge functions need code changes:
- `send-alert-notification` -- decrypt webhooks before use
- `scheduled-drift-scan` -- decrypt webhooks before use
- `manage-iam-users` -- decrypt webhook before use
- `compliance-remediation` -- decrypt webhook before use
- `manage-security-groups` -- decrypt webhook before use
- `save-aws-credentials` -- stop writing credentials to aws_configurations

## Frontend Updates Required

- `useNotificationPreferences.tsx` -- webhook values are no longer readable from the client (encrypted). The UI should show a masked "configured" state instead of displaying the URL. Writing new webhook values will go through an edge function that encrypts before storing.
- Any code referencing `aws_configurations` credential fields needs cleanup.

---

## Why This Fits 50K Users

At this scale, the bottlenecks are missing indexes, plaintext secrets, and duplicated credential storage -- not partition scaling or sharding. This plan:
- Adds referential integrity without complex cascade chains
- Indexes only the columns that match actual query patterns (RLS on user_id, ORDER BY created_at)
- Uses ENUMs for data integrity on stable value sets
- Eliminates credential duplication
- Encrypts all secrets at rest
- Provides soft delete for auditability
- Prepares cache tables for multi-region without over-engineering
- Avoids partitioning, GIN indexes, and read replicas that would be premature

