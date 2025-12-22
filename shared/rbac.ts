/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * This file defines the permission matrix and role hierarchy for Vega.
 * 
 * User Types:
 * - CLIENT: Regular users belonging to client organizations
 * - CONSULTANT: External consultants who work with multiple client organizations  
 * - INTERNAL: Vega internal staff (platform admins, support)
 * 
 * The user type affects which permissions are available and how they're applied.
 */

// User type constants (matches schema.ts)
export const USER_TYPES = {
  CLIENT: 'client',
  CONSULTANT: 'consultant', 
  INTERNAL: 'internal',
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

// Role constants
export const ROLES = {
  TENANT_USER: 'tenant_user',
  TENANT_ADMIN: 'tenant_admin',
  ADMIN: 'admin', // Alias for tenant_admin (backward compatibility)
  GLOBAL_ADMIN: 'global_admin',
  VEGA_CONSULTANT: 'vega_consultant',
  VEGA_ADMIN: 'vega_admin',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Role to user type mapping
export const ROLE_USER_TYPE_MAP: Record<Role, UserType> = {
  [ROLES.TENANT_USER]: USER_TYPES.CLIENT,
  [ROLES.TENANT_ADMIN]: USER_TYPES.CLIENT,
  [ROLES.ADMIN]: USER_TYPES.CLIENT,
  [ROLES.GLOBAL_ADMIN]: USER_TYPES.INTERNAL,
  [ROLES.VEGA_CONSULTANT]: USER_TYPES.CONSULTANT,
  [ROLES.VEGA_ADMIN]: USER_TYPES.INTERNAL,
};

// Permission types
export const PERMISSIONS = {
  // Tenant data access
  READ_TENANT_DATA: 'read_tenant_data',
  
  // OKR operations
  CREATE_OKR: 'create_okr',
  UPDATE_OWN_OKR: 'update_own_okr',
  UPDATE_ANY_OKR: 'update_any_okr',
  DELETE_OKR: 'delete_okr',
  
  // Meeting operations
  CREATE_MEETING: 'create_meeting',
  UPDATE_MEETING: 'update_meeting',
  DELETE_MEETING: 'delete_meeting',
  
  // Foundation operations (mission, vision, values, goals, strategies)
  UPDATE_FOUNDATIONS: 'update_foundations',
  VIEW_FOUNDATIONS: 'view_foundations',
  
  // User management
  MANAGE_TENANT_USERS: 'manage_tenant_users',
  
  // Tenant settings
  MANAGE_TENANT_SETTINGS: 'manage_tenant_settings',
  
  // M365 integration
  MANAGE_M365_CONNECTION: 'manage_m365_connection',
  USE_M365_FEATURES: 'use_m365_features',
  
  // AI features
  USE_AI_CHAT: 'use_ai_chat',
  MANAGE_AI_GROUNDING: 'manage_ai_grounding',
  USE_LAUNCHPAD: 'use_launchpad', // AI document-to-Company OS generator
  
  // Import/Export
  IMPORT_DATA: 'import_data',
  EXPORT_DATA: 'export_data',
  
  // Cross-tenant access
  ACCESS_ANY_TENANT: 'access_any_tenant',
  ACCESS_GRANTED_TENANTS: 'access_granted_tenants', // For consultants with explicit grants
  
  // Consultant-specific permissions
  VIEW_CLIENT_STRATEGIES: 'view_client_strategies',
  ADVISE_CLIENT_OKRS: 'advise_client_okrs',      // Can suggest/advise on OKRs but not directly edit
  RUN_CLIENT_WORKSHOPS: 'run_client_workshops',   // Can run workshops/meetings for clients
  VIEW_CLIENT_ANALYTICS: 'view_client_analytics', // View reports and analytics across clients
  MANAGE_CONSULTANT_ACCESS: 'manage_consultant_access', // Can grant/revoke consultant access to tenants
  
  // Platform administration
  MANAGE_ALL_TENANTS: 'manage_all_tenants',
  MANAGE_PLATFORM: 'manage_platform',
  MANAGE_SERVICE_PLANS: 'manage_service_plans',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Permission Matrix
 * 
 * Defines which permissions each role has.
 * Roles higher in the hierarchy inherit permissions from lower roles.
 */
export const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  // Standard client user within a tenant - can work on their own items
  [ROLES.TENANT_USER]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.EXPORT_DATA,
  ],
  
  // Tenant administrator (client org admin) - full control over their tenant
  [ROLES.TENANT_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.UPDATE_ANY_OKR,
    PERMISSIONS.DELETE_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.DELETE_MEETING,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.MANAGE_TENANT_USERS,
    PERMISSIONS.MANAGE_TENANT_SETTINGS,
    PERMISSIONS.MANAGE_M365_CONNECTION,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.USE_LAUNCHPAD,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.MANAGE_CONSULTANT_ACCESS,
  ],
  
  // Admin (alias for tenant_admin)
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.UPDATE_ANY_OKR,
    PERMISSIONS.DELETE_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.DELETE_MEETING,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.MANAGE_TENANT_USERS,
    PERMISSIONS.MANAGE_TENANT_SETTINGS,
    PERMISSIONS.MANAGE_M365_CONNECTION,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.USE_LAUNCHPAD,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.MANAGE_CONSULTANT_ACCESS,
  ],
  
  // Global admin - internal staff with cross-tenant support access
  [ROLES.GLOBAL_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.UPDATE_ANY_OKR,
    PERMISSIONS.DELETE_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.DELETE_MEETING,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.MANAGE_TENANT_USERS,
    PERMISSIONS.MANAGE_TENANT_SETTINGS,
    PERMISSIONS.MANAGE_M365_CONNECTION,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.USE_LAUNCHPAD,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_ANY_TENANT,
    PERMISSIONS.VIEW_CLIENT_STRATEGIES,
    PERMISSIONS.VIEW_CLIENT_ANALYTICS,
    PERMISSIONS.MANAGE_CONSULTANT_ACCESS,
  ],
  
  // Vega consultant - external advisor with access only to granted client tenants
  // Consultants can advise and suggest but typically shouldn't directly edit client data
  [ROLES.VEGA_CONSULTANT]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.ADVISE_CLIENT_OKRS,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.RUN_CLIENT_WORKSHOPS,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.USE_LAUNCHPAD,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_GRANTED_TENANTS,
    PERMISSIONS.VIEW_CLIENT_STRATEGIES,
    PERMISSIONS.VIEW_CLIENT_ANALYTICS,
    // Note: Consultants do NOT have ACCESS_ANY_TENANT - they need explicit grants
    // Note: Consultants do NOT have UPDATE_ANY_OKR - they advise, not directly edit client OKRs
  ],
  
  // Vega admin - platform superuser with full control
  [ROLES.VEGA_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.VIEW_FOUNDATIONS,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.UPDATE_ANY_OKR,
    PERMISSIONS.DELETE_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.DELETE_MEETING,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.MANAGE_TENANT_USERS,
    PERMISSIONS.MANAGE_TENANT_SETTINGS,
    PERMISSIONS.MANAGE_M365_CONNECTION,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.USE_LAUNCHPAD,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_ANY_TENANT,
    PERMISSIONS.VIEW_CLIENT_STRATEGIES,
    PERMISSIONS.VIEW_CLIENT_ANALYTICS,
    PERMISSIONS.MANAGE_CONSULTANT_ACCESS,
    PERMISSIONS.MANAGE_ALL_TENANTS,
    PERMISSIONS.MANAGE_PLATFORM,
    PERMISSIONS.MANAGE_SERVICE_PLANS,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = PERMISSION_MATRIX[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role can access any tenant (cross-tenant access)
 */
export function canAccessAnyTenant(role: Role): boolean {
  return hasPermission(role, PERMISSIONS.ACCESS_ANY_TENANT);
}

/**
 * Get all roles that have a specific permission
 */
export function getRolesWithPermission(permission: Permission): Role[] {
  return Object.entries(PERMISSION_MATRIX)
    .filter(([_, permissions]) => permissions.includes(permission))
    .map(([role]) => role as Role);
}

/**
 * Role hierarchy for display purposes
 */
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  [ROLES.TENANT_USER]: 'User',
  [ROLES.TENANT_ADMIN]: 'Admin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.GLOBAL_ADMIN]: 'Global Admin',
  [ROLES.VEGA_CONSULTANT]: 'Consultant',
  [ROLES.VEGA_ADMIN]: 'Platform Admin',
};

/**
 * Role descriptions for UI tooltips
 */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [ROLES.TENANT_USER]: 'Standard user with access to their organization\'s data',
  [ROLES.TENANT_ADMIN]: 'Organization administrator with full access to tenant settings and users',
  [ROLES.ADMIN]: 'Organization administrator (same as Tenant Admin)',
  [ROLES.GLOBAL_ADMIN]: 'Super administrator with cross-tenant support access',
  [ROLES.VEGA_CONSULTANT]: 'External consultant with multi-tenant access for advisory work',
  [ROLES.VEGA_ADMIN]: 'Platform administrator with full system access',
};

/**
 * User type display names
 */
export const USER_TYPE_DISPLAY_NAMES: Record<UserType, string> = {
  [USER_TYPES.CLIENT]: 'Client',
  [USER_TYPES.CONSULTANT]: 'Consultant',
  [USER_TYPES.INTERNAL]: 'Internal Staff',
};

/**
 * User type descriptions
 */
export const USER_TYPE_DESCRIPTIONS: Record<UserType, string> = {
  [USER_TYPES.CLIENT]: 'Regular user belonging to a client organization',
  [USER_TYPES.CONSULTANT]: 'External advisor who works with multiple client organizations',
  [USER_TYPES.INTERNAL]: 'Vega internal staff (platform admins, support)',
};

/**
 * Get the expected user type for a role
 */
export function getUserTypeForRole(role: Role): UserType {
  return ROLE_USER_TYPE_MAP[role] || USER_TYPES.CLIENT;
}

/**
 * Check if a user type is a consultant
 */
export function isConsultantUserType(userType: UserType | string | undefined): boolean {
  return userType === USER_TYPES.CONSULTANT;
}

/**
 * Check if a user type is internal staff
 */
export function isInternalUserType(userType: UserType | string | undefined): boolean {
  return userType === USER_TYPES.INTERNAL;
}

/**
 * Check if a user type is a client
 */
export function isClientUserType(userType: UserType | string | undefined): boolean {
  return userType === USER_TYPES.CLIENT || !userType;
}

/**
 * Get available roles based on user type
 */
export function getAvailableRolesForUserType(userType: UserType): Role[] {
  return Object.entries(ROLE_USER_TYPE_MAP)
    .filter(([_, type]) => type === userType)
    .map(([role]) => role as Role);
}

/**
 * Check if a role is a consultant role
 */
export function isConsultantRole(role: Role): boolean {
  return role === ROLES.VEGA_CONSULTANT;
}

/**
 * Check if a role is a platform admin role
 */
export function isPlatformAdminRole(role: Role): boolean {
  return role === ROLES.VEGA_ADMIN || role === ROLES.GLOBAL_ADMIN;
}

/**
 * Check if a role is a tenant admin role
 */
export function isTenantAdminRole(role: Role): boolean {
  return role === ROLES.TENANT_ADMIN || role === ROLES.ADMIN;
}

/**
 * Check if user can access a specific tenant based on role and grants
 * This is a helper to determine access logic - actual grant checking should be done server-side
 */
export function canAccessTenantByRole(role: Role, isHomeTenant: boolean, hasExplicitGrant: boolean): boolean {
  // Platform admins can access any tenant
  if (hasPermission(role, PERMISSIONS.ACCESS_ANY_TENANT)) {
    return true;
  }
  
  // Consultants can access granted tenants
  if (hasPermission(role, PERMISSIONS.ACCESS_GRANTED_TENANTS)) {
    return isHomeTenant || hasExplicitGrant;
  }
  
  // Regular users can only access their home tenant
  return isHomeTenant;
}
