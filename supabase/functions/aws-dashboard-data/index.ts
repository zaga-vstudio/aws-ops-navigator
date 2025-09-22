import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AWSConfig {
  access_key_id: string;
  secret_access_key: string;
  aws_region: string;
  session_token?: string;
}

interface EC2Instance {
  id: string;
  name: string;
  type: string;
  state: string;
  region: string;
  availabilityZone: string;
  launchTime: string;
  publicIp?: string;
  privateIp?: string;
}

interface RDSDatabase {
  id: string;
  name: string;
  engine: string;
  engineVersion: string;
  state: string;
  region: string;
  instanceClass: string;
  allocatedStorage: number;
  endpoint?: string;
}

interface S3Bucket {
  name: string;
  region: string;
  creationDate: string;
}

interface DashboardData {
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  s3Buckets: S3Bucket[];
  metrics: {
    totalInstances: number;
    runningInstances: number;
    stoppedInstances: number;
    totalDatabases: number;
    totalBuckets: number;
    estimatedCost: number;
  };
}

async function getAWSCredentials(supabase: any, userId: string): Promise<AWSConfig | null> {
  try {
    const { data, error } = await supabase
      .from('aws_configurations')
      .select('access_key_id, secret_access_key, aws_region, session_token')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Error fetching AWS credentials:', error);
      return null;
    }

    return {
      access_key_id: data.access_key_id,
      secret_access_key: data.secret_access_key,
      aws_region: data.aws_region,
      session_token: data.session_token
    };
  } catch (error) {
    console.error('Error in getAWSCredentials:', error);
    return null;
  }
}

async function makeAWSRequest(config: AWSConfig, service: string, action: string, params: any = {}) {
  const { AWS4 } = await import("https://deno.land/x/aws_sign_v4@1.0.2/mod.ts");

  const request = new AWS4({
    accessKeyId: config.access_key_id,
    secretAccessKey: config.secret_access_key,
    sessionToken: config.session_token,
    region: config.aws_region,
    service: service,
  });

  const url = `https://${service}.${config.aws_region}.amazonaws.com/`;
  
  const body = new URLSearchParams();
  body.append('Action', action);
  body.append('Version', service === 'ec2' ? '2016-11-15' : '2014-10-31');
  
  Object.entries(params).forEach(([key, value]) => {
    body.append(key, String(value));
  });

  const signedRequest = request.sign({
    method: 'POST',
    url: url,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    },
    body: body.toString(),
  });

  const response = await fetch(signedRequest.url, {
    method: 'POST',
    headers: signedRequest.headers,
    body: signedRequest.body,
  });

  if (!response.ok) {
    throw new Error(`AWS API Error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return text;
}

async function getEC2Instances(config: AWSConfig): Promise<EC2Instance[]> {
  try {
    const response = await makeAWSRequest(config, 'ec2', 'DescribeInstances');
    
    // Parse XML response (simplified)
    const instances: EC2Instance[] = [];
    
    // For demo purposes, return mock data with proper structure
    // In production, you would parse the XML response
    return [
      {
        id: 'i-1234567890abcdef0',
        name: 'web-server-01',
        type: 't3.medium',
        state: 'running',
        region: config.aws_region,
        availabilityZone: `${config.aws_region}a`,
        launchTime: new Date().toISOString(),
        publicIp: '54.123.456.789',
        privateIp: '10.0.1.123'
      },
      {
        id: 'i-0987654321fedcba0',
        name: 'api-server-01',
        type: 't3.large',
        state: 'running',
        region: config.aws_region,
        availabilityZone: `${config.aws_region}b`,
        launchTime: new Date().toISOString(),
        publicIp: '54.987.654.321',
        privateIp: '10.0.2.456'
      }
    ];
  } catch (error) {
    console.error('Error fetching EC2 instances:', error);
    return [];
  }
}

async function getRDSDatabases(config: AWSConfig): Promise<RDSDatabase[]> {
  try {
    // For demo purposes, return mock data
    return [
      {
        id: 'db-instance-1',
        name: 'production-db',
        engine: 'postgres',
        engineVersion: '14.9',
        state: 'available',
        region: config.aws_region,
        instanceClass: 'db.t3.micro',
        allocatedStorage: 20,
        endpoint: 'production-db.123456789012.us-east-1.rds.amazonaws.com'
      }
    ];
  } catch (error) {
    console.error('Error fetching RDS databases:', error);
    return [];
  }
}

async function getS3Buckets(config: AWSConfig): Promise<S3Bucket[]> {
  try {
    // For demo purposes, return mock data
    return [
      {
        name: 'my-app-assets',
        region: config.aws_region,
        creationDate: new Date().toISOString()
      },
      {
        name: 'my-app-backups',
        region: config.aws_region,
        creationDate: new Date().toISOString()
      }
    ];
  } catch (error) {
    console.error('Error fetching S3 buckets:', error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Get user from JWT token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get AWS credentials for the user
    const awsConfig = await getAWSCredentials(supabaseClient, user.id);
    
    if (!awsConfig) {
      return new Response(
        JSON.stringify({ error: 'AWS credentials not configured' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch data from AWS
    const [ec2Instances, rdsDatabases, s3Buckets] = await Promise.all([
      getEC2Instances(awsConfig),
      getRDSDatabases(awsConfig),
      getS3Buckets(awsConfig)
    ]);

    // Calculate metrics
    const metrics = {
      totalInstances: ec2Instances.length,
      runningInstances: ec2Instances.filter(i => i.state === 'running').length,
      stoppedInstances: ec2Instances.filter(i => i.state === 'stopped').length,
      totalDatabases: rdsDatabases.length,
      totalBuckets: s3Buckets.length,
      estimatedCost: 150.75 // This would be calculated from actual usage
    };

    const dashboardData: DashboardData = {
      ec2Instances,
      rdsDatabases,
      s3Buckets,
      metrics
    };

    return new Response(
      JSON.stringify(dashboardData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in aws-dashboard-data function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});