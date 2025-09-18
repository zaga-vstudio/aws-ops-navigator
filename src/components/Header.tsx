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

export const Header = () => {
  return (
    <div className="flex-1 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
          Production
        </Badge>
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
        <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 hidden sm:flex">
          <Plus className="h-4 w-4 mr-2" />
          <span className="hidden lg:inline">Launch Resource</span>
          <span className="lg:hidden">Launch</span>
        </Button>
        
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs"></span>
        </Button>
        
        <Button variant="ghost" size="sm" className="hidden sm:flex">
          <Settings className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="sm">
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};