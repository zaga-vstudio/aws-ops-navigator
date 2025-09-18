import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard,
  Server,
  Database,
  Network,
  Shield,
  DollarSign,
  BarChart3,
  Bell,
  Settings,
  ChevronRight,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
}

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    badge: null,
    active: true
  },
  {
    title: "EC2 Instances",
    icon: Server,
    href: "/ec2",
    badge: "3",
    active: false
  },
  {
    title: "RDS Databases",
    icon: Database,
    href: "/rds",
    badge: "1",
    active: false
  },
  {
    title: "VPC Networks",
    icon: Network,
    href: "/vpc",
    badge: "2",
    active: false
  },
  {
    title: "Security",
    icon: Shield,
    href: "/security",
    badge: "!",
    active: false
  },
  {
    title: "Cost Management",
    icon: DollarSign,
    href: "/costs",
    badge: null,
    active: false
  },
  {
    title: "Monitoring",
    icon: BarChart3,
    href: "/monitoring",
    badge: null,
    active: false
  },
  {
    title: "Alerts",
    icon: Bell,
    href: "/alerts",
    badge: "2",
    active: false
  },
  {
    title: "Activity Log",
    icon: Activity,
    href: "/logs",
    badge: null,
    active: false
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    badge: null,
    active: false
  }
];

export const Sidebar = ({ className }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("pb-12 border-r border-border/50 bg-card", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {menuItems.map((item) => (
              <Button
                key={item.href}
                variant={item.active ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 transition-all",
                  item.active && "bg-primary/10 text-primary border-primary/20"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.title}</span>
                {item.badge && (
                  <Badge 
                    variant={item.badge === "!" ? "destructive" : "secondary"}
                    className="h-5 px-2 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.active && (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 right-4">
        <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary-glow/10 border border-primary/20 p-4">
          <h4 className="text-sm font-medium text-primary mb-2">
            AWS Region
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            us-east-1 (N. Virginia)
          </p>
          <Button size="sm" variant="outline" className="w-full text-xs">
            Change Region
          </Button>
        </div>
      </div>
    </div>
  );
};