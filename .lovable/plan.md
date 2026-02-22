

# Rename "CloudHub" to "Clodaro" -- Visual/UI Text Only

## Scope
Only user-visible text (labels, titles, descriptions, toast messages, email content) will be changed. Internal code identifiers like variable names, hook names, function names, localStorage keys, DB table names, and file names will remain unchanged.

## Files to Modify

### Pages
1. **src/pages/Homepage.tsx** -- Header brand name, footer brand name, footer copyright text
2. **src/pages/Auth.tsx** -- "CloudHub" in header, "Welcome to CloudHub" card title
3. **src/pages/Setup.tsx** -- "CloudHub Setup" heading
4. **src/pages/Settings.tsx** -- "Customize how CloudHub looks and feels" description
5. **src/pages/Alerts.tsx** -- "modified outside of CloudHub" description text

### Components
6. **src/components/CreateRoleDialog.tsx** -- Dialog title "Create CloudHub Role", AWS role preview text "CloudHub-Project-...", tag badges ("ManagedBy: CloudHub", "CloudHubUserId", "CloudHubUserEmail")
7. **src/components/DriftScheduleSettings.tsx** -- "How often CloudHub should check..."
8. **src/components/SESSetupCard.tsx** -- Email subject "CloudHub SES Test Email", email body text, card description "send alert emails from CloudHub"
9. **src/components/DriftDetailsDialog.tsx** -- Any "outside of CloudHub" text
10. **src/components/ComplianceDashboard.tsx** -- Any visible CloudHub references
11. **src/components/ManageIAMPermissionsDialog.tsx** -- Any visible "CloudHub-Scoped-" label text

### Hooks (toast/UI messages only)
12. **src/hooks/useDriftDetection.tsx** -- Toast message "Resources were changed outside of CloudHub"
13. **src/hooks/useCloudHubRoles.tsx** -- Toast descriptions: "Role deleted from CloudHub and AWS", "Role removed from CloudHub"

### Metadata
14. **index.html** -- Page title, meta description, OG title
15. **README.md** -- All "CloudHub" brand text

## What Will NOT Change
- File names (e.g., `useCloudHubRoles.tsx` stays as-is)
- Variable/function/interface names (e.g., `CloudHubRole`, `useCloudHubRoles`)
- Import paths
- localStorage keys (e.g., `cloudhub-login-attempts`)
- Database table names (`cloudhub_roles`)
- Edge function directory names or internal logic
- AWS resource naming prefixes in backend code
- Logo asset filename (`cloudhub-logo.png`)

