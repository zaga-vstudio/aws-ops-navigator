import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { EC2Client, DescribeInstancesCommand, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeSecurityGroupsCommand } from "npm:@aws-sdk/client-ec2@3.451.0";
import { RDSClient, DescribeDBInstancesCommand } from "npm:@aws-sdk/client-rds@3.451.0";
import { S3Client, ListBucketsCommand } from "npm:@aws-sdk/client-s3@3.451.0";
import { CloudWatchClient, GetMetricStatisticsCommand, DescribeAlarmsCommand } from "npm:@aws-sdk/client-cloudwatch@3.451.0";
import { IAMClient, ListUsersCommand, GetUserCommand, ListAccessKeysCommand } from "npm:@aws-sdk/client-iam@3.451.0";
import { ConfigServiceClient, DescribeComplianceByResourceCommand, DescribeConfigRulesCommand } from "npm:@aws-sdk/client-config-service@3.451.0";
import { CostExplorerClient, GetCostAndUsageCommand, GetAnomaliesCommand } from "npm:@aws-sdk/client-cost-explorer@3.451.0";

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

interface VPC {
  id: string;
  name: string;
  cidrBlock: string;
  state: string;
  isDefault: boolean;
  region: string;
}

interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidrBlock: string;
  availabilityZone: string;
  availableIps: number;
}

interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  vpcId: string;
  inboundRules: number;
  outboundRules: number;
}

interface CloudWatchAlarm {
  id: string;
  name: string;
  description?: string;
  state: string;
  severity: string;
  metric: string;
  threshold: number;
  timestamp: string;
  resourceId?: string;
}

interface IAMUser {
  userName: string;
  userId: string;
  arn: string;
  createDate: string;
  passwordLastUsed?: string;
  mfaEnabled: boolean;
  accessKeys: number;
}

interface ComplianceCheck {
  id: string;
  name: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  description: string;
  resourceType?: string;
  resourceId?: string;
}

interface ServiceCost {
  service: string;
  amount: number;
  percentage: number;
}

interface CostAnomaly {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  amount: string;
  impactValue: number;
}

interface TopSpendingResource {
  resourceId: string;
  resourceType: string;
  cost: number;
  trend: 'up' | 'down' | 'stable';
}

interface DashboardData {
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  s3Buckets: S3Bucket[];
  vpcs: VPC[];
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  alarms: CloudWatchAlarm[];
  iamUsers: IAMUser[];
  complianceChecks: ComplianceCheck[];
  costData: {
    serviceBreakdown: ServiceCost[];
    topResources: TopSpendingResource[];
    anomalies: CostAnomaly[];
  };
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
    // Use the secure database function to get decrypted credentials
    const { data, error } = await supabase
      .rpc('get_user_aws_credentials', { user_id_param: userId });

    if (error) {
      console.error('Error fetching AWS credentials:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error('No AWS credentials found for user');
      return null;
    }

    const credentials = data[0];

    return {
      access_key_id: credentials.access_key_id,
      secret_access_key: credentials.secret_access_key,
      aws_region: credentials.region || 'us-east-1',
    };
  } catch (error) {
    console.error('Error in getAWSCredentials:', error);
    return null;
  }
}

async function getEC2Instances(config: AWSConfig): Promise<EC2Instance[]> {
  console.log(`Fetching EC2 instances for region: ${config.aws_region}`);
  
  try {
    const ec2Client = new EC2Client({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      // Force explicit credentials, disable file-based credential lookup
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeInstancesCommand({});
    const response = await ec2Client.send(command);
    
    const instances: EC2Instance[] = [];
    
    if (response.Reservations) {
      for (const reservation of response.Reservations) {
        if (reservation.Instances) {
          for (const instance of reservation.Instances) {
            const nameTag = instance.Tags?.find(tag => tag.Key === 'Name');
            instances.push({
              id: instance.InstanceId || '',
              name: nameTag?.Value || instance.InstanceId || 'Unnamed Instance',
              type: instance.InstanceType || 'unknown',
              state: instance.State?.Name || 'unknown',
              region: config.aws_region,
              availabilityZone: instance.Placement?.AvailabilityZone || '',
              launchTime: instance.LaunchTime?.toISOString() || '',
              publicIp: instance.PublicIpAddress,
              privateIp: instance.PrivateIpAddress,
            });
          }
        }
      }
    }
    
    console.log(`Found ${instances.length} EC2 instances`);
    return instances;
  } catch (error: any) {
    console.error('Error fetching EC2 instances:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.$metadata?.httpStatusCode
    });
    throw new Error(`Failed to fetch EC2 instances: ${error.message}`);
  }
}

async function getRDSDatabases(config: AWSConfig): Promise<RDSDatabase[]> {
  console.log(`Fetching RDS databases for region: ${config.aws_region}`);
  
  try {
    const rdsClient = new RDSClient({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      // Force explicit credentials, disable file-based credential lookup
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeDBInstancesCommand({});
    const response = await rdsClient.send(command);
    
    const databases: RDSDatabase[] = [];
    
    if (response.DBInstances) {
      for (const dbInstance of response.DBInstances) {
        databases.push({
          id: dbInstance.DBInstanceIdentifier || '',
          name: dbInstance.DBName || dbInstance.DBInstanceIdentifier || 'Unnamed Database',
          engine: dbInstance.Engine || 'unknown',
          engineVersion: dbInstance.EngineVersion || 'unknown',
          state: dbInstance.DBInstanceStatus || 'unknown',
          region: config.aws_region,
          instanceClass: dbInstance.DBInstanceClass || 'unknown',
          allocatedStorage: dbInstance.AllocatedStorage || 0,
          endpoint: dbInstance.Endpoint?.Address,
        });
      }
    }
    
    console.log(`Found ${databases.length} RDS databases`);
    return databases;
  } catch (error: any) {
    console.error('Error fetching RDS databases:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.$metadata?.httpStatusCode
    });
    throw new Error(`Failed to fetch RDS databases: ${error.message}`);
  }
}

async function getS3Buckets(config: AWSConfig): Promise<S3Bucket[]> {
  console.log(`Fetching S3 buckets for region: ${config.aws_region}`);
  
  try {
    const s3Client = new S3Client({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      // Force explicit credentials, disable file-based credential lookup
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    
    const buckets: S3Bucket[] = [];
    
    if (response.Buckets) {
      for (const bucket of response.Buckets) {
        buckets.push({
          name: bucket.Name || '',
          region: config.aws_region, // Note: S3 bucket region needs separate call to get exact region
          creationDate: bucket.CreationDate?.toISOString() || '',
        });
      }
    }
    
    console.log(`Found ${buckets.length} S3 buckets`);
    return buckets;
  } catch (error: any) {
    console.error('Error fetching S3 buckets:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.Code || error.$metadata?.httpStatusCode
    });
    throw new Error(`Failed to fetch S3 buckets: ${error.message}`);
  }
}

function calculateEstimatedCost(ec2Instances: EC2Instance[], rdsDatabases: RDSDatabase[], s3Buckets: S3Bucket[]): number {
  // Basic cost estimation - in a real app you'd want to call AWS Cost Explorer API
  let totalCost = 0;
  
  // EC2 cost estimation (rough hourly rates in USD per hour)
  for (const instance of ec2Instances) {
    if (instance.state === 'running') {
      const hourlyRates: { [key: string]: number } = {
        't2.nano': 0.0058,
        't2.micro': 0.0116,
        't2.small': 0.023,
        't2.medium': 0.0464,
        't3.nano': 0.0052,
        't3.micro': 0.0104,
        't3.small': 0.0208,
        't3.medium': 0.0416,
        't3.large': 0.0832,
        't3.xlarge': 0.1664,
      };
      
      const hourlyRate = hourlyRates[instance.type] || 0.05; // default rate
      totalCost += hourlyRate * 24 * 30; // monthly cost
    }
  }
  
  // RDS cost estimation
  for (const db of rdsDatabases) {
    if (db.state === 'available') {
      const hourlyRates: { [key: string]: number } = {
        'db.t3.micro': 0.017,
        'db.t3.small': 0.034,
        'db.t3.medium': 0.068,
        'db.t3.large': 0.136,
      };
      
      const hourlyRate = hourlyRates[db.instanceClass] || 0.05;
      totalCost += hourlyRate * 24 * 30; // monthly cost
      totalCost += db.allocatedStorage * 0.10; // storage cost per GB
    }
  }
  
  // S3 cost estimation (minimal for typical usage)
  totalCost += s3Buckets.length * 0.50; // roughly $0.50 per bucket per month for minimal usage
  
  return Math.round(totalCost * 100) / 100;
}

async function getVPCs(config: AWSConfig): Promise<VPC[]> {
  console.log(`Fetching VPCs for region: ${config.aws_region}`);
  
  try {
    const ec2Client = new EC2Client({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeVpcsCommand({});
    const response = await ec2Client.send(command);
    
    const vpcs: VPC[] = [];
    
    if (response.Vpcs) {
      for (const vpc of response.Vpcs) {
        const nameTag = vpc.Tags?.find(tag => tag.Key === 'Name');
        vpcs.push({
          id: vpc.VpcId || '',
          name: nameTag?.Value || vpc.VpcId || 'Unnamed VPC',
          cidrBlock: vpc.CidrBlock || '',
          state: vpc.State || 'unknown',
          isDefault: vpc.IsDefault || false,
          region: config.aws_region,
        });
      }
    }
    
    console.log(`Found ${vpcs.length} VPCs`);
    return vpcs;
  } catch (error: any) {
    console.error('Error fetching VPCs:', error);
    throw new Error(`Failed to fetch VPCs: ${error.message}`);
  }
}

async function getSubnets(config: AWSConfig): Promise<Subnet[]> {
  console.log(`Fetching Subnets for region: ${config.aws_region}`);
  
  try {
    const ec2Client = new EC2Client({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeSubnetsCommand({});
    const response = await ec2Client.send(command);
    
    const subnets: Subnet[] = [];
    
    if (response.Subnets) {
      for (const subnet of response.Subnets) {
        const nameTag = subnet.Tags?.find(tag => tag.Key === 'Name');
        subnets.push({
          id: subnet.SubnetId || '',
          name: nameTag?.Value || subnet.SubnetId || 'Unnamed Subnet',
          vpcId: subnet.VpcId || '',
          cidrBlock: subnet.CidrBlock || '',
          availabilityZone: subnet.AvailabilityZone || '',
          availableIps: subnet.AvailableIpAddressCount || 0,
        });
      }
    }
    
    console.log(`Found ${subnets.length} Subnets`);
    return subnets;
  } catch (error: any) {
    console.error('Error fetching Subnets:', error);
    throw new Error(`Failed to fetch Subnets: ${error.message}`);
  }
}

async function getSecurityGroups(config: AWSConfig): Promise<SecurityGroup[]> {
  console.log(`Fetching Security Groups for region: ${config.aws_region}`);
  
  try {
    const ec2Client = new EC2Client({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeSecurityGroupsCommand({});
    const response = await ec2Client.send(command);
    
    const securityGroups: SecurityGroup[] = [];
    
    if (response.SecurityGroups) {
      for (const sg of response.SecurityGroups) {
        securityGroups.push({
          id: sg.GroupId || '',
          name: sg.GroupName || '',
          description: sg.Description || '',
          vpcId: sg.VpcId || '',
          inboundRules: sg.IpPermissions?.length || 0,
          outboundRules: sg.IpPermissionsEgress?.length || 0,
        });
      }
    }
    
    console.log(`Found ${securityGroups.length} Security Groups`);
    return securityGroups;
  } catch (error: any) {
    console.error('Error fetching Security Groups:', error);
    throw new Error(`Failed to fetch Security Groups: ${error.message}`);
  }
}

async function getCloudWatchAlarms(config: AWSConfig): Promise<CloudWatchAlarm[]> {
  console.log(`Fetching CloudWatch Alarms for region: ${config.aws_region}`);
  
  try {
    const cloudWatchClient = new CloudWatchClient({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const command = new DescribeAlarmsCommand({});
    const response = await cloudWatchClient.send(command);
    
    const alarms: CloudWatchAlarm[] = [];
    
    if (response.MetricAlarms) {
      for (const alarm of response.MetricAlarms) {
        const severity = alarm.StateValue === 'ALARM' ? 'critical' : 
                        alarm.StateValue === 'INSUFFICIENT_DATA' ? 'warning' : 'info';
        
        alarms.push({
          id: alarm.AlarmArn || alarm.AlarmName || '',
          name: alarm.AlarmName || 'Unnamed Alarm',
          description: alarm.AlarmDescription,
          state: alarm.StateValue || 'UNKNOWN',
          severity,
          metric: alarm.MetricName || 'Unknown',
          threshold: alarm.Threshold || 0,
          timestamp: alarm.StateUpdatedTimestamp?.toISOString() || new Date().toISOString(),
          resourceId: alarm.Dimensions?.find(d => d.Name === 'InstanceId')?.Value,
        });
      }
    }
    
    console.log(`Found ${alarms.length} CloudWatch Alarms`);
    return alarms;
  } catch (error: any) {
    console.error('Error fetching CloudWatch Alarms:', error);
    throw new Error(`Failed to fetch CloudWatch Alarms: ${error.message}`);
  }
}

async function getIAMUsers(config: AWSConfig): Promise<IAMUser[]> {
  console.log('Fetching IAM Users (region-independent)');
  
  try {
    const iamClient = new IAMClient({
      region: 'us-east-1', // IAM is global, but client needs a region
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const listUsersCommand = new ListUsersCommand({});
    const response = await iamClient.send(listUsersCommand);
    
    const users: IAMUser[] = [];
    
    if (response.Users) {
      for (const user of response.Users) {
        // Get access keys count for each user
        let accessKeysCount = 0;
        try {
          const accessKeysCommand = new ListAccessKeysCommand({ UserName: user.UserName });
          const accessKeysResponse = await iamClient.send(accessKeysCommand);
          accessKeysCount = accessKeysResponse.AccessKeyMetadata?.length || 0;
        } catch (error) {
          console.log(`Could not fetch access keys for ${user.UserName}`);
        }

        users.push({
          userName: user.UserName || '',
          userId: user.UserId || '',
          arn: user.Arn || '',
          createDate: user.CreateDate?.toISOString() || '',
          passwordLastUsed: user.PasswordLastUsed?.toISOString(),
          mfaEnabled: false, // Note: Checking MFA requires additional permissions
          accessKeys: accessKeysCount,
        });
      }
    }
    
    console.log(`Found ${users.length} IAM Users`);
    return users;
  } catch (error: any) {
    console.error('Error fetching IAM Users:', error);
    // Return empty array if no IAM permissions
    if (error.message?.includes('AccessDenied') || error.message?.includes('UnauthorizedOperation')) {
      console.log('No IAM permissions, returning empty array');
      return [];
    }
    throw new Error(`Failed to fetch IAM Users: ${error.message}`);
  }
}

async function getComplianceChecks(config: AWSConfig): Promise<ComplianceCheck[]> {
  console.log(`Fetching AWS Config compliance for region: ${config.aws_region}`);
  
  try {
    const configClient = new ConfigServiceClient({
      region: config.aws_region,
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    // First get config rules
    const rulesCommand = new DescribeConfigRulesCommand({});
    const rulesResponse = await configClient.send(rulesCommand);
    
    const checks: ComplianceCheck[] = [];
    
    if (rulesResponse.ConfigRules && rulesResponse.ConfigRules.length > 0) {
      // Get compliance status for each rule
      for (const rule of rulesResponse.ConfigRules.slice(0, 10)) { // Limit to 10 rules
        try {
          const complianceCommand = new DescribeComplianceByResourceCommand({
            ResourceType: rule.Scope?.ComplianceResourceTypes?.[0] || 'AWS::EC2::Instance',
          });
          const complianceResponse = await configClient.send(complianceCommand);
          
          if (complianceResponse.ComplianceByResources) {
            for (const resource of complianceResponse.ComplianceByResources.slice(0, 5)) {
              checks.push({
                id: `${rule.ConfigRuleName}-${resource.ResourceId}`,
                name: rule.ConfigRuleName || 'Unknown Rule',
                status: (resource.Compliance?.ComplianceType as any) || 'INSUFFICIENT_DATA',
                description: rule.Description || `Compliance check for ${rule.ConfigRuleName}`,
                resourceType: resource.ResourceType,
                resourceId: resource.ResourceId,
              });
            }
          }
        } catch (err) {
          console.log(`Could not get compliance for rule ${rule.ConfigRuleName}`);
        }
      }
    }
    
    console.log(`Found ${checks.length} Compliance Checks`);
    return checks;
  } catch (error: any) {
    console.error('Error fetching Compliance Checks:', error);
    // Return empty array if AWS Config not enabled or no permissions
    if (error.message?.includes('AccessDenied') || 
        error.message?.includes('ResourceNotFound') ||
        error.message?.includes('ConfigServiceNotEnabled')) {
      console.log('AWS Config not available, returning empty array');
      return [];
    }
    throw new Error(`Failed to fetch Compliance Checks: ${error.message}`);
  }
}

async function getCostData(config: AWSConfig): Promise<{
  serviceBreakdown: ServiceCost[];
  topResources: TopSpendingResource[];
  anomalies: CostAnomaly[];
}> {
  console.log('Fetching AWS cost data from Cost Explorer');
  
  try {
    const costExplorerClient = new CostExplorerClient({
      region: 'us-east-1', // Cost Explorer only available in us-east-1
      credentials: {
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      },
      credentialDefaultProvider: () => async () => ({
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
      }),
    });

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Fetch cost and usage by service
    const costCommand = new GetCostAndUsageCommand({
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0],
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    });

    const costResponse = await costExplorerClient.send(costCommand);
    
    let serviceBreakdown: ServiceCost[] = [];
    let totalCost = 0;

    if (costResponse.ResultsByTime && costResponse.ResultsByTime[0]?.Groups) {
      const groups = costResponse.ResultsByTime[0].Groups;
      
      totalCost = groups.reduce((sum, group) => {
        const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        return sum + amount;
      }, 0);

      serviceBreakdown = groups
        .map(group => ({
          service: group.Keys?.[0] || 'Unknown',
          amount: parseFloat(group.Metrics?.UnblendedCost?.Amount || '0'),
          percentage: 0,
        }))
        .filter(s => s.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      serviceBreakdown = serviceBreakdown.map(s => ({
        ...s,
        percentage: totalCost > 0 ? (s.amount / totalCost) * 100 : 0,
      }));

      console.log(`Found ${serviceBreakdown.length} services, total: $${totalCost.toFixed(2)}`);
    }

    // Fetch cost anomalies
    let anomalies: CostAnomaly[] = [];
    
    try {
      const anomalyCommand = new GetAnomaliesCommand({
        DateInterval: {
          StartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          EndDate: now.toISOString().split('T')[0],
        },
        MaxResults: 10,
      });

      const anomalyResponse = await costExplorerClient.send(anomalyCommand);
      
      if (anomalyResponse.Anomalies) {
        anomalies = anomalyResponse.Anomalies.map((anomaly, index) => {
          const impact = parseFloat(anomaly.Impact?.TotalImpact?.toString() || '0');
          const maxImpact = parseFloat(anomaly.Impact?.MaxImpact || '0');
          
          let type: 'warning' | 'critical' | 'info' = 'info';
          if (maxImpact > 100) type = 'critical';
          else if (maxImpact > 50) type = 'warning';

          return {
            id: anomaly.AnomalyId || `anomaly-${index}`,
            type,
            message: anomaly.RootCauses?.[0]?.Service || 'Unusual spending detected',
            amount: `$${impact.toFixed(2)}`,
            impactValue: impact,
          };
        }).slice(0, 5);
      }

      console.log(`Found ${anomalies.length} cost anomalies`);
    } catch (anomalyError: any) {
      console.log('Cost anomaly detection not enabled or not available:', anomalyError.message);
    }

    const topResources: TopSpendingResource[] = serviceBreakdown.slice(0, 5).map(service => ({
      resourceId: service.service,
      resourceType: service.service,
      cost: service.amount,
      trend: 'stable' as const,
    }));

    return {
      serviceBreakdown,
      topResources,
      anomalies,
    };
  } catch (error: any) {
    console.error('Error fetching cost data:', error.message);
    // Return empty data if Cost Explorer not enabled or no permissions
    if (error.message?.includes('AccessDenied') || 
        error.message?.includes('SubscriptionRequiredException') ||
        error.message?.includes('UnauthorizedOperation')) {
      console.log('Cost Explorer not available, returning empty cost data');
    }
    return {
      serviceBreakdown: [],
      topResources: [],
      anomalies: [],
    };
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

    console.log(`Fetching AWS data for user: ${user.id}`);

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

    console.log(`Using AWS region: ${awsConfig.aws_region}`);

    // Fetch data from AWS with better error handling
    let ec2Instances: EC2Instance[] = [];
    let rdsDatabases: RDSDatabase[] = [];
    let s3Buckets: S3Bucket[] = [];
    let vpcs: VPC[] = [];
    let subnets: Subnet[] = [];
    let securityGroups: SecurityGroup[] = [];
    let alarms: CloudWatchAlarm[] = [];
    let iamUsers: IAMUser[] = [];
    let complianceChecks: ComplianceCheck[] = [];
    let costData = {
      serviceBreakdown: [] as ServiceCost[],
      topResources: [] as TopSpendingResource[],
      anomalies: [] as CostAnomaly[],
    };
    
    try {
      [ec2Instances, rdsDatabases, s3Buckets, vpcs, subnets, securityGroups, alarms, iamUsers, complianceChecks, costData] = await Promise.all([
        getEC2Instances(awsConfig),
        getRDSDatabases(awsConfig),
        getS3Buckets(awsConfig),
        getVPCs(awsConfig),
        getSubnets(awsConfig),
        getSecurityGroups(awsConfig),
        getCloudWatchAlarms(awsConfig),
        getIAMUsers(awsConfig),
        getComplianceChecks(awsConfig),
        getCostData(awsConfig)
      ]);
    } catch (awsError: any) {
      console.error('AWS API Error:', awsError);
      
      // Provide specific error messages
      let errorMessage = 'Unable to connect to AWS';
      
      if (awsError.message?.includes('InvalidAccessKeyId') || awsError.message?.includes('SignatureDoesNotMatch')) {
        errorMessage = 'Invalid AWS credentials. Please verify your Access Key ID and Secret Access Key in Settings.';
      } else if (awsError.message?.includes('UnauthorizedOperation') || awsError.message?.includes('AccessDenied')) {
        errorMessage = 'AWS credentials lack necessary permissions. Please ensure your IAM user has EC2, RDS, and S3 read permissions.';
      } else if (awsError.message?.includes('credentials')) {
        errorMessage = 'AWS credentials error. Please reconfigure your credentials in Settings.';
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: awsError.message 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate metrics with real cost calculation
    const metrics = {
      totalInstances: ec2Instances.length,
      runningInstances: ec2Instances.filter(i => i.state === 'running').length,
      stoppedInstances: ec2Instances.filter(i => i.state === 'stopped').length,
      totalDatabases: rdsDatabases.length,
      totalBuckets: s3Buckets.length,
      estimatedCost: calculateEstimatedCost(ec2Instances, rdsDatabases, s3Buckets)
    };

    const dashboardData: DashboardData = {
      ec2Instances,
      rdsDatabases,
      s3Buckets,
      vpcs,
      subnets,
      securityGroups,
      alarms,
      iamUsers,
      complianceChecks,
      costData,
      metrics
    };

    console.log(`Returning dashboard data with ${metrics.totalInstances} instances, ${metrics.totalDatabases} databases, ${metrics.totalBuckets} buckets, ${vpcs.length} VPCs, ${subnets.length} subnets, ${securityGroups.length} security groups, ${alarms.length} alarms, ${iamUsers.length} IAM users, ${complianceChecks.length} compliance checks, ${costData.serviceBreakdown.length} cost services`);

    return new Response(
      JSON.stringify(dashboardData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
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