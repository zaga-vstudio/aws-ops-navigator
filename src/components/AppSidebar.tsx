import { useState } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useAWSData } from "@/hooks/useAWSData";
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
import { RegionSelector } from "./RegionSelector";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    notificationSource: null,
  },
  {
    title: "EC2 Instances",
    icon: Server,
    href: "/ec2",
    notificationSource: null,
  },
  {
    title: "RDS Databases",
    icon: Database,
    href: "/rds",
    notificationSource: null,
  },
  {
    title: "VPC Networks",
    icon: Network,
    href: "/vpc",
    notificationSource: null,
  },
  {
    title: "Security",
    icon: Shield,
    href: "/security",
    notificationSource: 'security' as const,
  },
  {
    title: "Cost Management",
    icon: DollarSign,
    href: "/costs",
    notificationSource: 'cost' as const,
  },
  {
    title: "Monitoring",
    icon: BarChart3,
    href: "/monitoring",
    notificationSource: null,
  },
  {
    title: "Alerts",
    icon: Bell,
    href: "/alerts",
    notificationSource: 'alarm' as const,
  },
  {
    title: "Activity Log",
    icon: Activity,
    href: "/logs",
    notificationSource: null,
  },
  {
    title: "Settings",
    icon: Settings,
    href: "/settings",
    notificationSource: null,
  }
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { data: awsData } = useAWSData();
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  
  const currentPath = location.pathname;
  const isActive = (path: string) => currentPath === path;
  const collapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRegionChange = (newRegion: string) => {
    setAwsRegion(newRegion);
    toast({
      title: "Region Changed",
      description: `AWS region updated to ${newRegion}`,
    });
  };

  const getRegionName = (code: string) => {
    const regionMap: Record<string, string> = {
      "us-east-1": "N. Virginia",
      "us-east-2": "Ohio",
      "us-west-1": "N. California",
      "us-west-2": "Oregon",
      "eu-west-1": "Ireland",
      "eu-central-1": "Frankfurt",
      "ap-southeast-1": "Singapore",
      "ap-northeast-1": "Tokyo",
    };
    return regionMap[code] || code;
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
                          {item.notificationSource && (
                            <NotificationBadge 
                              source={item.notificationSource}
                              className="h-5 px-2 text-xs"
                            />
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
                {awsRegion} ({getRegionName(awsRegion)})
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full text-xs"
                onClick={() => setRegionDialogOpen(true)}
              >
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
            <Button
              variant="ghost"
              size="sm"
              className="w-full p-2"
              onClick={() => setRegionDialogOpen(true)}
            >
              <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary-glow/10 border border-primary/20 p-2">
                <Globe className="h-4 w-4 text-primary mx-auto" />
              </div>
            </Button>
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
      
      <RegionSelector
        currentRegion={awsRegion}
        onRegionChange={handleRegionChange}
        open={regionDialogOpen}
        onOpenChange={setRegionDialogOpen}
      />
    </Sidebar>
  );
}