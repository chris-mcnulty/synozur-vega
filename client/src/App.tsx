import { HelmetProvider } from "react-helmet-async";
import { Switch, Route, Link } from "wouter";
import { cn } from "@/lib/utils";
import synozurMark from "@/assets/brand/SynozurMark_color1400_1766606244412.png";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { AIChatPanel } from "@/components/AIChatPanel";
import { HelpChatPanel } from "@/components/HelpChatPanel";
import { WhatsNewModal } from "@/components/WhatsNewModal";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { ConsultingModeToggle } from "@/components/ConsultingModeToggle";
import { ContextualBreadcrumbs } from "@/components/ContextualBreadcrumbs";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { VocabularyProvider } from "@/contexts/VocabularyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TimePeriodProvider, useTimePeriod } from "@/contexts/TimePeriodContext";
import { ErrorBoundary, RouteErrorBoundary, PageLoadingFallback, FullPageLoadingFallback } from "@/components/ErrorBoundary";
import { Sparkles, HelpCircle, CalendarRange, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCurrentQuarter } from "@/lib/fiscal-utils";
import { CommandPalette } from "@/components/CommandPalette";
import React, { useState, Suspense, lazy } from "react";
import { useLocation } from "wouter";

// ============================================
// EAGERLY LOADED PAGES (needed immediately)
// ============================================
// These are loaded in the main bundle for fast initial access
import Login from "@/pages/Login";
import Landing from "@/pages/Landing";
import Pricing from "@/pages/Pricing";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";

// ============================================
// CHUNK LOAD RETRY
// ============================================
// After a new deploy the chunk filenames change. Users with the old HTML
// cached will request a chunk that no longer exists on the server.
// When that happens we do ONE forced reload so the browser fetches the
// fresh HTML (and new chunk names). A sessionStorage flag prevents an
// infinite-reload loop if the chunk is genuinely missing.
const CHUNK_RELOAD_KEY = "vega_chunk_reload";
function lazyWithChunkRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Loading chunk") ||
        msg.includes("Importing a module script failed");

      if (isChunkError && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        window.location.reload();
        // Suspend forever — the reload will take over
        return new Promise<never>(() => {});
      }
      return Promise.reject(err);
    })
  );
}

// ============================================
// LAZY LOADED PAGES (code-split)
// ============================================
// These are loaded on-demand when the user navigates to them,
// reducing the initial bundle size significantly

const Dashboard = lazyWithChunkRetry(() => import("@/pages/Dashboard"));
const MyFocus = lazyWithChunkRetry(() => import("@/pages/MyFocus"));
const ExecutiveDashboard = lazyWithChunkRetry(() => import("@/pages/ExecutiveDashboard"));
const TeamDashboard = lazyWithChunkRetry(() => import("@/pages/TeamDashboard"));
const Foundations = lazyWithChunkRetry(() => import("@/pages/Foundations"));
const Strategy = lazyWithChunkRetry(() => import("@/pages/Strategy"));
const PlanningEnhanced = lazyWithChunkRetry(() => import("@/pages/PlanningEnhanced"));
const PlanningWorkshop = lazyWithChunkRetry(() => import("@/pages/PlanningWorkshop"));
const FocusRhythm = lazyWithChunkRetry(() => import("@/pages/FocusRhythm"));
const MeetingDetail = lazyWithChunkRetry(() => import("@/pages/MeetingDetail"));
const MeetingLive = lazyWithChunkRetry(() => import("@/pages/MeetingLive"));
const TenantAdmin = lazyWithChunkRetry(() => import("@/pages/TenantAdmin"));
const SystemAdmin = lazyWithChunkRetry(() => import("@/pages/SystemAdmin"));
const AIGroundingAdmin = lazyWithChunkRetry(() => import("@/pages/AIGroundingAdmin"));
const Import = lazyWithChunkRetry(() => import("@/pages/Import"));
const Reporting = lazyWithChunkRetry(() => import("@/pages/Reporting"));
const Settings = lazyWithChunkRetry(() => import("@/pages/Settings"));
const UserGuide = lazyWithChunkRetry(() => import("@/pages/UserGuide"));
const Launchpad = lazyWithChunkRetry(() => import("@/pages/Launchpad"));
const About = lazyWithChunkRetry(() => import("@/pages/About"));
const Changelog = lazyWithChunkRetry(() => import("@/pages/Changelog"));
const Roadmap = lazyWithChunkRetry(() => import("@/pages/Roadmap"));
const Backlog = lazyWithChunkRetry(() => import("@/pages/Backlog"));
const Support = lazyWithChunkRetry(() => import("@/pages/Support"));
const Trash = lazyWithChunkRetry(() => import("@/pages/Trash"));
const Notifications = lazyWithChunkRetry(() => import("@/pages/Notifications"));
const NotificationPreferences = lazyWithChunkRetry(() => import("@/pages/NotificationPreferences"));
const ReviewQueue = lazyWithChunkRetry(() => import("@/pages/ReviewQueue"));
const SearchAnalytics = lazyWithChunkRetry(() => import("@/pages/SearchAnalytics"));

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

function GlobalTimePeriodSelector({ className }: { className?: string }) {
  const { selectedQuarterIds, toggleQuarterId, setSelectedQuarterIds, year: selectedYear } = useTimePeriod();
  const [browseYear, setBrowseYear] = useState(selectedYear);
  const [open, setOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 2;
  const maxYear = currentYear + 1;

  React.useEffect(() => {
    setBrowseYear(selectedYear);
  }, [selectedYear, open]);

  const isSelected = (qId: string) => selectedQuarterIds.includes(qId);

  const handleToggle = (qId: string) => {
    toggleQuarterId(qId);
  };

  const handleSingleSelect = (qId: string) => {
    setSelectedQuarterIds([qId]);
    setOpen(false);
  };

  const getDisplayLabel = () => {
    if (selectedQuarterIds.length === 0) return "Select Period";
    if (selectedQuarterIds.length === 1) {
      const id = selectedQuarterIds[0];
      if (id.startsWith("annual-")) return `FY ${id.replace("annual-", "")}`;
      return id.replace(/^q(\d)-(\d+)$/, "Q$1 $2");
    }
    const years = new Set<number>();
    const parsed: { label: string; year: number }[] = [];
    for (const id of selectedQuarterIds) {
      if (id.startsWith("annual-")) {
        const y = parseInt(id.replace("annual-", ""));
        years.add(y);
        parsed.push({ label: "FY", year: y });
      } else {
        const match = id.match(/^q(\d)-(\d+)$/);
        if (match) {
          years.add(parseInt(match[2]));
          parsed.push({ label: `Q${match[1]}`, year: parseInt(match[2]) });
        }
      }
    }
    if (years.size === 1) {
      return parsed.map(p => p.label).join(" + ") + ` ${Array.from(years)[0]}`;
    }
    return parsed.map(p => `${p.label} ${p.year}`).join(" + ");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("flex items-center gap-2", className)}
          data-testid="select-global-period"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium" data-testid="text-selected-period">{getDisplayLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Select periods</span>
          {selectedQuarterIds.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-[10px] text-muted-foreground"
              onClick={() => setSelectedQuarterIds([selectedQuarterIds[0]])}
              data-testid="button-period-clear-multi"
            >
              Clear multi
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mb-3 mt-2">
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
            const sel = isSelected(qId);
            return (
              <Button
                key={qId}
                variant={sel ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => handleToggle(qId)}
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
          onClick={() => handleToggle(`annual-${browseYear}`)}
          data-testid="button-period-annual"
        >
          Annual {browseYear}
        </Button>
        {(() => {
          const { quarter: cq, year: cy } = getCurrentQuarter();
          const currentId = `q${cq}-${cy}`;
          const prevQ = cq === 1 ? 4 : cq - 1;
          const prevY = cq === 1 ? cy - 1 : cy;
          const prevId = `q${prevQ}-${prevY}`;
          const isCurrent = selectedQuarterIds.length === 1 && selectedQuarterIds[0] === currentId;
          const isPrev = selectedQuarterIds.length === 1 && selectedQuarterIds[0] === prevId;
          if (isCurrent && isPrev) return null;
          return (
            <div className="flex flex-col gap-1 mt-2">
              {!isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => {
                    setBrowseYear(cy);
                    handleSingleSelect(currentId);
                  }}
                  data-testid="button-period-go-current"
                >
                  Current quarter (Q{cq} {cy})
                </Button>
              )}
              {!isPrev && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => {
                    setBrowseYear(prevY);
                    handleSingleSelect(prevId);
                  }}
                  data-testid="button-period-go-previous"
                >
                  Previous quarter (Q{prevQ} {prevY})
                </Button>
              )}
            </div>
          );
        })()}
      </PopoverContent>
    </Popover>
  );
}

function ModuleLayout({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const { currentTenant } = useTenant();
  const { theme } = useTheme();
  const tenantLogo = theme === 'dark' && currentTenant?.logoUrlDark
    ? currentTenant.logoUrlDark
    : currentTenant?.logoUrl;

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AnnouncementBanner />
        <header className="flex items-center justify-between px-2 md:px-4 py-2 md:py-4 border-b page-header-gradient-bar gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            {tenantLogo && (
              <img
                src={tenantLogo}
                alt={currentTenant?.name || "Organization"}
                className="h-7 md:h-8 w-auto max-w-[120px] object-contain flex-shrink-0"
              />
            )}
            <GlobalTimePeriodSelector className="hidden sm:flex" />
          </div>
          <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
            <div className="hidden md:flex relative items-center">
              <Search className="h-3.5 w-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                readOnly
                placeholder="Search…"
                onFocus={(e) => {
                  e.currentTarget.blur();
                  setCommandOpen(true);
                }}
                onClick={() => setCommandOpen(true)}
                className="h-9 w-56 rounded-md border bg-background pl-8 pr-12 text-sm text-muted-foreground placeholder:text-muted-foreground hover-elevate cursor-pointer focus:outline-none"
                data-testid="input-header-search"
                aria-label="Open global search"
              />
              <kbd className="absolute right-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            <div className="hidden lg:block">
              <ConsultingModeToggle />
            </div>
            <TenantSwitcher />
            <NotificationBell />
            <button
              onClick={() => { setHelpOpen(!helpOpen); if (chatOpen) setChatOpen(false); }}
              className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg hover-elevate active-elevate-2 border"
              data-testid="button-toggle-help-chat"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              <span className="hidden md:inline">Help</span>
            </button>
            <button
              onClick={() => { setChatOpen(!chatOpen); if (helpOpen) setHelpOpen(false); }}
              className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg hover-elevate active-elevate-2 border"
              data-testid="button-toggle-ai-chat"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden md:inline">AI Chat</span>
            </button>
            <ThemeToggle />
          </div>
        </header>
        <div className="sm:hidden px-2 py-1.5 border-b">
          <GlobalTimePeriodSelector />
        </div>
        <ContextualBreadcrumbs />
        <div className="flex flex-1 overflow-hidden bg-background">
          <main className="flex-1 overflow-auto p-4 md:p-8 bg-background">
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
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}

/**
 * Public layout for pages accessible without login (e.g. User Guide).
 * Renders the same sticky nav as the landing page.
 */
function PublicGuideLayout({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50">
        <nav
          className={`transition-all duration-200 border-b ${
            isScrolled
              ? "bg-background/95 backdrop-blur-md border-border"
              : "bg-background/95 backdrop-blur-sm border-transparent"
          }`}
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <img src={synozurMark} alt="Vega" className="h-8 object-contain" />
              <span className="text-lg font-semibold text-foreground">Vega</span>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <Link href="/login?mode=signup">
                <Button size="sm" data-testid="button-guide-nav-get-started">
                  Get started
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm" variant="outline" data-testid="button-guide-nav-login">
                  Log in
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>
      <div className="pt-16 p-4 md:p-8">
        <Suspense fallback={<PageLoadingFallback />}>
          {children}
        </Suspense>
      </div>
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
      <Route path="/pricing" component={Pricing} />
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
      <Route path="/focus">
        <LazyProtectedRoute>
          <MyFocus />
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
      <Route path="/planning-workshop/:id">
        <LazyProtectedRoute>
          <PlanningWorkshop />
        </LazyProtectedRoute>
      </Route>
      <Route path="/planning-workshop">
        <LazyProtectedRoute>
          <PlanningWorkshop />
        </LazyProtectedRoute>
      </Route>
      <Route path="/focus-rhythm">
        <LazyProtectedRoute>
          <FocusRhythm />
        </LazyProtectedRoute>
      </Route>
      <Route path="/focus-rhythm/:meetingId/live">
        <LazyProtectedRoute>
          <MeetingLive />
        </LazyProtectedRoute>
      </Route>
      <Route path="/meetings/:meetingId/live">
        <LazyProtectedRoute>
          <MeetingLive />
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
      <Route path="/search-analytics">
        <LazyProtectedRoute>
          <SearchAnalytics />
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
        <PublicGuideLayout>
          <UserGuide />
        </PublicGuideLayout>
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
      <Route path="/trash">
        <LazyProtectedRoute>
          <Trash />
        </LazyProtectedRoute>
      </Route>
      <Route path="/notifications">
        <LazyProtectedRoute>
          <Notifications />
        </LazyProtectedRoute>
      </Route>
      <Route path="/notifications/preferences">
        <LazyProtectedRoute>
          <NotificationPreferences />
        </LazyProtectedRoute>
      </Route>
      <Route path="/review-queue">
        <LazyProtectedRoute>
          <ReviewQueue />
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

  // Clear the chunk-reload guard once the app boots successfully so the next
  // deploy can also trigger an auto-reload for stale-cache users.
  React.useEffect(() => {
    sessionStorage.removeItem("vega_chunk_reload");
  }, []);

  return (
    <HelmetProvider>
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
    </HelmetProvider>
  );
}

export default App;
