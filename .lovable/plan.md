
# Fix Notification Dismiss & Red Badge Sync

## Problem

When you dismiss notifications by clicking the X button, they disappear from the dropdown list, but the red dot on the bell icon stays. This happens because:

- Dismissing only hides notifications visually inside the dropdown (local component state)
- The red badge reads from a separate counter that never updates
- Dismissed notifications are also lost when you navigate to another page

## Solution

Move the dismissed/read state into the `useNotifications` hook so the red badge and the dropdown share the same source of truth. Add a "Mark All Read" button for convenience.

## Changes

### 1. Update `useNotifications` hook

**File:** `src/hooks/useNotifications.tsx`

- Add `dismissedIds` state inside the hook (shared across all consumers)
- Expose a `dismissNotification(id)` function and a `dismissAll()` function
- Filter dismissed notifications out of `unreadCount` so the red badge updates immediately
- Persist dismissed IDs to `localStorage` so they survive page navigation

### 2. Update `NotificationsDropdown` component

**File:** `src/components/NotificationsDropdown.tsx`

- Remove the local `dismissedIds` state (no longer needed)
- Call `dismissNotification(id)` from the hook instead
- Add a "Mark All Read" button in the header when there are unread notifications
- Use the hook's already-filtered notification list and count

### 3. Update `NotificationBadge` component

**File:** `src/components/NotificationBadge.tsx`

- No logic changes needed -- it already reads from `useNotifications`, so once the hook is fixed, sidebar badges will also update correctly when notifications are dismissed

## Technical Details

```text
Before:
  useNotifications (read=false always) --> unreadCount (never changes)
  NotificationsDropdown (local dismissedIds) --> hides items visually only

After:
  useNotifications (tracks dismissedIds + localStorage) --> unreadCount (updates on dismiss)
  NotificationsDropdown (calls hook.dismiss) --> both list and badge stay in sync
```

### File Summary

| File | Action |
|---|---|
| `src/hooks/useNotifications.tsx` | Edit -- add dismiss state, localStorage persistence, expose dismiss functions |
| `src/components/NotificationsDropdown.tsx` | Edit -- remove local state, use hook functions, add "Mark All Read" button |
