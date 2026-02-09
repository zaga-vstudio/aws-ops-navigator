
# Fix EC2 Connect and Add "Connect with SSH" Option

## Problems Identified

1. **COOP Error**: The `handleConnect` function uses `window.open()` which triggers Cross-Origin-Opener-Policy errors when navigating to the AWS Console. This is the same issue that was fixed in the Launch Dialog.

2. **Malformed URL**: The generated EC2 Instance Connect URL is missing required parameters (`connType`, `sshPort`, `addressFamily`) which causes AWS to redirect to an incorrect page.

## Changes

### File: `src/pages/EC2Instances.tsx`

**Fix the Connect handler (replace `window.open` with anchor-based navigation):**
- Remove the `handleConnect` function that uses `window.open()`
- Instead, generate the correct URL inline and render the "Connect" menu item as an `<a>` tag with `target="_blank"` and `rel="noopener noreferrer"`
- Fix the URL format to include all required AWS parameters:
  ```
  https://{region}.console.aws.amazon.com/ec2-instance-connect/ssh
    ?region={region}
    &connType=standard
    &instanceId={id}
    &osUser={user}
    &sshPort=22
    &addressFamily=ipv4
  ```

**Add a "Connect with SSH" menu item:**
- Add a second connection option below "Connect" for instances that have an associated key pair (`instance.keyName`)
- This option opens the AWS Console's SSH connection page pre-filled with the instance details, allowing users to use their key pair
- Rendered as an `<a>` tag (same pattern) pointing to:
  ```
  https://{region}.console.aws.amazon.com/ec2/home
    ?region={region}
    #ConnectToInstance:instanceId={id}
  ```
- This opens the full AWS "Connect to instance" page where the user can choose the SSH client tab and see instructions with their key pair
- Only shown when `instance.keyName` exists
- Shows the key pair name in a tooltip

**Keep existing UX features:**
- Port 22 warning tooltip (amber icon) remains
- Public IP check remains (disabled if no public IP)
- Windows instances still hidden
- Default username toast for custom AMIs still fires (moved to an `onClick` handler on the anchor)

## Technical Details

- All external AWS Console links use `<a target="_blank" rel="noopener noreferrer">` to avoid COOP errors
- The `handleConnect` function is removed; URL generation happens inline via a helper function `getConnectUrl(instance)`
- The dropdown menu items that link externally use `DropdownMenuItem asChild` wrapping an `<a>` tag, following Radix UI patterns
