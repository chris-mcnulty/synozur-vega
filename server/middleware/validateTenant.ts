/**
 * Tenant Validation Middleware & Helper
 * 
 * Provides server-side validation that a user can access a specific tenant.
 * Prevents spoofing of x-tenant-id header by verifying user has permission.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { ROLES, canAccessAnyTenant } from '../../shared/rbac';
import type { User } from '../../shared/schema';

type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Check if a user has access to a specific tenant
 * Returns the validated tenant ID or null if access is denied
 */
export async function validateTenantAccess(
  user: User | undefined,
  requestedTenantId: string | undefined
): Promise<{ valid: boolean; tenantId: string | null; error?: string }> {
  if (!user) {
    return { valid: false, tenantId: null, error: 'Authentication required' };
  }

  const userRole = user.role as Role;
  const userType = (user as any).userType as string | undefined;
  
  // Determine the effective tenant ID (header > user's tenant)
  const effectiveTenantId = requestedTenantId || user.tenantId;
  
  if (!effectiveTenantId) {
    return { valid: false, tenantId: null, error: 'No tenant context available' };
  }

  // Multi-tenant users (vega_admin, global_admin) can access any tenant
  if (canAccessAnyTenant(userRole)) {
    // Just verify the tenant exists
    const tenant = await storage.getTenantById(effectiveTenantId);
    if (!tenant) {
      return { valid: false, tenantId: null, error: 'Tenant not found' };
    }
    return { valid: true, tenantId: effectiveTenantId };
  }

  // Consultants need explicit grants for non-home tenants
  const isConsultant = userRole === ROLES.VEGA_CONSULTANT || userType === 'consultant';
  if (isConsultant) {
    const tenant = await storage.getTenantById(effectiveTenantId);
    if (!tenant) {
      return { valid: false, tenantId: null, error: 'Tenant not found' };
    }
    
    const isHomeTenant = user.tenantId === effectiveTenantId;
    const hasGrant = await storage.hasConsultantAccess(user.id, effectiveTenantId);
    
    if (!isHomeTenant && !hasGrant) {
      console.warn(`Consultant access denied: User ${user.email} attempted to access tenant ${effectiveTenantId}`);
      return { valid: false, tenantId: null, error: 'Access denied to this organization' };
    }
    
    return { valid: true, tenantId: effectiveTenantId };
  }

  // Regular users can only access their own tenant
  if (effectiveTenantId !== user.tenantId) {
    console.warn(`Cross-tenant access attempt: User ${user.email} tried to access tenant ${effectiveTenantId}`);
    return { valid: false, tenantId: null, error: 'Access denied to this organization' };
  }

  return { valid: true, tenantId: effectiveTenantId };
}

/**
 * Get validated tenant ID from request
 * Utility function for routes that need tenant context
 */
export async function getValidatedTenantId(
  req: Request,
  res: Response
): Promise<string | null> {
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  const user = await storage.getUser(req.session.userId!);
  
  const result = await validateTenantAccess(user || undefined, headerTenantId);
  
  if (!result.valid) {
    res.status(403).json({ error: result.error });
    return null;
  }
  
  return result.tenantId;
}

/**
 * Middleware that validates tenant access and sets req.effectiveTenantId
 * Use this on routes that need tenant context but don't use the full RBAC middleware chain
 */
export function requireValidatedTenant(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  
  storage.getUser(req.session.userId)
    .then(async (user) => {
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      const result = await validateTenantAccess(user, headerTenantId);
      
      if (!result.valid) {
        return res.status(403).json({ error: result.error });
      }
      
      req.user = user;
      req.effectiveTenantId = result.tenantId!;
      next();
    })
    .catch((error) => {
      console.error('Error validating tenant access:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
}
