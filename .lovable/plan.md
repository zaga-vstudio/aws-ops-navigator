

# Enhanced Alerts System Plan

## Overview
Expand the alerts system with new metric categories, improved UX clarity, and budget alerting capabilities. All CloudWatch describe/alarm operations are free; budget alerts use the AWS Budgets API (also free to create).

## Changes

### 1. Expand Alert Metric Categories

Group metrics into clear categories in the "New Alert Rule" dialog:

**Performance (Free - CloudWatch Basic)**
- CPU Utilization (EC2) -- already exists
- Network In / Network Out (EC2) -- already exists
- Database Connections (RDS)
- Read/Write Latency (RDS)

**Storage (Free - CloudWatch Basic)**
- Free Storage Space (RDS)
- Volume Read/Write Ops (EBS)

**Cost & Budget (Free - AWS Budgets API)**
- Monthly Budget -- alert when forecasted or actual spend exceeds a dollar threshold
- Service Budget -- alert on a specific AWS service exceeding spend

**Agent-Required (Paid - needs CloudWatch Agent installed)**
- Memory Utilization -- already exists, add "(requires CW Agent)" label
- Disk Utilization -- already exists, add "(requires CW Agent)" label

### 2. Improve the "New Alert Rule" Dialog

Current issues to fix:
- "Duration" is unclear -- rename to "Evaluation Period" with helper text: "How many minutes of data to average before checking the threshold"
- Threshold label says "(%)" but budget alerts use dollar amounts -- make dynamic based on selected metric
- No metric grouping -- add category headers in the Select dropdown

Updated form fields:
- **Rule Name** (unchanged)
- **Category** -- new grouped select: Performance / Storage / Cost / Agent-Required
- **Metric** -- filtered by category, with cost badges for agent-required metrics
- **Threshold** -- dynamic label: "%" for utilization metrics, "$" for budget metrics, "count" for connection metrics
- **Evaluation Period** -- renamed from "Duration", with tooltip explaining the concept
- **Comparison** -- new field: "Greater than" (default) or "Less than" (useful for free storage alerts)
- **Severity** (unchanged)

### 3. Backend: Budget Alert Support

Update the `manage-alert-rules` edge function:

- Add `@aws-sdk/client-budgets` import for `CreateBudgetCommand` and `DeleteBudgetCommand`
- When metric category is "cost", create an AWS Budget with notification instead of a CloudWatch alarm
- Store the budget name in `cloudwatch_alarm_name` column (rename conceptually, keep column for compatibility)
- Add metric mapping for budget metrics with namespace "AWS/Billing"
- Add `comparison_operator` field to the `alert_rules` table to support "less than" comparisons (e.g., free storage < 5GB)

### 4. Database Changes

Add one column to `alert_rules`:
- `comparison_operator TEXT NOT NULL DEFAULT 'GreaterThanThreshold'`

This supports both "greater than" (CPU > 80%) and "less than" (free storage < 5GB) alert types without breaking existing rules.

### 5. Active Alerts Tab Improvements

- Show the evaluation period alongside each active alarm for context
- Add a badge distinguishing "CloudWatch" vs "Budget" alert sources
- Show the comparison operator ("> 80%" vs "< 5 GB")

### 6. Cost Transparency

Add CostBadge indicators:
- Performance & Storage metrics: "Free" badge
- Agent-required metrics: "Free (requires CW Agent setup)" badge
- Budget alerts: "Free" badge
- Note in dialog: "Drift detection scans are free -- AWS Describe API calls have no cost"

## Technical Details

### Files to modify:
1. **`src/components/NewAlertRuleDialog.tsx`** -- Redesign with metric categories, dynamic threshold labels, comparison operator, evaluation period rename
2. **`supabase/functions/manage-alert-rules/index.ts`** -- Add budget creation logic, comparison operator support, expanded metric mappings
3. **`src/hooks/useAlertRules.tsx`** -- Add `comparison_operator` to AlertRule interface
4. **`src/pages/Alerts.tsx`** -- Update active alerts display with source badges, comparison display
5. **`supabase/migrations/[timestamp].sql`** -- Add `comparison_operator` column to `alert_rules`
6. **`src/integrations/supabase/types.ts`** -- Regenerate types

### New metric mapping in edge function:

```text
Performance (CloudWatch - Free):
  CPUUtilization       -> AWS/EC2
  NetworkIn            -> AWS/EC2
  NetworkOut           -> AWS/EC2
  DatabaseConnections  -> AWS/RDS
  ReadLatency          -> AWS/RDS
  WriteLatency         -> AWS/RDS

Storage (CloudWatch - Free):
  FreeStorageSpace     -> AWS/RDS
  VolumeReadOps        -> AWS/EBS
  VolumeWriteOps       -> AWS/EBS

Cost (AWS Budgets API):
  MonthlyBudget        -> budgets:CreateBudget
  ServiceBudget        -> budgets:CreateBudget

Agent-Required:
  MemoryUtilization    -> CWAgent (existing)
  DiskUtilization      -> CWAgent (existing)
```

### IAM permissions needed (to document in setup):
- Existing: `cloudwatch:PutMetricAlarm`, `cloudwatch:DeleteAlarms`
- New: `budgets:CreateBudget`, `budgets:DeleteBudget`, `budgets:ViewBudget`

### Edge cases:
- Budget alerts only work in `us-east-1` for consolidated billing -- the edge function will handle region override automatically
- If user lacks budgets permissions, show a clear error message rather than failing silently
- Existing alert rules with no `comparison_operator` default to "GreaterThanThreshold" via the DB default

