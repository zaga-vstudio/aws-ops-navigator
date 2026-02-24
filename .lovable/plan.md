

## Cost Forecasting via AWS GetCostForecast (Revised)

Incorporating all feedback: `date` columns instead of `text`, nullable forecast fields, forecast next full month only, and precise UI labeling.

### Current State

- `aws-dashboard-data` fetches `GetCostAndUsage` (current month) and `getHistoricalCosts` (6-month history), caches in `cost_data_cache` with 6h TTL
- `GetCostForecast` is not imported or called anywhere
- `CostDataWithCache` has no forecast fields
- Cost Management page shows: current month spend, spending trend chart, service breakdown, top resources, anomalies, rightsizing recommendations
- Overview cards grid is `grid-cols-4`: This Month, EC2 Instances, RDS Databases, S3 Buckets

### Changes

**1. Database Migration: Add forecast columns to `cost_data_cache`**

```sql
ALTER TABLE cost_data_cache
  ADD COLUMN forecast_total numeric,
  ADD COLUMN forecast_period_start date,
  ADD COLUMN forecast_period_end date,
  ADD COLUMN forecast_data jsonb;
```

All four columns are nullable (no defaults). When forecast fails (insufficient history, new account), they remain `NULL` — semantically cleaner than empty arrays or zero values. Using `date` type for the period columns prevents invalid values and simplifies date comparisons.

**2. Backend: `supabase/functions/aws-dashboard-data/index.ts`**

- Import `GetCostForecastCommand` from `@aws-sdk/client-cost-explorer` (client already imported on line 9)
- Add `getCostForecast(config)` function:
  - **Forecasts next full month only** (1st to last day of next month). This is the cleanest interpretation — no blurred semantics from mixing remainder-of-current-month with next month.
  - Metric: `UNBLENDED_COST`
  - Granularity: `MONTHLY` (returns one data point)
  - Returns `{ forecastTotal, forecastPeriodStart, forecastPeriodEnd }` or `null` on failure
- Wrap in try/catch: `DataUnavailableException` (accounts with <30 days history) returns `null`, not an error
- Call `getCostForecast` in parallel with existing `GetCostAndUsage` and `getHistoricalCosts` inside `getCostData` (line ~940)
- Save forecast fields to `cost_data_cache` in `saveCostDataToCache`
- Read forecast fields from cache in `getCachedCostData`
- Add forecast fields to the response `CostDataWithCache` object

**3. Frontend: `src/hooks/useAWSData.tsx`**

Extend `CostDataWithCache` interface:

```typescript
forecastTotal?: number;
forecastPeriodStart?: string;  // ISO date string from DB
forecastPeriodEnd?: string;
```

No `forecastData` array needed since we forecast a single month only — `forecastTotal` is sufficient.

**4. Frontend: `src/pages/CostManagement.tsx`**

- Add a **"Projected Next Month"** overview card as the 4th card, shifting S3 Buckets to a 5th position (grid becomes `grid-cols-5` on large screens, wraps on smaller):
  - Big number: `$forecastTotal`
  - Label: **"Projected next month spend"** — precise, no ambiguity
  - Trend indicator: compares `forecastTotal` to `currentCost` (current month actual)
  - Only rendered when `forecastTotal` exists and is > 0
  - Small info text: "Based on AWS Cost Explorer forecast"

- Extend the **Spending Trend chart**:
  - Append the forecast month to `monthlySpendData` as a data point with a `forecast: true` flag
  - Render forecast point with a dashed line segment (`strokeDasharray="5 5"`) using a second `<Line>` or conditional styling
  - Tooltip differentiates "Actual: $X" vs "Forecast: $X"
  - Visual distinction makes it clear which data is historical vs projected

### Technical Details

- **Single month forecast**: `GetCostForecast` with `TimePeriod: { Start: first-of-next-month, End: first-of-month-after-next }` and `Granularity: MONTHLY`. Returns exactly one `ForecastResult` with `MeanValue`. This is the recommended approach — forecasting a single period avoids blurred semantics.
- **Cost**: One additional Cost Explorer API call ($0.01) per cache miss, batched with existing calls. Cached for 6h alongside other cost data. Negligible impact.
- **IAM permissions**: `ce:GetCostForecast` — typically included in the same IAM policy as `ce:GetCostAndUsage`.
- **When Cost Explorer is disabled**: If cached forecast data exists, it's shown with the "Historical Data" badge (same pattern as existing cost data). If no cached forecast exists, the card is hidden.
- **DataUnavailableException**: AWS requires ~30 days of billing history. New accounts get `null` forecast — card hidden, no error shown. This is logged but not surfaced to the user.
- **`date` column type**: PostgreSQL `date` stores `YYYY-MM-DD` without timezone. The edge function writes ISO date strings (`2026-03-01`), which PostgreSQL auto-casts to `date`. Frontend receives them as strings via JSON.

