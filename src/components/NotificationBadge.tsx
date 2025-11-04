import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";

interface NotificationBadgeProps {
  source?: 'alarm' | 'cost' | 'security' | 'compliance';
  className?: string;
}

export function NotificationBadge({ source, className }: NotificationBadgeProps) {
  const { notifications } = useNotifications();

  const filteredNotifications = source 
    ? notifications.filter(n => n.source === source && !n.read)
    : notifications.filter(n => !n.read);

  const count = filteredNotifications.length;

  if (count === 0) return null;

  return (
    <Badge 
      variant="destructive" 
      className={`ml-2 ${className}`}
    >
      {count}
    </Badge>
  );
}
