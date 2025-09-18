import { useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
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
  Activity,
  Globe,
  ChevronRight,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    badge: null,
  },
  {
    title: "EC2 Instances",
    icon: Server,
    href: "/ec2",
    badge: "3",
  },
  {
    title: "RDS Databases",
    icon: Database,
    href: "/rds",
    badge: "1",
  },
  {
    title: "VPC Networks",
    icon: Network,
    href: "/vpc",
    badge: "2",
  },
  {
    title: "Security",
    icon: Shield,
    href: "/security",
    badge: "!",
  },
  {
    title: "Cost Management",
    icon: DollarSign,
    href: "/costs",
    badge: null,
  },
  {
    title: "Monitoring",
    icon: BarChart3,
    href: "/monitoring",
    badge: null,
  },
  {
    title: "Alerts",
    icon: Bell,
    href: "/alerts",
    badge: "2",
  },
  {
    title: "Activity Log",
    icon: Activity,
    href: "/logs",
    badge: null,
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    badge: null,
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const collapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Sidebar className={cn("border-r border-border/50", collapsed ? "w-14" : "w-64")} collapsible="icon">
      <SidebarContent className="bg-card">
        <SidebarGroup>
          <SidebarGroupLabel className={cn("px-3 py-2", collapsed && "sr-only")}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                          isActive
                            ? "bg-primary/10 text-primary border-primary/20"
                            : "hover:bg-accent/50 text-foreground"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.title}</span>
                          {item.badge && (
                            <Badge 
                              variant={item.badge === "!" ? "destructive" : "secondary"}
                              className="h-5 px-2 text-xs"
                            >
                              {item.badge}
                            </Badge>
                          )}
                          {isActive(item.href) && (
                            <ChevronRight className="h-4 w-4 text-primary" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AWS Region Box */}
        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary-glow/10 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-medium text-primary">
                  AWS Region
                </h4>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {awsRegion} (N. Virginia)
              </p>
              <Button size="sm" variant="outline" className="w-full text-xs">
                Change Region
              </Button>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-3 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )}

        {/* Collapsed state region indicator */}
        {collapsed && (
          <div className="mt-auto p-2">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary-glow/10 border border-primary/20 p-2">
              <Globe className="h-4 w-4 text-primary mx-auto" />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-2 p-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}