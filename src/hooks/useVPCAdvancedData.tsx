import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RouteTableAssociation {
  id: string;
  subnetId: string | null;
  main: boolean;
}

export interface Route {
  destinationCidr: string;
  gatewayId: string | null;
  natGatewayId: string | null;
  instanceId: string | null;
  vpcPeeringConnectionId: string | null;
  state: string;
  origin: string;
}

export interface RouteTable {
  id: string;
  vpcId: string;
  name: string;
  associations: RouteTableAssociation[];
  routes: Route[];
}

export interface NACLEntry {
  ruleNumber: number;
  protocol: string;
  ruleAction: string;
  egress: boolean;
  cidrBlock: string;
  portRange: { from: number; to: number } | null;
}

export interface NACL {
  id: string;
  vpcId: string;
  isDefault: boolean;
  name: string;
  associations: { id: string; subnetId: string }[];
  entries: NACLEntry[];
}

export interface NATGateway {
  id: string;
  vpcId: string;
  subnetId: string;
  state: string;
  name: string;
}

export interface InternetGateway {
  id: string;
  attachments: { vpcId: string; state: string }[];
  name: string;
}

export interface FlowLog {
  id: string;
  resourceId: string;
  resourceType: string;
  trafficType: string;
  logStatus: string;
  logDestination: string;
  logDestinationType: string;
  creationTime: string;
}

export interface VPCQuotas {
  eipsUsed: number;
  eipsLimit: number;
  natGatewaysUsed: number;
  natGatewaysLimit: number;
}

export interface VPCAdvancedData {
  routeTables: RouteTable[];
  nacls: NACL[];
  natGateways: NATGateway[];
  internetGateways: InternetGateway[];
  flowLogs: FlowLog[];
  quotas: VPCQuotas;
}

export const useVPCAdvancedData = () => {
  const [data, setData] = useState<VPCAdvancedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { data: response, error: fnError } = await supabase.functions.invoke(
        'vpc-advanced-data',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: {},
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (response?.error) throw new Error(response.error);

      setData(response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
