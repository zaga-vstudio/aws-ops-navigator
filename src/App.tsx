import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AWSDataProvider } from "@/contexts/AWSDataContext";
import { ActiveRoleProvider } from "@/contexts/ActiveRoleContext";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/ProtectedRoute";
import Homepage from "./pages/Homepage";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import EC2Instances from "./pages/EC2Instances";
import RDSDatabases from "./pages/RDSDatabases";
import VPCNetworking from "./pages/VPCNetworking";
import Security from "./pages/Security";
import CostManagement from "./pages/CostManagement";
import Monitoring from "./pages/Monitoring";
import Alerts from "./pages/Alerts";
import ActivityLog from "./pages/ActivityLog";
import Settings from "./pages/Settings";
import AWSSetup from "./pages/AWSSetup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedAWSLayout = () => (
  <ProtectedRoute>
    <ActiveRoleProvider>
      <AWSDataProvider>
        <Outlet />
      </AWSDataProvider>
    </ActiveRoleProvider>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Homepage />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<ProtectedAWSLayout />}>
                <Route path="/setup/*" element={<Setup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/ec2" element={<EC2Instances />} />
                <Route path="/rds" element={<RDSDatabases />} />
                <Route path="/vpc" element={<VPCNetworking />} />
                <Route path="/security" element={<Security />} />
                <Route path="/costs" element={<CostManagement />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/logs" element={<ActivityLog />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/aws-setup" element={<AWSSetup />} />
              </Route>
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
