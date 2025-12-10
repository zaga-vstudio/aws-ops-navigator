import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { 
  EC2Client, 
  RunInstancesCommand, 
  StartInstancesCommand, 
  StopInstancesCommand, 
  RebootInstancesCommand,
  TerminateInstancesCommand,
  DescribeImagesCommand
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
  subnetId?: string;
  securityGroupIds?: string[];
  keyName?: string;
}

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

async function getLatestAmazonLinuxAMI(ec2Client: EC2Client): Promise<string> {
  try {
    const command = new DescribeImagesCommand({
      Owners: ['amazon'],
      Filters: [
        { Name: 'name', Values: ['al2023-ami-2023*-x86_64'] },
        { Name: 'state', Values: ['available'] },
        { Name: 'architecture', Values: ['x86_64'] },
      ],
    });
    
    const response = await ec2Client.send(command);
    
    if (response.Images && response.Images.length > 0) {
      // Sort by creation date to get the latest
      const sortedImages = response.Images.sort((a, b) => {
        return new Date(b.CreationDate || 0).getTime() - new Date(a.CreationDate || 0).getTime();
      });
      return sortedImages[0].ImageId || 'ami-0c02fb55956c7d316';
    }
    
    return 'ami-0c02fb55956c7d316'; // Fallback to a known Amazon Linux 2 AMI
  } catch (error) {
    console.error('Error fetching AMI:', error);
    return 'ami-0c02fb55956c7d316';
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

  // Get AMI ID if not provided
  const amiId = params.amiId || await getLatestAmazonLinuxAMI(ec2Client);
  console.log('Using AMI:', amiId);

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
          JSON.stringify({ error: 'Invalid action. Valid actions: launch, start, stop, reboot, terminate' }),
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
    } else if (error.message) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
