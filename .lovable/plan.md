

# Fix: MFA Verification Bypassed on Login

## Problem
When a user with 2FA enabled signs in, they are redirected to the dashboard before the MFA verification dialog can appear. This happens because:

1. `handleSignIn` calls `signIn()` (line 142), which triggers `onAuthStateChange` in `useAuth.tsx`
2. The auth listener sets `user` state
3. The `useEffect` on line 89-107 in `Auth.tsx` sees `user` is truthy and immediately navigates to `/dashboard`
4. Meanwhile, `checkMFARequired()` (line 164) has not yet run or completed

The navigation effect wins the race every time.

## Solution
Add a `pendingMFA` state flag that blocks the auto-navigation when MFA verification is still needed.

### Changes in `src/pages/Auth.tsx`
1. Add a new state variable `pendingMFACheck` (default `false`) that is set to `true` when sign-in succeeds and the user has MFA factors, and cleared after MFA check completes.
2. Update the navigation `useEffect` (lines 89-107) to also bail out when `showMFAVerification` is `true` or `pendingMFACheck` is `true`.
3. In `handleSignIn`, set `pendingMFACheck = true` before calling `signIn`, then after checking MFA:
   - If MFA is required: show the dialog (navigation remains blocked by `showMFAVerification`)
   - If MFA is NOT required: set `pendingMFACheck = false` to allow the navigation effect to proceed

### Changes in `src/hooks/useAuth.tsx`
4. Remove the automatic redirect to `/aws-setup` inside `onAuthStateChange` (lines 52-63) since `Auth.tsx` already handles post-login routing. This secondary navigation also contributes to the race condition.

## Technical Details

```text
Current flow:
  signIn() --> user state set --> useEffect navigates --> TOO LATE for MFA

Fixed flow:
  signIn() --> pendingMFACheck=true --> user state set --> useEffect blocked
           --> checkMFARequired()
               --> MFA needed? Show dialog (stays blocked)
               --> No MFA? pendingMFACheck=false --> useEffect navigates
```

### Files modified:
- **src/pages/Auth.tsx** -- Add `pendingMFACheck` state, gate the navigation effect, restructure `handleSignIn`
- **src/hooks/useAuth.tsx** -- Remove the `SIGNED_IN` redirect logic inside `onAuthStateChange` (lines 52-63) to prevent duplicate/competing navigation

