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
import { Bell, AlertTriangle, AlertCircle, CheckCircle, X } from "lucide-react";

interface NotificationsDropdownProps {
  children: React.ReactNode;
}

const initialNotifications = [
  {
    id: "1",
    type: "critical",
    title: "High CPU Usage",
    message: "EC2 instance i-0123456789 CPU usage above 90%",
    timestamp: "2 minutes ago",
    read: false
  },
  {
    id: "2", 
    type: "warning",
    title: "Disk Space Low",
    message: "RDS instance disk usage above 85%",
    timestamp: "15 minutes ago",
    read: false
  },
  {
    id: "3",
    type: "info",
    title: "Backup Completed",
    message: "Daily backup for production database completed successfully",
    timestamp: "1 hour ago",
    read: true
  }
];

export function NotificationsDropdown({ children }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const handleDismiss = (id: string) => {
    setNotifications(notifications.filter(notif => notif.id !== id));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(notif => 
      notif.id === id ? { ...notif, read: true } : notif
    ));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertCircle className="h-4 w-4 text-warning" />;
      case "info": return <Bell className="h-4 w-4 text-primary" />;
      default: return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
              <div key={notification.id} className="p-3 border-b last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </h4>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-4 w-4 p-0"
                        onClick={() => handleDismiss(notification.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {notification.timestamp}
                      </span>
                      {!notification.read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs px-2"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem className="w-full justify-center">
          <Button variant="ghost" size="sm" className="w-full">
            View All Notifications
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}