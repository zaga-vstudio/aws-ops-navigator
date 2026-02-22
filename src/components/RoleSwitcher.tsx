import { useActiveRole } from "@/contexts/ActiveRoleContext";
import { useCloudHubRoles } from "@/hooks/useCloudHubRoles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShieldCheck, ChevronDown, Crown } from "lucide-react";

export function RoleSwitcher() {
  const { activeRole, setActiveRole } = useActiveRole();
  const { roles, loading } = useCloudHubRoles();

  if (loading) return null;
  if (roles.length === 0) return null;

  const displayName = activeRole.roleName
    ? `Role: ${activeRole.roleName}`
    : "Admin (Direct)";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="hidden md:flex gap-1.5">
          {activeRole.roleName ? (
            <ShieldCheck className="h-4 w-4 text-primary" />
          ) : (
            <Crown className="h-4 w-4 text-warning" />
          )}
          <span className="max-w-[120px] truncate">{displayName}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setActiveRole({ roleName: null })}
          className={!activeRole.roleName ? "bg-accent" : ""}
        >
          <Crown className="h-4 w-4 mr-2 text-warning" />
          Admin (Direct)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role.id}
            onClick={() => setActiveRole({
              roleName: role.role_name,
              roleArn: role.role_arn,
              description: role.description || undefined,
            })}
            className={activeRole.roleName === role.role_name ? "bg-accent" : ""}
          >
            <ShieldCheck className="h-4 w-4 mr-2 text-primary" />
            <div className="flex flex-col">
              <span className="text-sm">{role.role_name}</span>
              {role.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {role.description}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
