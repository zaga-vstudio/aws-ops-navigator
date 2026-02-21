

# Phase 1: Central AWS Data Provider

## Goal
Eliminate 14 independent `useAWSData()` calls across the app, each triggering its own fetch to the `aws-dashboard-data` edge function (which makes 8+ AWS API calls). Replace with a single React Context provider so data is fetched once and shared.

## Changes

### 1. Create `src/contexts/AWSDataContext.tsx`
- New file that creates a React Context wrapping the existing `useAWSData()` hook
- Calls `useAWSData()` once and exposes all its return values (`data`, `loading`, `error`, `refetch`, `refetchWithForceRefreshCost`, `costExplorerState`, `enableCostExplorer`, `disableCostExplorer`) via context
- Exports `AWSDataProvider` component and `useAWSDataContext()` consumer hook
- The consumer hook throws if used outside the provider (standard pattern)

### 2. Wrap authenticated routes in `src/App.tsx`
- Import and wrap all dashboard routes (everything except `/`, `/auth`, and `*`) inside `<AWSDataProvider>`
- The provider sits inside `AuthProvider` so it has access to auth state

### 3. Replace all `useAWSData()` calls with `useAWSDataContext()`
Update these 14 files to import from the context instead of calling the hook directly:

| File | What it uses |
|---|---|
| `src/pages/Dashboard.tsx` | `data`, `loading`, `refetch` |
| `src/pages/EC2Instances.tsx` | `data`, `loading`, `refetch` |
| `src/pages/RDSDatabases.tsx` | `data`, `loading`, `error`, `refetch` |
| `src/pages/VPCNetworking.tsx` | `data`, `loading`, `error`, `refetch` |
| `src/pages/Security.tsx` | `data`, `loading`, `error`, `refetch` |
| `src/pages/CostManagement.tsx` | `data`, `loading`, `refetch`, `refetchWithForceRefreshCost`, `costExplorerState`, `enableCostExplorer`, `disableCostExplorer` |
| `src/pages/Monitoring.tsx` | `data`, `loading`, `error`, `refetch` |
| `src/pages/Alerts.tsx` | `data`, `loading`, `error`, `refetch` |
| `src/pages/ActivityLog.tsx` | `data`, `loading`, `refetch` |
| `src/pages/Settings.tsx` | `data`, `costExplorerState`, `enableCostExplorer`, `disableCostExplorer` |
| `src/components/AppSidebar.tsx` | `data` |
| `src/components/ResourceOverview.tsx` | `data`, `loading`, `error` |
| `src/components/CostChart.tsx` | `data`, `loading` |
| `src/hooks/useNotifications.tsx` | `data` |

### 4. Add `staleTime` to prevent unnecessary refetches
- Inside `AWSDataContext`, the single `useAWSData()` call already manages its own state; we keep it as-is but the key win is it only runs once instead of 14 times

---

# Phase 2: Wire Up Dashboard Quick Actions

## Goal
The four Quick Action buttons on the Dashboard ("Launch EC2", "Create RDS", "Cost Analysis", "Monitor") currently do nothing. Wire them to open existing dialogs or navigate to the correct pages.

## Changes

### 1. Update `src/pages/Dashboard.tsx`
- Add state variables for `launchEC2Open` and `createRDSOpen` dialog visibility
- Import `LaunchEC2Dialog` and `CreateRDSDialog` components
- Import `useNavigate` (already imported)
- Wire the four buttons:
  - **Launch EC2** -- opens `LaunchEC2Dialog` (`setLaunchEC2Open(true)`)
  - **Create RDS** -- opens `CreateRDSDialog` (`setCreateRDSOpen(true)`)
  - **Cost Analysis** -- navigates to `/costs` (`navigate('/costs')`)
  - **Monitor** -- navigates to `/monitoring` (`navigate('/monitoring')`)
- Render `<LaunchEC2Dialog>` and `<CreateRDSDialog>` at the bottom of the component, with `onSuccess` calling `refetch` to refresh data after resource creation

## Technical Notes

- `LaunchEC2Dialog` expects props: `open`, `onOpenChange`, `onSuccess`
- `CreateRDSDialog` expects props: `open`, `onOpenChange`, `onSuccess`
- Both dialogs already handle their own form state, validation, and AWS API calls internally
- After Phase 1, the `refetch` used in `onSuccess` comes from `useAWSDataContext()`, so newly created resources appear across the entire app

## File Summary

| File | Phase | Action |
|---|---|---|
| `src/contexts/AWSDataContext.tsx` | 1 | Create -- context provider and consumer hook |
| `src/App.tsx` | 1 | Edit -- wrap routes with `AWSDataProvider` |
| 14 files (pages, components, hooks) | 1 | Edit -- replace `useAWSData()` with `useAWSDataContext()` |
| `src/pages/Dashboard.tsx` | 2 | Edit -- wire Quick Actions to dialogs and navigation |
