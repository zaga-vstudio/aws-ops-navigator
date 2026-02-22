import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Settings, 
  User, 
  Search,
  Plus,
  Cloud
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { LaunchResourceDropdown } from "@/components/LaunchResourceDropdown";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { UserDropdown } from "@/components/UserDropdown";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-between">
      <div className="flex items-center gap-3">
      </div>

      <div className="flex-1 flex items-center justify-center max-w-md mx-4 lg:mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources, logs, metrics..."
            className="pl-10 bg-muted/50 border-border/50"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RoleSwitcher />
        
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => navigate("/dashboard")}
          className="hidden md:flex"
        >
          <Cloud className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        
        <LaunchResourceDropdown>
          <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 hidden sm:flex">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden lg:inline">Launch Resource</span>
            <span className="lg:hidden">Launch</span>
          </Button>
        </LaunchResourceDropdown>
        
        <NotificationsDropdown>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
          </Button>
        </NotificationsDropdown>
        
        <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => navigate("/settings")}>
          <Settings className="h-4 w-4" />
        </Button>
        
        <UserDropdown>
          <Button variant="ghost" size="sm">
            <User className="h-4 w-4" />
          </Button>
        </UserDropdown>
      </div>
    </div>
  );
};