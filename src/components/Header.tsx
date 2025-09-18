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
    <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-glow rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">CloudHub</h1>
          </div>
          <Badge variant="outline" className="ml-2 text-xs">
            Production
          </Badge>
        </div>

        <div className="flex-1 flex items-center justify-center max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources, logs, metrics..."
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            Launch Resource
          </Button>
          
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-xs"></span>
          </Button>
          
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <User className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};