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
import { VocabularyProvider } from "@/contexts/VocabularyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Sparkles } from "lucide-react";
import React, { useState } from "react";
import { useLocation } from "wouter";

import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import TeamDashboard from "@/pages/TeamDashboard";
import Foundations from "@/pages/Foundations";
import Strategy from "@/pages/Strategy";
import PlanningEnhanced from "@/pages/PlanningEnhanced";
import FocusRhythm from "@/pages/FocusRhythm";
import MeetingDetail from "@/pages/MeetingDetail";
import TenantAdmin from "@/pages/TenantAdmin";
import SystemAdmin from "@/pages/SystemAdmin";
import AIGroundingAdmin from "@/pages/AIGroundingAdmin";
import Import from "@/pages/Import";
import Settings from "@/pages/Settings";
import UserGuide from "@/pages/UserGuide";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [retryCount, setRetryCount] = React.useState(0);
  const [hasWaitedForAuth, setHasWaitedForAuth] = React.useState(false);

  // Track if user was ever authenticated in this browser tab session
  const wasAuthenticated = sessionStorage.getItem('vega_was_authenticated') === 'true';
  
  // Check if we just came from SSO callback (within last 10 seconds)
  const ssoTimestamp = sessionStorage.getItem('vega_sso_pending');
  const justCameFromSSO = ssoTimestamp && (Date.now() - parseInt(ssoTimestamp, 10)) < 10000;

  // Update session storage when user becomes authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.setItem('vega_was_authenticated', 'true');
      sessionStorage.removeItem('vega_sso_pending'); // Clear SSO pending flag
    }
  }, [isAuthenticated]);

  // Debug logging
  React.useEffect(() => {
    console.log('[ProtectedRoute] Auth state:', {
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userEmail: user?.email,
      wasAuthenticated,
      justCameFromSSO,
      retryCount,
      hasWaitedForAuth
    });
  }, [isAuthenticated, isLoading, user, wasAuthenticated, justCameFromSSO, retryCount, hasWaitedForAuth]);

  // Wait for auth to stabilize before deciding to redirect
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasWaitedForAuth) {
      // Give auth a moment to stabilize (handles race conditions after SSO redirect)
      const timer = setTimeout(() => {
        setHasWaitedForAuth(true);
        setRetryCount(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, hasWaitedForAuth]);

  // Handle redirect - but only after we've waited and auth is still not working
  React.useEffect(() => {
    // Don't redirect if still loading, already authenticated, or haven't waited yet
    if (isLoading || isAuthenticated) return;
    
    // Don't redirect if we were previously authenticated or just came from SSO
    if (wasAuthenticated || justCameFromSSO) {
      console.log('[ProtectedRoute] Waiting for auth state to restore...');
      return;
    }
    
    // Only redirect after we've given auth time to stabilize
    if (hasWaitedForAuth && retryCount >= 2) {
      console.log('[ProtectedRoute] Redirecting to login - not authenticated after waiting');
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, wasAuthenticated, justCameFromSSO, hasWaitedForAuth, retryCount, setLocation]);

  if (isLoading) {
    console.log('[ProtectedRoute] Still loading auth state...');
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, showing redirect message');
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  console.log('[ProtectedRoute] Rendering protected content');
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
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <ModuleLayout>
            <Dashboard />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/team">
        <ProtectedRoute>
          <ModuleLayout>
            <TeamDashboard />
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
            <PlanningEnhanced />
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
      <Route path="/focus-rhythm/:meetingId">
        <ProtectedRoute>
          <ModuleLayout>
            <MeetingDetail />
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
      <Route path="/system-admin">
        <ProtectedRoute>
          <ModuleLayout>
            <SystemAdmin />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/import">
        <ProtectedRoute>
          <ModuleLayout>
            <Import />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/ai-grounding">
        <ProtectedRoute>
          <ModuleLayout>
            <AIGroundingAdmin />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <ModuleLayout>
            <Settings />
          </ModuleLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/help">
        <ProtectedRoute>
          <ModuleLayout>
            <UserGuide />
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
            <VocabularyProvider>
              <TooltipProvider>
                <SidebarProvider style={style as React.CSSProperties}>
                  <Router />
                </SidebarProvider>
                <Toaster />
              </TooltipProvider>
            </VocabularyProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
