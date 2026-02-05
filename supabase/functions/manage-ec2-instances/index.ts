import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { 
  EC2Client, 
  RunInstancesCommand, 
  StartInstancesCommand, 
  StopInstancesCommand, 
  RebootInstancesCommand,
  TerminateInstancesCommand,
  DescribeImagesCommand,
  DescribeKeyPairsCommand
} from "npm:@aws-sdk/client-ec2@3.451.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AWSConfig {
  access_key_id: string;
  secret_access_key: string;
  aws_region: string;
}

interface LaunchInstanceParams {
  name: string;
  instanceType: string;
  amiId?: string;
  customAmiId?: string;
  osType?: string;
  osOwner?: string;
  osNamePattern?: string;
  subnetId?: string;
  securityGroupIds?: string[];
  keyName?: string;
}

interface KeyPairInfo {
  name: string;
  fingerprint: string;
  keyType?: string;
}

// OS to SSH user mapping for the Connect feature
const OS_SSH_USERS: Record<string, string> = {
  'amazon-linux-2023': 'ec2-user',
  'amazon-linux-2': 'ec2-user',
  'ubuntu-22': 'ubuntu',
  'ubuntu-24': 'ubuntu',
  'debian-12': 'admin',
  'rhel-9': 'ec2-user',
  'centos-stream-9': 'centos',
  'rocky-linux-9': 'rocky',
  'alma-linux-9': 'almalinux',
  'kali-linux': 'kali',
  'suse-15': 'ec2-user',
  'windows-2022': 'Administrator',
  'windows-2019': 'Administrator',
};

// Human-readable platform names
const OS_PLATFORM_NAMES: Record<string, string> = {
  'amazon-linux-2023': 'Amazon Linux 2023',
  'amazon-linux-2': 'Amazon Linux 2',
  'ubuntu-22': 'Ubuntu 22.04',
  'ubuntu-24': 'Ubuntu 24.04',
  'debian-12': 'Debian 12',
  'rhel-9': 'RHEL 9',
  'centos-stream-9': 'CentOS Stream 9',
  'rocky-linux-9': 'Rocky Linux 9',
  'alma-linux-9': 'AlmaLinux 9',
  'kali-linux': 'Kali Linux',
  'suse-15': 'SUSE Linux 15',
  'windows-2022': 'Windows Server 2022',
  'windows-2019': 'Windows Server 2019',
};

interface SearchAMIsParams {
  searchTerm: string;
}

// OS configurations for different operating systems
const OS_CONFIGS: Record<string, { owner: string; namePattern: string; architecture: string }> = {
  'amazon-linux-2023': {
    owner: 'amazon',
    namePattern: 'al2023-ami-2023*-x86_64',
    architecture: 'x86_64',
  },
  'amazon-linux-2': {
    owner: 'amazon',
    namePattern: 'amzn2-ami-hvm-*-x86_64-gp2',
    architecture: 'x86_64',
  },
  'ubuntu-22': {
    owner: '099720109477',
    namePattern: 'ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*',
    architecture: 'x86_64',
  },
  'ubuntu-24': {
    owner: '099720109477',
    namePattern: 'ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*',
    architecture: 'x86_64',
  },
  'debian-12': {
    owner: '136693071363',
    namePattern: 'debian-12-amd64-*',
    architecture: 'x86_64',
  },
  'rhel-9': {
    owner: '309956199498',
    namePattern: 'RHEL-9*_HVM-*-x86_64-*',
    architecture: 'x86_64',
  },
  'windows-2022': {
    owner: 'amazon',
    namePattern: 'Windows_Server-2022-English-Full-Base-*',
    architecture: 'x86_64',
  },
  'windows-2019': {
    owner: 'amazon',
    namePattern: 'Windows_Server-2019-English-Full-Base-*',
    architecture: 'x86_64',
  },
  'kali-linux': {
    owner: '679593333241',
    namePattern: 'kali-linux-*',
    architecture: 'x86_64',
  },
  'centos-stream-9': {
    owner: '125523088429',
    namePattern: 'CentOS Stream 9*',
    architecture: 'x86_64',
  },
  'rocky-linux-9': {
    owner: '792107900819',
    namePattern: 'Rocky-9-EC2-Base-*',
    architecture: 'x86_64',
  },
  'alma-linux-9': {
    owner: '764336703387',
    namePattern: 'AlmaLinux OS 9*',
    architecture: 'x86_64',
  },
  'suse-15': {
    owner: '013907871322',
    namePattern: 'suse-sles-15-sp5-*',
    architecture: 'x86_64',
  },
};

async function getAWSCredentials(supabase: any, userId: string): Promise<AWSConfig | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_user_aws_credentials', { user_id_param: userId });

    if (error || !data || data.length === 0) {
      console.error('Error fetching AWS credentials:', error);
      return null;
    }

    return {
      access_key_id: data[0].access_key_id,
      secret_access_key: data[0].secret_access_key,
      aws_region: data[0].region || 'us-east-1',
    };
  } catch (error) {
    console.error('Error in getAWSCredentials:', error);
    return null;
  }
}

async function listKeyPairs(config: AWSConfig): Promise<KeyPairInfo[]> {
  console.log(`Fetching key pairs for region: ${config.aws_region}`);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  const command = new DescribeKeyPairsCommand({});
  const response = await ec2Client.send(command);
  
  const keyPairs: KeyPairInfo[] = [];
  
  if (response.KeyPairs) {
    for (const keyPair of response.KeyPairs) {
      keyPairs.push({
        name: keyPair.KeyName || '',
        fingerprint: keyPair.KeyFingerprint || '',
        keyType: keyPair.KeyType || 'rsa',
      });
    }
  }
  
  console.log(`Found ${keyPairs.length} key pairs`);
  return keyPairs;
}

async function getLatestAMI(ec2Client: EC2Client, osType: string, customOwner?: string, customPattern?: string): Promise<string> {
  try {
    // Use custom or predefined OS config
    const osConfig = OS_CONFIGS[osType] || {
      owner: customOwner || 'amazon',
      namePattern: customPattern || 'al2023-ami-2023*-x86_64',
      architecture: 'x86_64',
    };

    console.log(`Searching for AMI: osType=${osType}, owner=${osConfig.owner}, pattern=${osConfig.namePattern}`);

    const command = new DescribeImagesCommand({
      Owners: [osConfig.owner],
      Filters: [
        { Name: 'name', Values: [osConfig.namePattern] },
        { Name: 'state', Values: ['available'] },
        { Name: 'architecture', Values: [osConfig.architecture] },
        { Name: 'virtualization-type', Values: ['hvm'] },
      ],
    });
    
    const response = await ec2Client.send(command);
    
    if (response.Images && response.Images.length > 0) {
      // Sort by creation date to get the latest
      const sortedImages = response.Images.sort((a, b) => {
        return new Date(b.CreationDate || 0).getTime() - new Date(a.CreationDate || 0).getTime();
      });
      
      const selectedAMI = sortedImages[0];
      console.log(`Found AMI: ${selectedAMI.ImageId} - ${selectedAMI.Name}`);
      
      return selectedAMI.ImageId || 'ami-0c02fb55956c7d316';
    }
    
    console.log(`No AMI found for ${osType}, falling back to Amazon Linux 2`);
    return 'ami-0c02fb55956c7d316'; // Fallback to Amazon Linux 2
  } catch (error) {
    console.error('Error fetching AMI:', error);
    return 'ami-0c02fb55956c7d316';
  }
}

async function searchMarketplaceAMIs(ec2Client: EC2Client, searchTerm: string): Promise<any[]> {
  try {
    console.log(`Searching marketplace AMIs for: ${searchTerm}`);
    
    // Search across multiple sources
    const command = new DescribeImagesCommand({
      Filters: [
        { Name: 'name', Values: [`*${searchTerm}*`] },
        { Name: 'state', Values: ['available'] },
        { Name: 'is-public', Values: ['true'] },
        { Name: 'architecture', Values: ['x86_64'] },
      ],
      MaxResults: 20,
    });
    
    const response = await ec2Client.send(command);
    
    if (!response.Images || response.Images.length === 0) {
      return [];
    }

    // Map and sort by creation date
    const amis = response.Images
      .sort((a, b) => new Date(b.CreationDate || 0).getTime() - new Date(a.CreationDate || 0).getTime())
      .slice(0, 10)
      .map(image => ({
        amiId: image.ImageId,
        name: image.Name || 'Unknown',
        description: image.Description || '',
        hourlyPrice: image.ProductCodes?.length ? 'Marketplace pricing applies' : undefined,
        hasProductCode: (image.ProductCodes?.length || 0) > 0,
        owner: image.OwnerId,
        creationDate: image.CreationDate,
      }));

    console.log(`Found ${amis.length} AMIs matching "${searchTerm}"`);
    return amis;
  } catch (error) {
    console.error('Error searching marketplace AMIs:', error);
    return [];
  }
}

async function launchInstance(config: AWSConfig, params: LaunchInstanceParams): Promise<any> {
  console.log('Launching EC2 instance with params:', params);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  // Determine AMI ID
  let amiId: string;
  
  if (params.customAmiId) {
    // Use custom AMI ID directly
    amiId = params.customAmiId;
    console.log('Using custom AMI:', amiId);
  } else if (params.osType) {
    // Find latest AMI for the selected OS
    amiId = await getLatestAMI(ec2Client, params.osType, params.osOwner, params.osNamePattern);
  } else {
    // Default to Amazon Linux 2023
    amiId = await getLatestAMI(ec2Client, 'amazon-linux-2023');
  }
  
  console.log('Final AMI ID:', amiId);

  // Determine OS-specific tags for Connect feature
  const osType = params.osType || 'amazon-linux-2023';
  const platformName = OS_PLATFORM_NAMES[osType] || 'Custom';
  const sshUser = OS_SSH_USERS[osType] || 'ec2-user';

  const command = new RunInstancesCommand({
    ImageId: amiId,
    InstanceType: params.instanceType || 't2.micro',
    MinCount: 1,
    MaxCount: 1,
    TagSpecifications: [
      {
        ResourceType: 'instance',
        Tags: [
          { Key: 'Name', Value: params.name || 'CloudHub-Instance' },
          { Key: 'CreatedBy', Value: 'CloudHub' },
          { Key: 'OS', Value: osType },
          { Key: 'Platform', Value: platformName },
          { Key: 'PlatformId', Value: osType },
          { Key: 'SSHUser', Value: sshUser },
        ],
      },
    ],
    ...(params.subnetId && { SubnetId: params.subnetId }),
    ...(params.securityGroupIds && { SecurityGroupIds: params.securityGroupIds }),
    ...(params.keyName && { KeyName: params.keyName }),
  });

  const response = await ec2Client.send(command);
  console.log('Instance launched:', response.Instances?.[0]?.InstanceId);
  
  return {
    instanceId: response.Instances?.[0]?.InstanceId,
    state: response.Instances?.[0]?.State?.Name,
    region: config.aws_region,
    amiId: amiId,
  };
}

async function startInstance(config: AWSConfig, instanceId: string): Promise<any> {
  console.log('Starting EC2 instance:', instanceId);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  const command = new StartInstancesCommand({
    InstanceIds: [instanceId],
  });

  const response = await ec2Client.send(command);
  console.log('Instance start initiated:', response.StartingInstances?.[0]?.CurrentState?.Name);
  
  return {
    instanceId,
    previousState: response.StartingInstances?.[0]?.PreviousState?.Name,
    currentState: response.StartingInstances?.[0]?.CurrentState?.Name,
  };
}

async function stopInstance(config: AWSConfig, instanceId: string): Promise<any> {
  console.log('Stopping EC2 instance:', instanceId);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  const command = new StopInstancesCommand({
    InstanceIds: [instanceId],
  });

  const response = await ec2Client.send(command);
  console.log('Instance stop initiated:', response.StoppingInstances?.[0]?.CurrentState?.Name);
  
  return {
    instanceId,
    previousState: response.StoppingInstances?.[0]?.PreviousState?.Name,
    currentState: response.StoppingInstances?.[0]?.CurrentState?.Name,
  };
}

async function rebootInstance(config: AWSConfig, instanceId: string): Promise<any> {
  console.log('Rebooting EC2 instance:', instanceId);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  const command = new RebootInstancesCommand({
    InstanceIds: [instanceId],
  });

  await ec2Client.send(command);
  console.log('Instance reboot initiated');
  
  return { instanceId, message: 'Reboot initiated' };
}

async function terminateInstance(config: AWSConfig, instanceId: string): Promise<any> {
  console.log('Terminating EC2 instance:', instanceId);
  
  const ec2Client = new EC2Client({
    region: config.aws_region,
    credentials: {
      accessKeyId: config.access_key_id,
      secretAccessKey: config.secret_access_key,
    },
  });

  const command = new TerminateInstancesCommand({
    InstanceIds: [instanceId],
  });

  const response = await ec2Client.send(command);
  console.log('Instance termination initiated:', response.TerminatingInstances?.[0]?.CurrentState?.Name);
  
  return {
    instanceId,
    previousState: response.TerminatingInstances?.[0]?.PreviousState?.Name,
    currentState: response.TerminatingInstances?.[0]?.CurrentState?.Name,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const awsConfig = await getAWSCredentials(supabaseClient, user.id);
    
    if (!awsConfig) {
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, instanceId, params } = body;

    console.log(`Processing EC2 action: ${action} for user: ${user.id}`);

    let result;

    switch (action) {
      case 'launch':
        if (!params) {
          return new Response(
            JSON.stringify({ error: 'Launch parameters required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await launchInstance(awsConfig, params);
        break;

      case 'searchAMIs':
        if (!params?.searchTerm) {
          return new Response(
            JSON.stringify({ error: 'Search term required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const searchEc2Client = new EC2Client({
          region: awsConfig.aws_region,
          credentials: {
            accessKeyId: awsConfig.access_key_id,
            secretAccessKey: awsConfig.secret_access_key,
          },
        });
        const amis = await searchMarketplaceAMIs(searchEc2Client, params.searchTerm);
        result = { amis };
        break;

      case 'listKeyPairs':
        const keyPairs = await listKeyPairs(awsConfig);
        result = { keyPairs };
        break;

      case 'start':
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'Instance ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await startInstance(awsConfig, instanceId);
        break;

      case 'stop':
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'Instance ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await stopInstance(awsConfig, instanceId);
        break;

      case 'reboot':
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'Instance ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await rebootInstance(awsConfig, instanceId);
        break;

      case 'terminate':
        if (!instanceId) {
          return new Response(
            JSON.stringify({ error: 'Instance ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await terminateInstance(awsConfig, instanceId);
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Valid actions: launch, searchAMIs, listKeyPairs, start, stop, reboot, terminate' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in manage-ec2-instances:', error);
    
    let errorMessage = 'Failed to perform EC2 action';
    
    if (error.message?.includes('UnauthorizedOperation') || error.message?.includes('AccessDenied')) {
      errorMessage = 'Your AWS credentials lack the necessary EC2 permissions. Please ensure your IAM user has EC2 write permissions.';
    } else if (error.message?.includes('InvalidParameterValue')) {
      errorMessage = `Invalid parameter: ${error.message}`;
    } else if (error.message?.includes('InvalidAMIID')) {
      errorMessage = 'The specified AMI ID is invalid or not available in your region.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
