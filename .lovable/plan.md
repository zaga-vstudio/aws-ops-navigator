

# Fix 2FA: QR Code Display and Manual Code Verification

## Root Cause

Supabase returns the QR code as **raw SVG XML** (e.g., `<?xml version="1.0"?><svg ...>`), not as a `data:image/svg+xml` data URI. The current conversion code only checks for `data:image/svg` prefix, so:
- The SVG-to-PNG conversion is skipped entirely
- The raw SVG string is set as the `<img src>`, which renders nothing useful
- The QR code appears broken or un-scannable

## Fix

### File: `src/components/Enable2FADialog.tsx`

**1. Fix SVG detection to handle raw SVG XML:**

Update the `enrollMFA` function to detect both formats:
- `data:image/svg+xml` data URIs (current check)
- Raw SVG strings starting with `<?xml` or `<svg`

When raw SVG is detected, first convert it to a proper data URI (`data:image/svg+xml;charset=utf-8,` + URL-encoded SVG), then pass it to the canvas PNG conversion.

**2. Increase canvas resolution for better scanning:**

Change from 200x200 to 300x300 pixels for a crisper QR code that authenticator cameras can read more reliably.

**3. Add fallback rendering:**

If PNG conversion fails, render the SVG directly using `dangerouslySetInnerHTML` inside a container div as a last resort, so the user can at least see and try to scan something.

## Technical Details

The updated conversion flow:

```text
1. Receive raw SVG XML from Supabase (e.g., "<?xml ...><svg ...>")
2. Wrap it as a data URI: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
3. Load into an Image element
4. Draw onto a 300x300 Canvas with white background
5. Export as data:image/png
6. Display in <img> tag
```

Changes are confined to a single file: `src/components/Enable2FADialog.tsx`

- Update `convertSvgToPng` to accept both raw SVG and data URIs
- Update `enrollMFA` to always attempt conversion regardless of prefix
- Increase canvas size to 300x300
- Add inline SVG fallback if canvas conversion fails
