

## Edit Existing Alert Rules — In-Place Threshold/Condition Changes

### Current State

- Alert rules can only be created or deleted. No edit capability exists.
- The Actions column in the Alert Rules table only has a delete button (trash icon).
- `manage-alert-rules` edge function handles `create`, `delete`, and `toggle` — no `update` action.
- `NewAlertRuleDialog` is create-only (hardcoded title "Create New Alert Rule", resets form on close, submit button says "Create Rule").
- `useAlertRules` hook has `createRule`, `deleteRule`, `toggleRule` — no `updateRule`.

### Changes

**1. Edge Function: Add `update` action to `manage-alert-rules/index.ts`**

New `handleUpdate` function:
- Accepts `ruleId` plus editable fields: `threshold`, `duration`, `severity`, `comparison_operator`.
- Name and metric are **not editable** — changing the metric would require a different CloudWatch alarm namespace/metric. The alarm name is derived from the rule name, so changing it would orphan the old alarm.
- Fetches the existing rule from DB, validates ownership (RLS handles this).
- For CloudWatch alarms (`type !== 'budget'`): calls `PutMetricAlarmCommand` with the existing `cloudwatch_alarm_name` but updated `Threshold`, `Period`, `ComparisonOperator`. PutMetricAlarm is idempotent — calling it with the same alarm name updates the alarm in place.
- For budget alarms: deletes the old budget and creates a new one with updated limit (AWS Budgets API has no update-limit endpoint; `UpdateBudget` exists but is more complex — delete+recreate is simpler and the budget name stays the same).
- Updates the DB row with new `threshold`, `duration`, `severity`, `comparison_operator`.
- Returns the updated rule.

Add `'update'` case to the `switch(action)` block.

**2. Hook: Add `updateRule` to `useAlertRules.tsx`**

```typescript
const updateRule = async (ruleId: string, updates: {
  threshold: string;
  duration: string;
  severity: string;
  comparison_operator: string;
}) => { ... }
```

Calls `supabase.functions.invoke('manage-alert-rules', { body: { action: 'update', ruleId, ...updates } })`. Shows success/error toast. Refreshes rules list on success.

Export `updateRule` from the hook.

**3. Refactor `NewAlertRuleDialog` → `AlertRuleDialog` (edit + create)**

Add an optional `editingRule` prop:

```typescript
interface AlertRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { ... }) => Promise<boolean>;
  loading?: boolean;
  editingRule?: {
    id: string;
    name: string;
    metric: string;
    threshold: number;
    duration: number;
    severity: string;
    comparison_operator: string;
  } | null;
}
```

When `editingRule` is provided:
- Dialog title: "Edit Alert Rule" instead of "Create New Alert Rule"
- Pre-fill form fields from `editingRule`
- **Disable** the name and metric fields (not editable — explained above)
- Submit button text: "Save Changes" instead of "Create Rule"
- On open, initialize form state from `editingRule` values

When `editingRule` is null/undefined, behavior is identical to current create flow.

**4. Update `Alerts.tsx` UI**

- Add state: `editingRule` and `setEditingRule`.
- Add an edit button (pencil icon) next to the delete button in the Actions column for user-created rules.
- Clicking edit sets `editingRule` to the rule data and opens the dialog.
- Pass `editingRule` to the dialog component.
- The `onSubmit` handler checks if editing: calls `updateRule(editingRule.id, data)` instead of `createRule(data)`.
- Import `Pencil` from lucide-react.

### Technical Details

- **Why not allow metric changes**: The CloudWatch alarm name includes the rule name, and the alarm is bound to a specific namespace/metric. Changing the metric would require deleting the old alarm and creating a new one with a different configuration — effectively a delete+create. Keeping name and metric locked avoids orphaned alarms.
- **PutMetricAlarm idempotency**: AWS CloudWatch's `PutMetricAlarm` with an existing alarm name updates that alarm in place. No need to delete and recreate. This is the correct API for threshold/period/comparison changes.
- **Budget updates**: AWS Budgets `UpdateBudget` command exists but requires sending the full budget object. We use delete+create for simplicity since the budget name stays the same and there are no subscribers to preserve (SNS placeholder).
- **No migration needed**: No schema changes — all editable fields already exist in `alert_rules`.

