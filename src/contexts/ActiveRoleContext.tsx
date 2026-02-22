import { createContext, useContext, useState, ReactNode } from "react";

interface ActiveRole {
  roleName: string | null; // null = Admin (Direct)
  roleArn?: string;
  description?: string;
}

interface ActiveRoleContextType {
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | null>(null);

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const [activeRole, setActiveRole] = useState<ActiveRole>({ roleName: null });

  return (
    <ActiveRoleContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error("useActiveRole must be used within an ActiveRoleProvider");
  }
  return context;
}
