

## Auto-Refresh / Polling for AWS Data

### Problem
AWS data is fetched once on initial load and never refreshed automatically. If resources change (e.g., an EC2 instance terminates), the dashboard stays stale until the user manually clicks "Refresh Data."

### Solution
Add a configurable polling interval to the `useAWSData` hook that silently refetches data in the background. The polling will:
- Default to every 5 minutes (300 seconds)
- Only poll when the browser tab is visible (pause when hidden)
- Use a silent refresh (no loading spinner) so the UI doesn't flash skeleton loaders
- Show a subtle "last updated" indicator so users know data freshness
- Expose a way for the Dashboard to display the last refresh timestamp

### Changes

**1. `src/hooks/useAWSData.tsx`**
- Add a `lastUpdated` timestamp state, set after each successful fetch
- Add a `useEffect` with `setInterval` for polling every 5 minutes
- Use the `document.visibilitychange` event to pause/resume polling when the tab is hidden/visible
- Introduce a silent fetch mode: when polling, skip `setLoading(true)` so the UI doesn't show skeletons -- only show loading on the initial fetch
- Return `lastUpdated` from the hook

**2. `src/contexts/AWSDataContext.tsx`**
- Add `lastUpdated: Date | null` to the context type so consuming components can display it

**3. `src/pages/Dashboard.tsx`**
- Display a small "Last updated: X minutes ago" text near the "Refresh Data" button using `date-fns`'s `formatDistanceToNow`
- The text updates reactively when polling refreshes data

### Technical Details

```text
Polling flow:
  useEffect (mount)
    -> setInterval(silentFetch, 300_000)   // 5 min
    -> visibilitychange listener
         tab hidden  -> clearInterval
         tab visible -> immediate fetch + restart interval
  cleanup -> clearInterval + remove listener
```

Silent fetch means: `fetchAWSData` gets a new `{ silent: true }` option that skips `setLoading(true)`, so existing data stays visible while the refresh happens in the background.

The 5-minute default balances freshness against AWS API costs. No additional edge function changes are needed since the existing `aws-dashboard-data` function is reused.

