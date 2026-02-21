

# Fix Two-Factor Authentication QR Code and Enrollment Flow

## Problem
The QR code generated during 2FA setup did not work with your authenticator app. This is caused by two issues:

1. **SVG QR Code Compatibility** -- Supabase returns the QR code as an SVG data URI (`data:image/svg+xml`). Many authenticator apps (especially on older phones or certain Android versions) struggle to scan SVG-based QR codes. The fix is to convert it to a PNG using the HTML Canvas API, which produces a rasterized image that all authenticator apps can scan reliably.

2. **Stale Unverified Factor** -- Your account already has a leftover unverified TOTP factor from the previous failed attempt. When opening the dialog again, the code tries to enroll a new factor but the old one lingers, causing confusion. The fix is to automatically clean up any unverified factors before enrolling a new one.

## Changes

### File: `src/components/Enable2FADialog.tsx`

**Cleanup stale factors before enrollment:**
- Before calling `supabase.auth.mfa.enroll()`, list existing factors and unenroll any with status "unverified"
- This prevents the "factor already exists" error on retry

**Convert SVG QR to PNG for universal compatibility:**
- After receiving the `data:image/svg+xml` QR code URI from Supabase, render it onto an HTML `<canvas>` element
- Export the canvas as a `data:image/png` base64 URI
- Display the PNG version instead of the raw SVG
- This ensures all authenticator apps (Google Authenticator, Authy, Microsoft Authenticator, etc.) can scan it

**Improve the manual entry experience:**
- Format the TOTP secret in groups of 4 characters (e.g., `ABCD EFGH IJKL MNOP`) for easier manual typing
- Show the issuer name ("CloudHub") so users know which account the code belongs to in their authenticator app

**Reset dialog state properly:**
- Reset `step`, `qrCode`, `secret`, and `verifyCode` when the dialog closes
- Fix the `useEffect` to handle re-opening correctly by resetting to "enroll" step on open

**Add error recovery:**
- If enrollment fails, show a "Retry" button instead of closing the dialog immediately
- Display a clearer error message explaining what went wrong

### Technical Details

The SVG-to-PNG conversion works as follows:

```text
1. Receive data:image/svg+xml URI from Supabase
2. Create an Image element, set src to the SVG URI
3. On image load, draw it onto a 200x200 Canvas
4. Call canvas.toDataURL('image/png') to get PNG URI
5. Display the PNG in the <img> tag
```

No new dependencies are needed -- Canvas API is built into all browsers.

### Summary of fixes:
- Clean up unverified TOTP factors before new enrollment
- Convert QR code from SVG to PNG for universal scanner compatibility
- Format the manual secret key for readability
- Reset dialog state on close/reopen
- Add retry capability on enrollment failure
