import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import type { McpApiKey, User, Tenant } from '@shared/schema';
import { isIpAllowed, normalizeClientIp } from './ipValidator';

function getMcpJwtSecret(): string {
  const secret = process.env.MCP_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('MCP_JWT_SECRET or SESSION_SECRET environment variable must be set');
  }
  return secret;
}
const KEY_PREFIX = 'vega_mcp_';

export interface McpTokenPayload {
  keyId: string;
  userId: string;
  tenantId: string;
  scopes: string[];
  iat: number;
  exp: number;
}

export interface McpAuthContext {
  user: User;
  tenant: Tenant;
  apiKey: McpApiKey;
  scopes: string[];
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = crypto.randomBytes(32).toString('base64url');
  const key = `${KEY_PREFIX}${randomPart}`;
  const hash = bcrypt.hashSync(key, 10);
  const prefix = `${KEY_PREFIX}${randomPart.substring(0, 8)}...`;
  return { key, hash, prefix };
}

export interface ValidateApiKeyResult {
  apiKey: McpApiKey | null;
  error?: 'invalid_key' | 'revoked' | 'expired' | 'ip_not_allowed';
}

export async function validateApiKey(providedKey: string, clientIp?: string): Promise<ValidateApiKeyResult> {
  if (!providedKey.startsWith(KEY_PREFIX)) {
    return { apiKey: null, error: 'invalid_key' };
  }

  const allKeys = await getAllActiveApiKeys();
  
  for (const apiKey of allKeys) {
    if (bcrypt.compareSync(providedKey, apiKey.keyHash)) {
      if (apiKey.status !== 'active') {
        return { apiKey: null, error: 'revoked' };
      }
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return { apiKey: null, error: 'expired' };
      }
      
      if (clientIp && apiKey.allowedIps && apiKey.allowedIps.length > 0) {
        const normalizedIp = normalizeClientIp(clientIp);
        if (!isIpAllowed(normalizedIp, apiKey.allowedIps)) {
          return { apiKey: null, error: 'ip_not_allowed' };
        }
      }
      
      await storage.updateMcpApiKeyLastUsed(apiKey.id);
      return { apiKey };
    }
  }
  
  return { apiKey: null, error: 'invalid_key' };
}

async function getAllActiveApiKeys(): Promise<McpApiKey[]> {
  const { db } = await import('../db');
  const { mcpApiKeys } = await import('@shared/schema');
  const { eq } = await import('drizzle-orm');
  
  return await db.select().from(mcpApiKeys).where(eq(mcpApiKeys.status, 'active'));
}

export function generateShortLivedToken(apiKey: McpApiKey): string {
  const payload: Omit<McpTokenPayload, 'iat' | 'exp'> = {
    keyId: apiKey.id,
    userId: apiKey.userId,
    tenantId: apiKey.tenantId,
    scopes: apiKey.scopes,
  };
  
  return jwt.sign(payload, getMcpJwtSecret(), { expiresIn: '1h' });
}

export function verifyToken(token: string): McpTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getMcpJwtSecret()) as McpTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function getAuthContext(token: string): Promise<McpAuthContext | null> {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const [apiKey, user, tenant] = await Promise.all([
    storage.getMcpApiKeyById(payload.keyId),
    storage.getUser(payload.userId),
    storage.getTenantById(payload.tenantId),
  ]);

  if (!apiKey || !user || !tenant) {
    return null;
  }

  if (apiKey.status !== 'active') {
    return null;
  }

  return {
    user,
    tenant,
    apiKey,
    scopes: payload.scopes,
  };
}

export function hasScope(context: McpAuthContext, requiredScope: string): boolean {
  return context.scopes.includes(requiredScope);
}
