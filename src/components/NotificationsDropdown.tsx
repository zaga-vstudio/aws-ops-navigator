import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, AlertCircle, DollarSign, Shield, X } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

interface NotificationsDropdownProps {
  children: React.ReactNode;
}

export function NotificationsDropdown({ children }: NotificationsDropdownProps) {
  const { notifications: realNotifications, unreadCount } = useNotifications();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const notifications = realNotifications.filter(n => !dismissedIds.includes(n.id));

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => [...prev, id]);
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    switch (notification.source) {
      case 'alarm':
        navigate('/alerts');
        break;
      case 'cost':
        navigate('/cost-management');
        break;
      case 'security':
      case 'compliance':
        navigate('/security');
        break;
    }
  };

  const getIcon = (notification: typeof notifications[0]) => {
    switch (notification.type) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "info": 
        if (notification.source === 'cost') return <DollarSign className="h-4 w-4 text-primary" />;
        if (notification.source === 'security') return <Shield className="h-4 w-4 text-primary" />;
        return <Bell className="h-4 w-4 text-primary" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          {children}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs"></span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No notifications
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <div 
                key={notification.id} 
                className="p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getIcon(notification)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h4 className="text-sm font-medium text-foreground">
                          {notification.title}
                        </h4>
                        <Badge variant="outline" className="text-xs mt-1">
                          {notification.source}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-4 w-4 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDismiss(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {notification.timestamp}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="w-full justify-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full"
                onClick={() => navigate('/alerts')}
              >
                View All Alerts
              </Button>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}