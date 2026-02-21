import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AWSDataProvider } from "@/contexts/AWSDataContext";
import { ThemeProvider } from "next-themes";
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

const WithAWSData = ({ children }: { children: React.ReactNode }) => (
  <AWSDataProvider>{children}</AWSDataProvider>
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
              <Route path="/setup/*" element={<WithAWSData><Setup /></WithAWSData>} />
              <Route path="/dashboard" element={<WithAWSData><Dashboard /></WithAWSData>} />
              <Route path="/ec2" element={<WithAWSData><EC2Instances /></WithAWSData>} />
              <Route path="/rds" element={<WithAWSData><RDSDatabases /></WithAWSData>} />
              <Route path="/vpc" element={<WithAWSData><VPCNetworking /></WithAWSData>} />
              <Route path="/security" element={<WithAWSData><Security /></WithAWSData>} />
              <Route path="/costs" element={<WithAWSData><CostManagement /></WithAWSData>} />
              <Route path="/monitoring" element={<WithAWSData><Monitoring /></WithAWSData>} />
              <Route path="/alerts" element={<WithAWSData><Alerts /></WithAWSData>} />
              <Route path="/logs" element={<WithAWSData><ActivityLog /></WithAWSData>} />
              <Route path="/settings" element={<WithAWSData><Settings /></WithAWSData>} />
              <Route path="/aws-setup" element={<WithAWSData><AWSSetup /></WithAWSData>} />
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
