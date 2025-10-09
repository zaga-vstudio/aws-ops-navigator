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
    
    // Authentication errors
    if (message.includes('No active session') || message.includes('unauthorized') || message.includes('InvalidAccessKeyId')) {
      return { message, type: 'auth', code: 'AUTH_ERROR' };
    }
    
    // AWS specific errors
    if (message.includes('AWS') || message.includes('credentials not configured')) {
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
        toastConfig.description = "Please configure your AWS credentials in Settings to view real data.";
        break;
      case 'network':
        toastConfig.title = "Network Error";
        toastConfig.description = retryCount < MAX_RETRIES 
          ? `Connection failed. Retrying... (${retryCount + 1}/${MAX_RETRIES})`
          : "Connection failed. Please check your network connection.";
        break;
      case 'aws':
        toastConfig.title = "AWS Configuration Error";
        toastConfig.description = error.message.includes('credentials not configured')
          ? "Please configure your AWS credentials in Settings to view real data."
          : error.message;
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
        // Mejorar el mensaje de error para usuarios
        const userFriendlyMessage = functionError.message?.includes('2xx status code') 
          ? 'No se pudo conectar con AWS. Por favor verifica tus credenciales en Configuración.'
          : functionError.message || 'Error al obtener datos de AWS';
        throw new Error(userFriendlyMessage);
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