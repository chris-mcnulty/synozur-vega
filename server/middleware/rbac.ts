/**
 * RBAC Middleware
 * 
 * Provides role-based access control and tenant isolation for API routes.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { 
  Role, 
  Permission, 
  ROLES, 
  hasPermission, 
  hasAnyPermission,
  canAccessAnyTenant,
  PERMISSIONS 
} from '../../shared/rbac';
import type { User } from '../../shared/schema';

// User type constants (matches schema.ts and rbac.ts)
const USER_TYPES = {
  CLIENT: 'client',
  CONSULTANT: 'consultant',
  INTERNAL: 'internal',
} as const;

type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

// Extend Express Request to include user and tenant context
declare global {
  namespace Express {
    interface Request {
      user?: User;
      effectiveTenantId?: string;
      isMultiTenantAccess?: boolean;
      isConsultantAccess?: boolean; // True if accessing as consultant (not internal/client)
    }
  }
}

/**
 * Middleware to load the current user from session
 * Must be called after requireAuth
 */
export async function loadCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.userId = undefined;
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Error loading current user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware factory to require specific roles
 * Usage: requireRole(ROLES.TENANT_ADMIN, ROLES.VEGA_ADMIN)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role as Role;
    
    if (!allowedRoles.includes(userRole)) {
      console.warn(`Access denied: User ${req.user.email} with role ${userRole} attempted to access route requiring ${allowedRoles.join(' or ')}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
}

/**
 * Middleware factory to require specific permissions
 * Usage: requirePermission(PERMISSIONS.MANAGE_TENANT_USERS)
 */
export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role as Role;
    
    if (!hasAnyPermission(userRole, requiredPermissions)) {
      console.warn(`Permission denied: User ${req.user.email} with role ${userRole} lacks permissions: ${requiredPermissions.join(', ')}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
}

/**
 * Resolve the effective tenant context for a request
 * 
 * Priority:
 * 1. x-tenant-id header (for multi-tenant users)
 * 2. tenantId in request params
 * 3. tenantId in request body
 * 4. User's assigned tenantId
 */
export function resolveTenantContext(req: Request): { tenantId: string | null; source: string } {
  // Check header first (for multi-tenant access)
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) {
    return { tenantId: headerTenantId, source: 'header' };
  }

  // Check URL params
  const paramTenantId = req.params.tenantId;
  if (paramTenantId) {
    return { tenantId: paramTenantId, source: 'params' };
  }

  // Check request body
  const bodyTenantId = req.body?.tenantId;
  if (bodyTenantId) {
    return { tenantId: bodyTenantId, source: 'body' };
  }

  // Fall back to user's assigned tenant
  const userTenantId = req.user?.tenantId;
  return { tenantId: userTenantId || null, source: 'user' };
}

/**
 * Check if a user is a consultant (vega_consultant role or consultant userType)
 */
function isConsultant(role: Role, userType?: string | null): boolean {
  return role === ROLES.VEGA_CONSULTANT || userType === USER_TYPES.CONSULTANT;
}

/**
 * Check if a user is internal staff (vega_admin, global_admin, or internal userType)
 */
function isInternalStaff(role: Role, userType?: string | null): boolean {
  return role === ROLES.VEGA_ADMIN || role === ROLES.GLOBAL_ADMIN || userType === USER_TYPES.INTERNAL;
}

/**
 * Check if a user is a client (client userType or tenant_user/tenant_admin roles)
 */
function isClientUser(role: Role, userType?: string | null): boolean {
  const clientRoles = [ROLES.TENANT_USER, ROLES.TENANT_ADMIN, ROLES.ADMIN];
  return clientRoles.includes(role) || userType === USER_TYPES.CLIENT || !userType;
}

/**
 * Get the effective user type from a user object
 */
function getEffectiveUserType(user: User): UserType {
  const userType = (user as any).userType as string | undefined;
  if (userType === USER_TYPES.CONSULTANT) return USER_TYPES.CONSULTANT;
  if (userType === USER_TYPES.INTERNAL) return USER_TYPES.INTERNAL;
  if (user.role === ROLES.VEGA_CONSULTANT) return USER_TYPES.CONSULTANT;
  if (user.role === ROLES.VEGA_ADMIN || user.role === ROLES.GLOBAL_ADMIN) return USER_TYPES.INTERNAL;
  return USER_TYPES.CLIENT;
}

/**
 * Middleware to enforce tenant access
 * Ensures users can only access their own tenant's data unless they have cross-tenant permissions
 * Consultants require explicit grants to access tenants other than their home tenant
 */
export async function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userRole = req.user.role as Role;
  const userType = (req.user as any).userType as string | undefined;
  const effectiveUserType = getEffectiveUserType(req.user);
  const { tenantId, source } = resolveTenantContext(req);

  // Track if this is consultant access for permission checks downstream
  req.isConsultantAccess = effectiveUserType === USER_TYPES.CONSULTANT;

  // Consultants have special handling - they need explicit grants for non-home tenants
  if (isConsultant(userRole, userType)) {
    if (tenantId) {
      // Verify the tenant exists
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      // Check if this is their home tenant OR they have an explicit grant
      const isHomeTenant = req.user.tenantId === tenantId;
      const hasGrant = await storage.hasConsultantAccess(req.user.id, tenantId);
      
      if (!isHomeTenant && !hasGrant) {
        console.warn(`Consultant access denied: User ${req.user.email} does not have access to tenant ${tenantId}`);
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You do not have access to this organization. Please request access from an administrator.'
        });
      }
      
      req.effectiveTenantId = tenantId;
      req.isMultiTenantAccess = !isHomeTenant;
    } else if (!req.user.tenantId) {
      // Consultant without a home tenant and no specified tenant
      return res.status(400).json({ 
        error: 'Tenant selection required',
        message: 'Please specify a tenant using the x-tenant-id header'
      });
    } else {
      req.effectiveTenantId = req.user.tenantId;
      req.isMultiTenantAccess = false;
    }
  }
  // Multi-tenant users (vega_admin, global_admin) can access any tenant
  else if (canAccessAnyTenant(userRole)) {
    if (tenantId) {
      // Verify the tenant exists
      const tenant = await storage.getTenantById(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      req.effectiveTenantId = tenantId;
      req.isMultiTenantAccess = source === 'header';
    } else if (!req.user.tenantId) {
      // Multi-tenant user without a specified tenant - require explicit selection
      return res.status(400).json({ 
        error: 'Tenant selection required',
        message: 'Please specify a tenant using the x-tenant-id header'
      });
    } else {
      req.effectiveTenantId = req.user.tenantId;
      req.isMultiTenantAccess = false;
    }
  } else {
    // Regular client users can only access their assigned tenant
    if (!req.user.tenantId) {
      return res.status(403).json({ 
        error: 'No tenant assigned',
        message: 'Your account is not associated with an organization'
      });
    }

    // If a different tenant was specified, deny access
    if (tenantId && tenantId !== req.user.tenantId) {
      console.warn(`Cross-tenant access attempt: User ${req.user.email} tried to access tenant ${tenantId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You can only access your own organization\'s data'
      });
    }

    req.effectiveTenantId = req.user.tenantId;
    req.isMultiTenantAccess = false;
  }

  next();
}

/**
 * Middleware to require tenant admin or higher
 */
export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(
    ROLES.TENANT_ADMIN, 
    ROLES.ADMIN, 
    ROLES.GLOBAL_ADMIN, 
    ROLES.VEGA_ADMIN
  )(req, res, next);
}

/**
 * Middleware to require platform admin access
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(ROLES.VEGA_ADMIN)(req, res, next);
}

/**
 * Middleware to require consultant or higher (for consultant-specific features)
 */
export function requireConsultantOrHigher(req: Request, res: Response, next: NextFunction) {
  return requireRole(
    ROLES.VEGA_CONSULTANT,
    ROLES.GLOBAL_ADMIN, 
    ROLES.VEGA_ADMIN
  )(req, res, next);
}

/**
 * Middleware factory that denies access to consultants for specific operations
 * Use this for client-only features that consultants should not access
 */
export function denyConsultantAccess(message: string = 'This action is not available for consultants') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role as Role;
    const userType = (req.user as any).userType as string | undefined;

    if (isConsultant(userRole, userType)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message 
      });
    }

    next();
  };
}

/**
 * Combined middleware for common patterns
 */
export const rbac = {
  // Load user (required for all protected routes)
  loadUser: loadCurrentUser,
  
  // Tenant access (ensures user can access the tenant in context)
  tenantAccess: requireTenantAccess,
  
  // Role checks
  anyUser: requireRole(ROLES.TENANT_USER, ROLES.TENANT_ADMIN, ROLES.ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_CONSULTANT, ROLES.VEGA_ADMIN),
  tenantAdmin: requireTenantAdmin,
  platformAdmin: requirePlatformAdmin,
  consultantOrHigher: requireConsultantOrHigher,
  
  // Permission checks
  canManageUsers: requirePermission(PERMISSIONS.MANAGE_TENANT_USERS),
  canManageSettings: requirePermission(PERMISSIONS.MANAGE_TENANT_SETTINGS),
  canManageTenants: requirePermission(PERMISSIONS.MANAGE_ALL_TENANTS),
  canUpdateFoundations: requirePermission(PERMISSIONS.UPDATE_FOUNDATIONS),
  canImportData: requirePermission(PERMISSIONS.IMPORT_DATA),
  canManageAIGrounding: requirePermission(PERMISSIONS.MANAGE_AI_GROUNDING),
  canUseLaunchpad: requirePermission(PERMISSIONS.USE_LAUNCHPAD),
  canViewClientStrategies: requirePermission(PERMISSIONS.VIEW_CLIENT_STRATEGIES),
  canViewClientAnalytics: requirePermission(PERMISSIONS.VIEW_CLIENT_ANALYTICS),
  
  // User type checks
  denyConsultants: denyConsultantAccess,
};

/**
 * Helper to check if current user owns a resource
 */
export function isResourceOwner(req: Request, ownerEmail?: string | null): boolean {
  if (!req.user || !ownerEmail) return false;
  return req.user.email === ownerEmail;
}

/**
 * Helper to check if user can modify any OKR (not just their own)
 */
export function canModifyAnyOKR(req: Request): boolean {
  if (!req.user) return false;
  return hasPermission(req.user.role as Role, PERMISSIONS.UPDATE_ANY_OKR);
}

/**
 * Middleware to enforce read-write license for content modification operations.
 * Read-only users cannot create, update, or delete:
 * - Mission, Purpose, Values, Goals
 * - Strategies
 * - OKRs (Objectives, Key Results)
 * - Big Rocks
 * 
 * Admins are never read-only (they always have read-write access).
 */
export async function requireReadWriteLicense(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins and consultants always have read-write access
    const adminRoles = ['tenant_admin', 'admin', 'global_admin', 'vega_admin', 'vega_consultant'];
    if (adminRoles.includes(req.user.role)) {
      return next();
    }

    // Check if user has read-only license
    const isReadOnly = await storage.isUserReadOnly(req.user.id);
    
    if (isReadOnly) {
      return res.status(403).json({ 
        error: 'Read-only access',
        message: 'Your license does not permit creating or modifying content. Please contact your administrator to upgrade to a read-write license.'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking license type:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
