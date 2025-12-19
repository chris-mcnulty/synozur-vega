import { useState, useEffect } from "react";
import { LayoutDashboard, Building2, Target, TrendingUp, Calendar, Settings, Upload, Brain, UserCog, LogOut, HelpCircle, Shield, Users, BarChart2 } from "lucide-react";
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
import { useLocation } from "wouter";
import { SynozurLogo } from "./SynozurLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ROLES, hasPermission, PERMISSIONS, type Role } from "@shared/rbac";

const menuItems = [
  {
    title: "Company OS",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Team Mode",
    url: "/team",
    icon: Users,
  },
  {
    title: "Foundations",
    url: "/foundations",
    icon: Building2,
  },
  {
    title: "Strategy",
    url: "/strategy",
    icon: Target,
  },
  {
    title: "Planning",
    url: "/planning",
    icon: TrendingUp,
  },
  {
    title: "Focus Rhythm",
    url: "/focus-rhythm",
    icon: Calendar,
  },
];

const adminItems = [
  {
    title: "Import Data",
    url: "/import",
    icon: Upload,
  },
  {
    title: "Reporting",
    url: "/reporting",
    icon: BarChart2,
  },
  {
    title: "AI Grounding",
    url: "/ai-grounding",
    icon: Brain,
  },
  {
    title: "Tenant Admin",
    url: "/tenant-admin",
    icon: Settings,
  },
];

const platformAdminItems = [
  {
    title: "System Admin",
    url: "/system-admin",
    icon: Shield,
  },
];

const userItems = [
  {
    title: "My Settings",
    url: "/settings",
    icon: UserCog,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { currentTenant } = useTenant();
  const [logoError, setLogoError] = useState(false);

  // Reset logo error state when tenant or logo URL changes
  const tenantLogo = currentTenant?.logoUrl;
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

  const userRole = (user?.role || ROLES.TENANT_USER) as Role;
  const canManageTenant = hasPermission(userRole, PERMISSIONS.MANAGE_TENANT_SETTINGS);
  const canImportData = hasPermission(userRole, PERMISSIONS.IMPORT_DATA);
  const canManageAI = hasPermission(userRole, PERMISSIONS.MANAGE_AI_GROUNDING);
  const isPlatformAdmin = userRole === ROLES.VEGA_ADMIN || userRole === ROLES.GLOBAL_ADMIN;
  const showAdminSection = canManageTenant || canImportData || canManageAI;

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
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showAdminSection && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {canImportData && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/import"}
                      data-testid="sidebar-import"
                    >
                      <a href="/import">
                        <Upload />
                        <span>Import Data</span>
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
                      <a href="/ai-grounding">
                        <Brain />
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
                      <a href="/tenant-admin">
                        <Settings />
                        <span>Tenant Admin</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isPlatformAdmin && platformAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid="sidebar-system-admin"
                    >
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {userItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <div className="mb-3">
          <a 
            href="/help" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-user-guide"
          >
            <HelpCircle className="h-4 w-4" />
            <span>User Guide</span>
          </a>
        </div>
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
