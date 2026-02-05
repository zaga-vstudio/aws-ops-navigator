
# Enhanced EC2 Instance Connection Plan

## Overview
This enhanced plan adds SSH key pair selection during instance creation, stores the OS platform as a tag for accurate username detection, enables browser-based connections via AWS EC2 Instance Connect, and validates security group rules before connecting.

---

## What You'll Get

| Feature | Description |
|---------|-------------|
| **Key Pair Selection** | Choose an existing SSH key pair when launching instances |
| **Platform Tagging** | OS type stored as a "Platform" tag for accurate username detection |
| **Smart Connect** | Click "Connect" to open EC2 Instance Connect with the correct username |
| **Security Validation** | Warning tooltip if Port 22 is closed in the security group |
| **Custom AMI Fallback** | Defaults to ec2-user with a UI hint for custom AMIs |
| **Region-aware Keys** | Key pair list filtered by the user's configured AWS region |

---

## Implementation Details

### 1. Backend: Add Key Pair Listing with Region Support

**File**: `supabase/functions/manage-ec2-instances/index.ts`

Add a new `listKeyPairs` action that fetches SSH key pairs from the user's configured region:

```text
New Import:
  DescribeKeyPairsCommand from @aws-sdk/client-ec2

New Function:
  async function listKeyPairs(config: AWSConfig): Promise<KeyPair[]>
  - Creates EC2 client with user's region from config
  - Sends DescribeKeyPairsCommand
  - Returns: [{ name: "my-key", fingerprint: "xx:xx:...", keyType: "rsa" }]

New Action in switch statement:
  case 'listKeyPairs':
    result = await listKeyPairs(awsConfig);
```

Key points:
- Uses the user's stored AWS region from credentials (no separate region param needed)
- Returns key pairs available in that specific region
- Minimal permissions required: `ec2:DescribeKeyPairs`

---

### 2. Backend: Enhanced Instance Launch with Platform Tag

**File**: `supabase/functions/manage-ec2-instances/index.ts`

Update the launch function to store a more detailed "Platform" tag:

```text
Current Tags (line 250-259):
  - Name
  - CreatedBy
  - OS

Enhanced Tags:
  - Name (unchanged)
  - CreatedBy (unchanged)  
  - Platform: Human-readable name (e.g., "Ubuntu", "Amazon Linux", "Kali Linux")
  - PlatformId: Machine-readable ID (e.g., "ubuntu-22", "amazon-linux-2023")
  - SSHUser: Default username for this OS (e.g., "ubuntu", "ec2-user", "kali")
```

This allows the Connect feature to read the exact username without guessing.

---

### 3. Backend: Expand EC2 Instance Data Structure

**File**: `supabase/functions/aws-dashboard-data/index.ts`

Update `getEC2Instances` function (lines 234-288) to return additional fields:

```text
Current Fields:
  id, name, type, state, region, availabilityZone, launchTime, publicIp, privateIp

New Fields:
  + platform: string (from "Platform" tag)
  + platformId: string (from "PlatformId" tag)
  + sshUser: string (from "SSHUser" tag or inferred)
  + securityGroupIds: string[] (for Port 22 validation)
  + keyName: string | null (attached key pair)
```

**File**: `src/hooks/useAWSData.tsx`

Update the `EC2Instance` interface to match:

```text
export interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  region: string;
  availabilityZone: string;
  launchTime: string;
  publicIp?: string;
  privateIp?: string;
  // New fields:
  platform?: string;
  platformId?: string;
  sshUser?: string;
  securityGroupIds?: string[];
  keyName?: string;
}
```

---

### 4. Frontend: Key Pair Selection in Launch Dialog

**File**: `src/components/LaunchEC2Dialog.tsx`

Add key pair selection between Instance Type and the console toggle:

```text
New State:
  const [keyPairs, setKeyPairs] = useState<KeyPair[]>([]);
  const [selectedKeyPair, setSelectedKeyPair] = useState<string>('');
  const [loadingKeyPairs, setLoadingKeyPairs] = useState(false);

New useEffect (fetch on dialog open):
  - Calls manage-ec2-instances with action: 'listKeyPairs'
  - Populates keyPairs state
  - Sets selectedKeyPair to empty string (user must choose)

New UI Section (after Instance Type):
  <Select> dropdown with options:
    - "Select a key pair..." (placeholder)
    - [List of available key pairs with fingerprints]
    - "Proceed without key pair" option
    - "Create new key pair (AWS Console)" - opens AWS in new tab

Warning Display:
  If no key pair selected, show amber alert:
  "Without a key pair, you can only connect via EC2 Instance Connect (requires public IP)."

Update handleLaunch:
  Pass keyName: selectedKeyPair to the API call
```

---

### 5. Frontend: Enable Connect Button with Validation

**File**: `src/pages/EC2Instances.tsx`

Replace the disabled "Connect" menu item with a working implementation:

```text
New Imports:
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
  import { Terminal, AlertTriangle } from "lucide-react";

New Helper: OS Username Mapping
  const getDefaultSSHUser = (platformId?: string, platform?: string): { user: string; isDefault: boolean } => {
    // Check stored sshUser tag first
    // Then map known platforms:
    //   amazon-linux-*, rhel-*, centos-*, rocky-*, alma-*, suse-* -> "ec2-user"
    //   ubuntu-* -> "ubuntu"
    //   debian-* -> "debian" or "admin"
    //   kali-* -> "kali"
    //   windows-* -> null (disable Connect)
    //   custom/unknown -> { user: "ec2-user", isDefault: true }

New Helper: Check Port 22
  const isPort22Open = (instance: EC2Instance, securityGroups: SecurityGroup[]): boolean => {
    // Find security groups attached to this instance
    // Check if any inbound rule allows TCP port 22 (or -1 for all)
    // Returns true if accessible, false if blocked

New Handler: handleConnect
  const handleConnect = (instance: EC2Instance) => {
    const { user, isDefault } = getDefaultSSHUser(instance.platformId, instance.sshUser);
    const region = instance.availabilityZone.slice(0, -1); // e.g., "us-east-1a" -> "us-east-1"
    
    const url = `https://${region}.console.aws.amazon.com/ec2-instance-connect/ssh`
      + `?region=${region}&instanceId=${instance.id}&osUser=${user}`;
    
    window.open(url, '_blank');
    
    if (isDefault) {
      toast({
        title: "Using default username",
        description: `Trying ec2-user. If this fails, the correct username may vary for custom AMIs.`,
      });
    }
  };

Updated Menu Item:
  Replace <DropdownMenuItem disabled>Connect</DropdownMenuItem> with:
  
  {instance.state === 'running' && !instance.platform?.startsWith('windows') && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuItem
            onClick={() => handleConnect(instance)}
            disabled={!instance.publicIp}
            className={!isPort22Open(instance, securityGroups) ? 'text-amber-500' : ''}
          >
            <Terminal className="h-4 w-4 mr-2" />
            Connect
            {!isPort22Open(instance, securityGroups) && (
              <AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
            )}
          </DropdownMenuItem>
        </TooltipTrigger>
        <TooltipContent>
          {!instance.publicIp 
            ? "No public IP - cannot connect via browser"
            : !isPort22Open(instance, securityGroups)
              ? "Port 22 may be closed in security group"
              : `Connect as ${getDefaultSSHUser(instance.platformId, instance.sshUser).user}`
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )}
```

---

## Username Mapping Reference

| Platform ID | Default SSH User |
|-------------|------------------|
| amazon-linux-2023, amazon-linux-2 | ec2-user |
| ubuntu-22, ubuntu-24 | ubuntu |
| debian-12 | debian |
| rhel-9 | ec2-user |
| centos-stream-9 | centos |
| rocky-linux-9 | rocky |
| alma-linux-9 | almalinux |
| kali-linux | kali |
| suse-15 | ec2-user |
| windows-* | (Connect hidden) |
| custom / unknown | ec2-user (with hint) |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/manage-ec2-instances/index.ts` | Add `DescribeKeyPairsCommand`, `listKeyPairs` function, new action handler, enhanced tags in launch |
| `supabase/functions/aws-dashboard-data/index.ts` | Expand EC2Instance mapping to include platform tags, security group IDs, key name |
| `src/hooks/useAWSData.tsx` | Update EC2Instance interface with new fields |
| `src/components/LaunchEC2Dialog.tsx` | Add key pair state, fetch on open, add Select dropdown, pass keyName to API |
| `src/pages/EC2Instances.tsx` | Add handleConnect, username mapping, Port 22 validation, tooltip warnings |

---

## AWS Permissions Required

| Permission | Purpose |
|------------|---------|
| `ec2:DescribeKeyPairs` | List available SSH key pairs |
| `ec2:RunInstances` | Launch instances (existing) |
| `ec2:CreateTags` | Apply Platform/SSHUser tags (existing) |

---

## User Experience Flows

### Launching with Key Pair

1. User opens Launch Instance dialog
2. Key pairs load automatically from AWS
3. User selects an existing key pair (or proceeds without)
4. If no key pair selected, warning displays
5. Instance launches with Platform and SSHUser tags applied
6. Instance appears in list with connection metadata

### Connecting to Instance

1. User sees running instance in EC2 table
2. Hovers over "Connect" in actions menu
3. **If no public IP**: Disabled with tooltip "No public IP"
4. **If Port 22 closed**: Amber warning icon with tooltip "Port 22 may be closed"
5. **If OK**: Tooltip shows "Connect as ubuntu" (or appropriate user)
6. Click opens AWS EC2 Instance Connect in new tab
7. **For custom AMIs**: Toast notification "Trying default user: ec2-user"

---

## Important Notes

- **No Additional Costs**: Key pair listing and EC2 Instance Connect are free AWS features
- **Public IP Required**: EC2 Instance Connect requires the instance to have a public IP address
- **Security Group Check**: Port 22 validation is a UX warning only, does not block the action
- **Region Handling**: Key pairs are automatically filtered to the user's configured AWS region
- **Windows Instances**: Connect button hidden entirely (requires RDP, not SSH)
- **Fallback Behavior**: Unknown/custom AMIs default to ec2-user with a clear UI hint
