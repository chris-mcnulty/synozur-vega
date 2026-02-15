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
import { HelpChatPanel } from "@/components/HelpChatPanel";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { ConsultingModeToggle } from "@/components/ConsultingModeToggle";
import { SynozurLogo } from "@/components/SynozurLogo";
import { TenantProvider } from "@/contexts/TenantContext";
import { VocabularyProvider } from "@/contexts/VocabularyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TimePeriodProvider, useTimePeriod } from "@/contexts/TimePeriodContext";
import { ErrorBoundary, RouteErrorBoundary, PageLoadingFallback, FullPageLoadingFallback } from "@/components/ErrorBoundary";
import { Sparkles, HelpCircle, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCurrentQuarter } from "@/lib/fiscal-utils";
import React, { useState, Suspense, lazy } from "react";
import { useLocation } from "wouter";

// ============================================
// EAGERLY LOADED PAGES (needed immediately)
// ============================================
// These are loaded in the main bundle for fast initial access
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

// ============================================
// LAZY LOADED PAGES (code-split)
// ============================================
// These are loaded on-demand when the user navigates to them,
// reducing the initial bundle size significantly

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ExecutiveDashboard = lazy(() => import("@/pages/ExecutiveDashboard"));
const TeamDashboard = lazy(() => import("@/pages/TeamDashboard"));
const Foundations = lazy(() => import("@/pages/Foundations"));
const Strategy = lazy(() => import("@/pages/Strategy"));
const PlanningEnhanced = lazy(() => import("@/pages/PlanningEnhanced"));
const FocusRhythm = lazy(() => import("@/pages/FocusRhythm"));
const MeetingDetail = lazy(() => import("@/pages/MeetingDetail"));
const TenantAdmin = lazy(() => import("@/pages/TenantAdmin"));
const SystemAdmin = lazy(() => import("@/pages/SystemAdmin"));
const AIGroundingAdmin = lazy(() => import("@/pages/AIGroundingAdmin"));
const Import = lazy(() => import("@/pages/Import"));
const Reporting = lazy(() => import("@/pages/Reporting"));
const Settings = lazy(() => import("@/pages/Settings"));
const UserGuide = lazy(() => import("@/pages/UserGuide"));
const Launchpad = lazy(() => import("@/pages/Launchpad"));
const About = lazy(() => import("@/pages/About"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Roadmap = lazy(() => import("@/pages/Roadmap"));
const Backlog = lazy(() => import("@/pages/Backlog"));
const Support = lazy(() => import("@/pages/Support"));

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
    // Don't redirect if still loading or already authenticated
    if (isLoading || isAuthenticated) return;
    
    // For SSO users, wait a bit longer for auth to restore
    if (justCameFromSSO && retryCount < 3) {
      console.log('[ProtectedRoute] Waiting for SSO auth state to restore...');
      return;
    }
    
    // Only redirect after we've given auth time to stabilize
    if (hasWaitedForAuth && retryCount >= 2) {
      console.log('[ProtectedRoute] Redirecting to login - not authenticated after waiting');
      // Clear the wasAuthenticated flag since auth has clearly expired
      sessionStorage.removeItem('vega_was_authenticated');
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, justCameFromSSO, hasWaitedForAuth, retryCount, setLocation]);

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

function GlobalTimePeriodSelector() {
  const { selectedQuarterId, setSelectedQuarterId, year: selectedYear } = useTimePeriod();
  const [browseYear, setBrowseYear] = useState(selectedYear);
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;
  const maxYear = currentYear + 1;

  React.useEffect(() => {
    setBrowseYear(selectedYear);
  }, [selectedYear, open]);

  const isSelected = (qId: string) => selectedQuarterId === qId;

  const handleSelect = (qId: string) => {
    setSelectedQuarterId(qId);
    setOpen(false);
  };

  const displayLabel = selectedQuarterId.startsWith("annual-")
    ? `FY ${selectedQuarterId.replace("annual-", "")}`
    : selectedQuarterId.replace(/^q(\d)-(\d+)$/, "Q$1 $2");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2"
          data-testid="select-global-period"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="start">
        <div className="flex items-center justify-between gap-2 mb-3">
          <Button
            variant="ghost"
            size="icon"
            disabled={browseYear <= minYear}
            onClick={() => setBrowseYear((y) => y - 1)}
            data-testid="button-period-prev-year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold" data-testid="text-period-year">{browseYear}</span>
          <Button
            variant="ghost"
            size="icon"
            disabled={browseYear >= maxYear}
            onClick={() => setBrowseYear((y) => y + 1)}
            data-testid="button-period-next-year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {[1, 2, 3, 4].map((q) => {
            const qId = `q${q}-${browseYear}`;
            return (
              <Button
                key={qId}
                variant={isSelected(qId) ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => handleSelect(qId)}
                data-testid={`button-period-q${q}`}
              >
                Q{q}
              </Button>
            );
          })}
        </div>
        <Button
          variant={isSelected(`annual-${browseYear}`) ? "default" : "outline"}
          size="sm"
          className="w-full text-xs"
          onClick={() => handleSelect(`annual-${browseYear}`)}
          data-testid="button-period-annual"
        >
          Annual {browseYear}
        </Button>
        {(() => {
          const { quarter: cq, year: cy } = getCurrentQuarter();
          const currentId = `q${cq}-${cy}`;
          if (selectedQuarterId !== currentId) {
            return (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs mt-2 text-muted-foreground"
                onClick={() => {
                  setBrowseYear(cy);
                  handleSelect(currentId);
                }}
                data-testid="button-period-go-current"
              >
                Go to current period
              </Button>
            );
          }
          return null;
        })()}
      </PopoverContent>
    </Popover>
  );
}

function ModuleLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b gap-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3 flex-shrink-0">
              <SynozurLogo variant="mark" className="h-8 w-8 flex-shrink-0" />
              <span className="font-bold text-lg hidden md:block">Vega</span>
            </div>
            <GlobalTimePeriodSelector />
          </div>
          <div className="flex items-center gap-4">
            <ConsultingModeToggle />
            <TenantSwitcher />
            <button
              onClick={() => { setHelpOpen(!helpOpen); if (chatOpen) setChatOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover-elevate active-elevate-2 border"
              data-testid="button-toggle-help-chat"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="hidden md:inline">Help</span>
            </button>
            <button
              onClick={() => { setChatOpen(!chatOpen); if (helpOpen) setHelpOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover-elevate active-elevate-2 border"
              data-testid="button-toggle-ai-chat"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden md:inline">AI Chat</span>
            </button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden bg-background">
          <main className="flex-1 overflow-auto p-8 bg-background">
            <RouteErrorBoundary>
              {children}
            </RouteErrorBoundary>
          </main>
          {chatOpen && <AIChatPanel onClose={() => setChatOpen(false)} />}
          {helpOpen && (
            <HelpChatPanel
              onClose={() => setHelpOpen(false)}
              onOpenTicket={(summary) => {
                setHelpOpen(false);
                setLocation("/support/new" + (summary ? `?summary=${encodeURIComponent(summary)}` : ""));
              }}
            />
          )}
        </div>
      </div>
      <WhatsNewModal />
    </div>
  );
}

/**
 * Wrapper for lazy-loaded protected routes
 * Combines Suspense for code-splitting with protected route logic
 */
function LazyProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <ModuleLayout>
        <Suspense fallback={<PageLoadingFallback />}>
          {children}
        </Suspense>
      </ModuleLayout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes - eagerly loaded */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Protected routes - lazy loaded with code splitting */}
      <Route path="/dashboard">
        <LazyProtectedRoute>
          <Dashboard />
        </LazyProtectedRoute>
      </Route>
      <Route path="/executive">
        <LazyProtectedRoute>
          <ExecutiveDashboard />
        </LazyProtectedRoute>
      </Route>
      <Route path="/team">
        <LazyProtectedRoute>
          <TeamDashboard />
        </LazyProtectedRoute>
      </Route>
      <Route path="/foundations">
        <LazyProtectedRoute>
          <Foundations />
        </LazyProtectedRoute>
      </Route>
      <Route path="/strategy">
        <LazyProtectedRoute>
          <Strategy />
        </LazyProtectedRoute>
      </Route>
      <Route path="/planning">
        <LazyProtectedRoute>
          <PlanningEnhanced />
        </LazyProtectedRoute>
      </Route>
      <Route path="/focus-rhythm">
        <LazyProtectedRoute>
          <FocusRhythm />
        </LazyProtectedRoute>
      </Route>
      <Route path="/focus-rhythm/:meetingId">
        <LazyProtectedRoute>
          <MeetingDetail />
        </LazyProtectedRoute>
      </Route>
      <Route path="/tenant-admin">
        <LazyProtectedRoute>
          <TenantAdmin />
        </LazyProtectedRoute>
      </Route>
      <Route path="/system-admin">
        <LazyProtectedRoute>
          <SystemAdmin />
        </LazyProtectedRoute>
      </Route>
      <Route path="/import">
        <LazyProtectedRoute>
          <Import />
        </LazyProtectedRoute>
      </Route>
      <Route path="/launchpad">
        <LazyProtectedRoute>
          <Launchpad />
        </LazyProtectedRoute>
      </Route>
      <Route path="/reporting">
        <LazyProtectedRoute>
          <Reporting />
        </LazyProtectedRoute>
      </Route>
      <Route path="/ai-grounding">
        <LazyProtectedRoute>
          <AIGroundingAdmin />
        </LazyProtectedRoute>
      </Route>
      <Route path="/settings">
        <LazyProtectedRoute>
          <Settings />
        </LazyProtectedRoute>
      </Route>
      <Route path="/help">
        <LazyProtectedRoute>
          <UserGuide />
        </LazyProtectedRoute>
      </Route>
      <Route path="/about">
        <LazyProtectedRoute>
          <About />
        </LazyProtectedRoute>
      </Route>
      <Route path="/changelog">
        <LazyProtectedRoute>
          <Changelog />
        </LazyProtectedRoute>
      </Route>
      <Route path="/roadmap">
        <LazyProtectedRoute>
          <Roadmap />
        </LazyProtectedRoute>
      </Route>
      <Route path="/backlog">
        <LazyProtectedRoute>
          <Backlog />
        </LazyProtectedRoute>
      </Route>
      <Route path="/support">
        <LazyProtectedRoute>
          <Support />
        </LazyProtectedRoute>
      </Route>
      <Route path="/support/:view">
        <LazyProtectedRoute>
          <Support />
        </LazyProtectedRoute>
      </Route>

      {/* 404 - eagerly loaded */}
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TenantProvider>
              <TimePeriodProvider>
                <VocabularyProvider>
                  <TooltipProvider>
                    <SidebarProvider style={style as React.CSSProperties}>
                      <Router />
                    </SidebarProvider>
                    <Toaster />
                  </TooltipProvider>
                </VocabularyProvider>
              </TimePeriodProvider>
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
