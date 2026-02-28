

## Problem

The `cost_data_cache` table has a unique constraint on `(user_id, aws_region)`, but `saveCostDataToCache` uses `onConflict: 'user_id'`. This mismatch causes the upsert to silently fail on updates — the cache was written once (Jan 22) and never updated since. When Cost Explorer is disabled, the backend returns this stale cached data instead of the fresh data the user just fetched.

Additionally, the upsert payload doesn't include `aws_region`, so even with the correct conflict target it would fail.

## Fix

**`supabase/functions/aws-dashboard-data/index.ts`** — Two changes in `saveCostDataToCache`:

1. Add `aws_region` to the upsert data (use the config's region or default `'us-east-1'`)
2. Change `onConflict` from `'user_id'` to `'user_id, aws_region'`

```typescript
// In saveCostDataToCache, add region parameter and fix upsert:
const upsertData = {
  user_id: userId,
  aws_region: region,  // add this
  service_breakdown: costData.serviceBreakdown,
  // ... rest stays the same
};

const { error } = await supabase
  .from('cost_data_cache')
  .upsert(upsertData, { onConflict: 'user_id, aws_region' }); // fix this
```

Also update the `getCostData` function to pass the region through to `saveCostDataToCache`, and update `getCachedCostData` to filter by region.

