import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { AIChatPanel } from "@/components/AIChatPanel";
import { ConsultingModeToggle } from "@/components/ConsultingModeToggle";
import { SynozurLogo } from "@/components/SynozurLogo";
import { TenantProvider } from "@/contexts/TenantContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Foundations from "@/pages/Foundations";
import Strategy from "@/pages/Strategy";
import Planning from "@/pages/Planning";
import FocusRhythm from "@/pages/FocusRhythm";
import TenantAdmin from "@/pages/TenantAdmin";
import NotFound from "@/pages/not-found";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}

function ModuleLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b gap-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <SynozurLogo variant="mark" className="h-8 w-8" />
              <span className="font-bold text-lg hidden md:block">Vega</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ConsultingModeToggle />
            <TenantSwitcher />
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover-elevate active-elevate-2 border"
              data-testid="button-toggle-ai-chat"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden md:inline">AI Chat</span>
            </button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
          {chatOpen && <AIChatPanel onClose={() => setChatOpen(false)} />}
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <ModuleLayout>
            <Dashboard />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/foundations">
        <ProtectedRoute>
          <ModuleLayout>
            <Foundations />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/strategy">
        <ProtectedRoute>
          <ModuleLayout>
            <Strategy />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/planning">
        <ProtectedRoute>
          <ModuleLayout>
            <Planning />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/focus-rhythm">
        <ProtectedRoute>
          <ModuleLayout>
            <FocusRhythm />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/tenant-admin">
        <ProtectedRoute>
          <ModuleLayout>
            <TenantAdmin />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              <SidebarProvider style={style as React.CSSProperties}>
                <Router />
              </SidebarProvider>
              <Toaster />
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
