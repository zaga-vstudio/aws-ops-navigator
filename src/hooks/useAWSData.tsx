import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  metrics: AWSMetrics;
}

export const useAWSData = () => {
  const [data, setData] = useState<AWSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAWSData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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
        throw functionError;
      }

      if (response.error) {
        throw new Error(response.error);
      }

      setData(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch AWS data';
      setError(errorMessage);
      
      if (errorMessage === 'AWS credentials not configured') {
        toast({
          title: "AWS Configuration Required",
          description: "Please configure your AWS credentials in Settings to view real data.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error fetching AWS data",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

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