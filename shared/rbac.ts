/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * This file defines the permission matrix and role hierarchy for Vega.
 */

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
  
  // Import/Export
  IMPORT_DATA: 'import_data',
  EXPORT_DATA: 'export_data',
  
  // Cross-tenant access
  ACCESS_ANY_TENANT: 'access_any_tenant',
  
  // Platform administration
  MANAGE_ALL_TENANTS: 'manage_all_tenants',
  MANAGE_PLATFORM: 'manage_platform',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Permission Matrix
 * 
 * Defines which permissions each role has.
 * Roles higher in the hierarchy inherit permissions from lower roles.
 */
export const PERMISSION_MATRIX: Record<Role, Permission[]> = {
  // Standard user within a tenant
  [ROLES.TENANT_USER]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.EXPORT_DATA,
  ],
  
  // Tenant administrator
  [ROLES.TENANT_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
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
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  
  // Admin (alias for tenant_admin)
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
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
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
  ],
  
  // Global admin - can support any tenant
  [ROLES.GLOBAL_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
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
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_ANY_TENANT,
  ],
  
  // Vega consultant - can access client tenants for advisory work
  [ROLES.VEGA_CONSULTANT]: [
    PERMISSIONS.READ_TENANT_DATA,
    PERMISSIONS.CREATE_OKR,
    PERMISSIONS.UPDATE_OWN_OKR,
    PERMISSIONS.UPDATE_ANY_OKR,
    PERMISSIONS.DELETE_OKR,
    PERMISSIONS.CREATE_MEETING,
    PERMISSIONS.UPDATE_MEETING,
    PERMISSIONS.DELETE_MEETING,
    PERMISSIONS.UPDATE_FOUNDATIONS,
    PERMISSIONS.USE_M365_FEATURES,
    PERMISSIONS.USE_AI_CHAT,
    PERMISSIONS.MANAGE_AI_GROUNDING,
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_ANY_TENANT,
  ],
  
  // Vega admin - platform superuser
  [ROLES.VEGA_ADMIN]: [
    PERMISSIONS.READ_TENANT_DATA,
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
    PERMISSIONS.IMPORT_DATA,
    PERMISSIONS.EXPORT_DATA,
    PERMISSIONS.ACCESS_ANY_TENANT,
    PERMISSIONS.MANAGE_ALL_TENANTS,
    PERMISSIONS.MANAGE_PLATFORM,
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
