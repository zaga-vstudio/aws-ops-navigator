

## Remove Redundant Auth Check from Dashboard.tsx

### Problem
`Dashboard.tsx` duplicates the authentication guard that `ProtectedRoute` already provides. It imports `useAuth`, checks `loading` and `user` states, renders its own loading spinner, and redirects to `/auth` -- all of which `ProtectedRoute` handles before `Dashboard` even mounts.

### Changes

**File: `src/pages/Dashboard.tsx`**

1. Remove the `useAuth` import and hook call (`const { user, loading } = useAuth()`)
2. Remove the `useEffect` that redirects to `/auth` when no user is present (lines 33-37)
3. Remove the loading spinner block (lines 39-48) -- `ProtectedRoute` already shows a spinner
4. Remove the early return for `!user` (lines 50-52)
5. Remove the unused `useEffect` import if no other effect remains
6. Remove unused `useNavigate` import if `navigate` is no longer referenced elsewhere in the file -- but `navigate` is still used in the Quick Actions section (lines 168, 178), so `useNavigate` stays

This leaves `Dashboard` focused purely on rendering the dashboard UI, trusting `ProtectedRoute` to guarantee an authenticated user.

### Lines removed (approximately)

- Line 13: `import { useAuth } from "@/hooks/useAuth";` -- remove
- Line 27: `const { user, loading } = useAuth();` -- remove  
- Lines 33-37: `useEffect(() => { if (!loading && !user) navigate('/auth'); }, ...)` -- remove
- Lines 39-48: Loading spinner conditional return -- remove
- Lines 50-52: `if (!user) return null;` -- remove
- Line 1: Remove `useEffect` from the React import (keep `useState`)

No other files are affected.

