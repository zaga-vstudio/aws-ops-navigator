import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AWSError {
  code?: string;
  message: string;
  type: 'auth' | 'network' | 'aws' | 'unknown';
}

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
}

export interface RDSDatabase {
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

export interface S3Bucket {
  name: string;
  region: string;
  creationDate: string;
}

export interface VPC {
  id: string;
  name: string;
  cidrBlock: string;
  state: string;
  isDefault: boolean;
  region: string;
}

export interface Subnet {
  id: string;
  name: string;
  vpcId: string;
  cidrBlock: string;
  availabilityZone: string;
  availableIps: number;
}

export interface SecurityGroupRule {
  ipProtocol: string;
  fromPort?: number;
  toPort?: number;
  cidrIpv4?: string;
  cidrIpv6?: string;
  sourceSecurityGroupId?: string;
  prefixListId?: string;
  description?: string;
}

export interface SecurityGroup {
  id: string;
  name: string;
  description: string;
  vpcId: string;
  inboundRules: SecurityGroupRule[];
  outboundRules: SecurityGroupRule[];
}

export interface VPCPeeringConnection {
  id: string;
  status: string;
  statusMessage?: string;
  requesterVpcId: string;
  requesterCidrBlock: string;
  requesterOwnerId: string;
  accepterVpcId: string;
  accepterCidrBlock: string;
  accepterOwnerId: string;
  tags: { key: string; value: string }[];
}

export interface CloudWatchAlarm {
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

export interface IAMUser {
  userName: string;
  userId: string;
  arn: string;
  createDate: string;
  passwordLastUsed?: string;
  mfaEnabled: boolean;
  accessKeys: number;
}

export interface ComplianceCheck {
  id: string;
  name: string;
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE' | 'INSUFFICIENT_DATA';
  description: string;
  resourceType?: string;
  resourceId?: string;
}

export interface ServiceCost {
  service: string;
  amount: number;
  percentage: number;
}

export interface CostAnomaly {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  amount: string;
  impactValue: number;
}

export interface TopSpendingResource {
  resourceId: string;
  resourceType: string;
  cost: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface CloudWatchMetrics {
  cpu: MetricDataPoint[];
  networkIn: MetricDataPoint[];
  networkOut: MetricDataPoint[];
}

export interface AWSMetrics {
  totalInstances: number;
  runningInstances: number;
  stoppedInstances: number;
  totalDatabases: number;
  totalBuckets: number;
  estimatedCost: number;
}

export interface AWSData {
  ec2Instances: EC2Instance[];
  rdsDatabases: RDSDatabase[];
  s3Buckets: S3Bucket[];
  vpcs: VPC[];
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  vpcPeeringConnections: VPCPeeringConnection[];
  alarms: CloudWatchAlarm[];
  iamUsers: IAMUser[];
  complianceChecks: ComplianceCheck[];
  costData: {
    serviceBreakdown: ServiceCost[];
    topResources: TopSpendingResource[];
    anomalies: CostAnomaly[];
  };
  cloudWatchMetrics?: CloudWatchMetrics;
  metrics: AWSMetrics;
}

export const useAWSData = () => {
  const [data, setData] = useState<AWSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AWSError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  const categorizeError = (err: any): AWSError => {
    const message = err instanceof Error ? err.message : String(err);
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
      return { message, type: 'network', code: 'NETWORK_ERROR' };
    }
    
    // Authentication/Session errors
    if (message.includes('No active session') || message.includes('unauthorized')) {
      return { message: 'Session expired. Please log in again.', type: 'auth', code: 'AUTH_ERROR' };
    }
    
    // AWS credential errors
    if (message.includes('Invalid AWS credentials') || message.includes('InvalidAccessKeyId') || message.includes('SignatureDoesNotMatch')) {
      return { message: 'Invalid AWS credentials. Please verify and update your credentials in Settings.', type: 'aws', code: 'INVALID_CREDENTIALS' };
    }
    
    // AWS permission errors
    if (message.includes('lack necessary permissions') || message.includes('UnauthorizedOperation') || message.includes('AccessDenied')) {
      return { message: 'Your AWS credentials lack necessary permissions. Please check the IAM permissions guide in Settings.', type: 'aws', code: 'INSUFFICIENT_PERMISSIONS' };
    }
    
    // AWS not configured
    if (message.includes('credentials not configured')) {
      return { message: 'AWS credentials not configured. Please add your credentials in Settings to view your AWS resources.', type: 'aws', code: 'NOT_CONFIGURED' };
    }
    
    // Generic AWS errors
    if (message.includes('AWS') || message.includes('Unable to connect to AWS')) {
      return { message, type: 'aws', code: 'AWS_ERROR' };
    }
    
    // Unknown errors
    return { message, type: 'unknown', code: 'UNKNOWN_ERROR' };
  };

  const showErrorToast = (error: AWSError) => {
    const toastConfig = {
      variant: "destructive" as const,
      title: "",
      description: error.message,
    };

    switch (error.type) {
      case 'auth':
        toastConfig.title = "Authentication Error";
        toastConfig.description = error.message;
        break;
      case 'network':
        toastConfig.title = "Network Error";
        toastConfig.description = retryCount < MAX_RETRIES 
          ? `Connection failed. Retrying... (${retryCount + 1}/${MAX_RETRIES})`
          : "Connection failed. Please check your network connection.";
        break;
      case 'aws':
        toastConfig.title = error.code === 'NOT_CONFIGURED' ? "AWS Not Configured" : 
                           error.code === 'INVALID_CREDENTIALS' ? "Invalid Credentials" :
                           error.code === 'INSUFFICIENT_PERMISSIONS' ? "Insufficient Permissions" :
                           "AWS Configuration Error";
        toastConfig.description = error.message;
        break;
      default:
        toastConfig.title = "Error";
        break;
    }

    toast(toastConfig);
  };

  const fetchAWSData = useCallback(async (isRetry: boolean = false) => {
    try {
      setLoading(true);
      if (!isRetry) {
        setError(null);
        setRetryCount(0);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const { data: response, error: functionError } = await supabase.functions.invoke(
        'aws-dashboard-data',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (functionError) {
        throw new Error(functionError.message || 'Error al obtener datos de AWS');
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      setData(response);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const awsError = categorizeError(err);
      setError(awsError);
      
      // Retry logic for network errors
      if (awsError.type === 'network' && retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        showErrorToast(awsError);
        
        setTimeout(() => {
          fetchAWSData(true);
        }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      } else {
        showErrorToast(awsError);
      }
    } finally {
      setLoading(false);
    }
  }, [toast, retryCount]);

  const refetch = () => {
    fetchAWSData();
  };

  useEffect(() => {
    fetchAWSData();
  }, [fetchAWSData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};