import { useMemo } from 'react';
import { useAWSData } from './useAWSData';

export interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  source: 'alarm' | 'cost' | 'security' | 'compliance';
  resourceId?: string;
}

export const useNotifications = () => {
  const { data: awsData } = useAWSData();

  const notifications = useMemo<Notification[]>(() => {
    if (!awsData) return [];

    const notifs: Notification[] = [];

    // CloudWatch Alarms
    awsData.alarms
      .filter(alarm => alarm.state === 'ALARM')
      .forEach(alarm => {
        notifs.push({
          id: `alarm-${alarm.id}`,
          type: alarm.severity === 'critical' ? 'critical' : 'warning',
          title: alarm.name,
          message: alarm.description || `${alarm.metric} threshold exceeded`,
          timestamp: new Date(alarm.timestamp).toLocaleString(),
          read: false,
          source: 'alarm',
          resourceId: alarm.resourceId,
        });
      });

    // Cost Anomalies
    awsData.costData.anomalies.forEach(anomaly => {
      notifs.push({
        id: `cost-${anomaly.id}`,
        type: anomaly.type === 'critical' ? 'critical' : anomaly.type === 'warning' ? 'warning' : 'info',
        title: 'Cost Anomaly Detected',
        message: anomaly.message,
        timestamp: new Date().toLocaleString(),
        read: false,
        source: 'cost',
      });
    });

    // Compliance Checks
    awsData.complianceChecks
      .filter(check => check.status === 'NON_COMPLIANT')
      .forEach(check => {
        notifs.push({
          id: `compliance-${check.id}`,
          type: 'warning',
          title: 'Compliance Issue',
          message: check.description,
          timestamp: new Date().toLocaleString(),
          read: false,
          source: 'compliance',
          resourceId: check.resourceId,
        });
      });

    // Security Issues (IAM users without MFA)
    awsData.iamUsers
      .filter(user => !user.mfaEnabled)
      .forEach(user => {
        notifs.push({
          id: `security-${user.userId}`,
          type: 'warning',
          title: 'Security Alert',
          message: `IAM user ${user.userName} does not have MFA enabled`,
          timestamp: new Date().toLocaleString(),
          read: false,
          source: 'security',
          resourceId: user.userName,
        });
      });

    // Sort by severity and timestamp
    return notifs.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.type] - severityOrder[b.type];
    });
  }, [awsData]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => n.type === 'critical' && !n.read).length;

  return {
    notifications,
    unreadCount,
    criticalCount,
  };
};
