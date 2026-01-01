import { useQuery } from "@tanstack/react-query";
import { hasPermission, PERMISSIONS, ROLES, type Role, type Permission } from "@shared/rbac";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  tenantId?: string;
}

interface PermissionContext {
  user: User | null;
  role: Role | null;
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  canUpdateAnyOKR: boolean;
  canUpdateOwnOKR: boolean;
  canDeleteOKR: boolean;
  canUpdateFoundations: boolean;
  canManageTenantSettings: boolean;
  canManageTenantUsers: boolean;
  canUseLaunchpad: boolean;
  canManageAIGrounding: boolean;
  canImportData: boolean;
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isOwnerOrCreator: (ownerId?: string | null, createdBy?: string | null) => boolean;
  canModifyOKR: (ownerId?: string | null, createdBy?: string | null) => boolean;
  canModifyByEmail: (ownerEmail?: string | null) => boolean;
}

export function usePermissions(): PermissionContext {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  const role = (user?.role as Role) || null;

  const checkPermission = (permission: Permission): boolean => {
    if (!role) return false;
    return hasPermission(role, permission);
  };

  const isOwnerOrCreator = (ownerId?: string | null, createdBy?: string | null): boolean => {
    if (!user) return false;
    if (ownerId && ownerId === user.id) return true;
    if (createdBy && createdBy === user.id) return true;
    return false;
  };

  // Check by ID (ownerId, createdBy)
  const canModifyOKR = (ownerId?: string | null, createdBy?: string | null): boolean => {
    if (!role) return false;
    // Users with UPDATE_ANY_OKR can edit anything
    if (hasPermission(role, PERMISSIONS.UPDATE_ANY_OKR)) return true;
    // Users with UPDATE_OWN_OKR can edit items they own or created
    if (hasPermission(role, PERMISSIONS.UPDATE_OWN_OKR) && isOwnerOrCreator(ownerId, createdBy)) return true;
    return false;
  };
  
  // Check by email (for objectives that use ownerEmail instead of ownerId)
  const canModifyByEmail = (ownerEmail?: string | null): boolean => {
    if (!role) return false;
    if (hasPermission(role, PERMISSIONS.UPDATE_ANY_OKR)) return true;
    if (hasPermission(role, PERMISSIONS.UPDATE_OWN_OKR) && user && ownerEmail === user.email) return true;
    return false;
  };

  return {
    user: user || null,
    role,
    isLoading,
    hasPermission: checkPermission,
    canUpdateAnyOKR: role ? hasPermission(role, PERMISSIONS.UPDATE_ANY_OKR) : false,
    canUpdateOwnOKR: role ? hasPermission(role, PERMISSIONS.UPDATE_OWN_OKR) : false,
    canDeleteOKR: role ? hasPermission(role, PERMISSIONS.DELETE_OKR) : false,
    canUpdateFoundations: role ? hasPermission(role, PERMISSIONS.UPDATE_FOUNDATIONS) : false,
    canManageTenantSettings: role ? hasPermission(role, PERMISSIONS.MANAGE_TENANT_SETTINGS) : false,
    canManageTenantUsers: role ? hasPermission(role, PERMISSIONS.MANAGE_TENANT_USERS) : false,
    canUseLaunchpad: role ? hasPermission(role, PERMISSIONS.USE_LAUNCHPAD) : false,
    canManageAIGrounding: role ? hasPermission(role, PERMISSIONS.MANAGE_AI_GROUNDING) : false,
    canImportData: role ? hasPermission(role, PERMISSIONS.IMPORT_DATA) : false,
    isAdmin: role === ROLES.TENANT_ADMIN || role === ROLES.ADMIN,
    isPlatformAdmin: role === ROLES.VEGA_ADMIN || role === ROLES.GLOBAL_ADMIN,
    isOwnerOrCreator,
    canModifyOKR,
    canModifyByEmail,
  };
}
