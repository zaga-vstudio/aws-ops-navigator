import { createContext, useContext, ReactNode } from 'react';
import { useAWSData, AWSData, CostExplorerState } from '@/hooks/useAWSData';

interface AWSError {
  code?: string;
  message: string;
  type: 'auth' | 'network' | 'aws' | 'unknown';
}

interface AWSDataContextType {
  data: AWSData | null;
  loading: boolean;
  error: AWSError | null;
  refetch: () => void;
  refetchWithForceRefreshCost: () => void;
  lastUpdated: Date | null;
  costExplorerState: CostExplorerState;
  enableCostExplorer: () => Promise<boolean>;
  disableCostExplorer: () => Promise<boolean>;
}

const AWSDataContext = createContext<AWSDataContextType | null>(null);

export function AWSDataProvider({ children }: { children: ReactNode }) {
  const awsData = useAWSData();

  return (
    <AWSDataContext.Provider value={awsData}>
      {children}
    </AWSDataContext.Provider>
  );
}

export function useAWSDataContext() {
  const context = useContext(AWSDataContext);
  if (!context) {
    throw new Error('useAWSDataContext must be used within an AWSDataProvider');
  }
  return context;
}
