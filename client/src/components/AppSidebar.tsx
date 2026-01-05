import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Building2, Target, TrendingUp, Calendar, Settings, Upload, Brain, UserCog, LogOut, HelpCircle, Shield, Users, BarChart2, Rocket, Info, ChevronDown, type LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation } from "wouter";
import { SynozurLogo } from "./SynozurLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "@/components/ThemeProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLES, hasPermission, PERMISSIONS, type Role } from "@shared/rbac";
import { cn } from "@/lib/utils";

// Default expanded sections
const DEFAULT_EXPANDED_SECTIONS = ['execute', 'plan-align'];

// Navigation organized into logical sections
interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  testId?: string;
}

interface NavigationSection {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultExpanded: boolean;
  items: NavigationItem[];
  requiredPermission?: string;
}

const navigationSections: NavigationSection[] = [
  {
    id: 'execute',
    label: 'Execute',
    icon: LayoutDashboard,
    description: 'Monitor progress and team execution',
    defaultExpanded: true,
    items: [
      { title: 'Company OS', url: '/dashboard', icon: LayoutDashboard, testId: 'sidebar-company-os' },
      { title: 'Executive', url: '/executive', icon: BarChart2, testId: 'sidebar-executive' },
      { title: 'Team Mode', url: '/team', icon: Users, testId: 'sidebar-team-mode' }
    ]
  },
  {
    id: 'plan-align',
    label: 'Plan & Align',
    icon: Target,
    description: 'Strategy development and goal alignment',
    defaultExpanded: true,
    items: [
      { title: 'Foundations', url: '/foundations', icon: Building2, testId: 'sidebar-foundations' },
      { title: 'Strategy', url: '/strategy', icon: Target, testId: 'sidebar-strategy' },
      { title: 'Planning', url: '/planning', icon: TrendingUp, testId: 'sidebar-planning' }
    ]
  },
  {
    id: 'review-learn',
    label: 'Review & Learn',
    icon: Calendar,
    description: 'Meeting management and analytics',
    defaultExpanded: false,
    items: [
      { title: 'Focus Rhythm', url: '/focus-rhythm', icon: Calendar, testId: 'sidebar-focus-rhythm' }
    ]
  }
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { currentTenant } = useTenant();
  const { theme } = useTheme();
  const [logoError, setLogoError] = useState(false);
  
  // Load expanded sections from localStorage or use defaults
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_EXPANDED_SECTIONS;
    const saved = localStorage.getItem('vega-expanded-nav-sections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_EXPANDED_SECTIONS;
      }
    }
    return DEFAULT_EXPANDED_SECTIONS;
  });

  // Select appropriate logo based on theme
  const tenantLogo = theme === 'dark' && currentTenant?.logoUrlDark 
    ? currentTenant.logoUrlDark 
    : currentTenant?.logoUrl;
    
  // Reset logo error state when tenant or logo URL changes
  useEffect(() => {
    setLogoError(false);
  }, [tenantLogo]);

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };
  
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSections = prev.includes(sectionId) 
        ? prev.filter(s => s !== sectionId)
        : [...prev, sectionId];
      localStorage.setItem('vega-expanded-nav-sections', JSON.stringify(newSections));
      return newSections;
    });
  }, []);

  const userRole = (user?.role || ROLES.TENANT_USER) as Role;
  const canManageTenant = hasPermission(userRole, PERMISSIONS.MANAGE_TENANT_SETTINGS);
  const canImportData = hasPermission(userRole, PERMISSIONS.IMPORT_DATA);
  const canManageAI = hasPermission(userRole, PERMISSIONS.MANAGE_AI_GROUNDING);
  const isPlatformAdmin = userRole === ROLES.VEGA_ADMIN || userRole === ROLES.GLOBAL_ADMIN;

  // Show tenant logo only if URL exists and hasn't errored
  const showTenantLogo = tenantLogo && !logoError;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          {showTenantLogo ? (
            <img 
              src={tenantLogo} 
              alt={currentTenant?.name || "Organization"} 
              className="h-8 w-auto max-w-[120px] object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <SynozurLogo variant="mark" className="h-8 w-8" />
          )}
          <span className="font-bold text-lg">Vega</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Main Navigation Sections */}
        {navigationSections.map(section => {
          const isExpanded = expandedSections.includes(section.id);
          const hasActivePage = section.items.some(item => location === item.url);

          return (
            <Collapsible key={section.id} open={isExpanded || hasActivePage} onOpenChange={() => toggleSection(section.id)}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="group/collapsible cursor-pointer hover:bg-accent/50 transition-colors px-3 py-2 rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <section.icon className="h-4 w-4" />
                      <span>{section.label}</span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      (isExpanded || hasActivePage) && "rotate-180"
                    )} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            isActive={location === item.url}
                            data-testid={item.testId}
                          >
                            <a href={item.url} className="pl-6">
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
        
        {/* Admin Section */}
        {(canManageTenant || canImportData || canManageAI) && (
          <Collapsible
            open={expandedSections.includes('manage') || 
                  ['/launchpad', '/import', '/reporting', '/ai-grounding', '/tenant-admin'].includes(location)}
            onOpenChange={() => toggleSection('manage')}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="group/collapsible cursor-pointer hover:bg-accent/50 transition-colors px-3 py-2 rounded-md flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Manage</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    (expandedSections.includes('manage') || 
                     ['/launchpad', '/import', '/reporting', '/ai-grounding', '/tenant-admin'].includes(location)) && "rotate-180"
                  )} />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {canImportData && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/launchpad"}
                          data-testid="sidebar-launchpad"
                        >
                          <a href="/launchpad" className="pl-6">
                            <Rocket className="h-4 w-4" />
                            <span>Launchpad</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {canImportData && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/import"}
                          data-testid="sidebar-import"
                        >
                          <a href="/import" className="pl-6">
                            <Upload className="h-4 w-4" />
                            <span>Import Data</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {canManageTenant && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/reporting"}
                          data-testid="sidebar-reporting"
                        >
                          <a href="/reporting" className="pl-6">
                            <BarChart2 className="h-4 w-4" />
                            <span>Reporting</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {canManageAI && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/ai-grounding"}
                          data-testid="sidebar-ai-grounding"
                        >
                          <a href="/ai-grounding" className="pl-6">
                            <Brain className="h-4 w-4" />
                            <span>AI Grounding</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                    {canManageTenant && (
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={location === "/tenant-admin"}
                          data-testid="sidebar-tenant-admin"
                        >
                          <a href="/tenant-admin" className="pl-6">
                            <Settings className="h-4 w-4" />
                            <span>Tenant Admin</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Platform Admin Section */}
        {isPlatformAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 py-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Platform</span>
              </div>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/system-admin"}
                    data-testid="sidebar-system-admin"
                  >
                    <a href="/system-admin" className="pl-6">
                      <Shield className="h-4 w-4" />
                      <span>System Admin</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Personal Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              <span>Personal</span>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/settings"}
                  data-testid="sidebar-my-settings"
                >
                  <a href="/settings" className="pl-6">
                    <UserCog className="h-4 w-4" />
                    <span>My Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-user-guide">
                  <a href="/help" className="pl-6">
                    <HelpCircle className="h-4 w-4" />
                    <span>User Guide</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="link-about">
                  <a href="/about" className="pl-6">
                    <Info className="h-4 w-4" />
                    <span>About</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-sidebar-user-name">
              {user?.name || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-sidebar-user-email">
              {user?.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover-elevate text-muted-foreground hover:text-foreground"
            title="Logout"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
