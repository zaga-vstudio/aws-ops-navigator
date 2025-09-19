import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Plus, Server, Database, Globe, Shield, HardDrive } from "lucide-react";

interface LaunchResourceDropdownProps {
  children: React.ReactNode;
}

export function LaunchResourceDropdown({ children }: LaunchResourceDropdownProps) {
  const handleLaunchResource = (resourceType: string) => {
    // This would typically open a modal or redirect to a form
    console.log(`Launching ${resourceType}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Launch AWS Resource</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleLaunchResource("ec2")}>
          <Server className="mr-2 h-4 w-4" />
          <span>EC2 Instance</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLaunchResource("rds")}>
          <Database className="mr-2 h-4 w-4" />
          <span>RDS Database</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLaunchResource("s3")}>
          <HardDrive className="mr-2 h-4 w-4" />
          <span>S3 Bucket</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLaunchResource("vpc")}>
          <Globe className="mr-2 h-4 w-4" />
          <span>VPC Network</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleLaunchResource("security-group")}>
          <Shield className="mr-2 h-4 w-4" />
          <span>Security Group</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}