import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { storage } from '../storage';
import type { McpAuthContext } from './auth';

const MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const MICROSOFT_ISSUER_PREFIX = 'https://login.microsoftonline.com/';
const MICROSOFT_ISSUER_V2_PREFIX = 'https://login.microsoftonline.com/';

const jwksClient = jwksRsa({
  jwksUri: MICROSOFT_JWKS_URI,
  cache: true,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) {
      return reject(new Error('No kid in JWT header'));
    }
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

export interface EntraJwtClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  oid: string;
  tid: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
  email?: string;
  scp?: string;
  roles?: string[];
}

function getExpectedAudience(): string | null {
  return process.env.MCP_ENTRA_CLIENT_ID || process.env.AZURE_CLIENT_ID || null;
}

function getAllowedTenantIds(): string[] | null {
  const envVal = process.env.MCP_ENTRA_ALLOWED_TENANTS;
  if (!envVal) return null;
  return envVal.split(',').map(t => t.trim()).filter(Boolean);
}

function mapEntraScopes(claims: EntraJwtClaims): string[] {
  const scopes: string[] = [];

  if (claims.scp) {
    const entraScopes = claims.scp.split(' ');
    for (const s of entraScopes) {
      const lower = s.toLowerCase();
      if (lower.includes('read')) {
        scopes.push('read:okrs', 'read:kpis', 'read:meetings', 'read:foundation', 'read:strategy');
      }
      if (lower.includes('write') || lower.includes('invoke')) {
        scopes.push('read:okrs', 'write:okrs', 'read:kpis', 'write:kpis',
          'read:meetings', 'write:meetings', 'read:foundation', 'write:foundation',
          'read:strategy', 'write:strategy');
      }
    }
  }

  if (claims.roles) {
    for (const role of claims.roles) {
      const lower = role.toLowerCase();
      if (lower.includes('read')) {
        scopes.push('read:okrs', 'read:kpis', 'read:meetings', 'read:foundation', 'read:strategy');
      }
      if (lower.includes('write') || lower.includes('invoke')) {
        scopes.push('read:okrs', 'write:okrs', 'read:kpis', 'write:kpis',
          'read:meetings', 'write:meetings', 'read:foundation', 'write:foundation',
          'read:strategy', 'write:strategy');
      }
    }
  }

  if (scopes.length === 0) {
    scopes.push('read:okrs', 'read:kpis', 'read:meetings', 'read:foundation', 'read:strategy');
  }

  return [...new Set(scopes)];
}

export async function validateEntraJwt(token: string): Promise<McpAuthContext | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      return null;
    }

    const payload = decoded.payload as Record<string, unknown>;
    const iss = payload.iss as string | undefined;
    if (!iss || !iss.startsWith(MICROSOFT_ISSUER_PREFIX)) {
      return null;
    }

    let signingKey: string;
    try {
      signingKey = await getSigningKey(decoded.header);
    } catch {
      console.error('[Entra JWT] Failed to get signing key');
      return null;
    }

    const expectedAudience = getExpectedAudience();
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
    };
    if (expectedAudience) {
      verifyOptions.audience = expectedAudience;
    }

    let verified: EntraJwtClaims;
    try {
      verified = jwt.verify(token, signingKey, verifyOptions) as EntraJwtClaims;
    } catch (err) {
      console.error('[Entra JWT] Token verification failed:', err instanceof Error ? err.message : err);
      return null;
    }

    if (!verified.oid || !verified.tid) {
      console.error('[Entra JWT] Missing oid or tid claims');
      return null;
    }

    const allowedTenants = getAllowedTenantIds();
    if (allowedTenants && !allowedTenants.includes(verified.tid)) {
      console.error(`[Entra JWT] Tenant ${verified.tid} not in allowed list`);
      return null;
    }

    const allTenants = await storage.getAllTenants();
    const vegaTenant = allTenants.find(t => t.azureTenantId === verified.tid);
    if (!vegaTenant) {
      console.error(`[Entra JWT] No Vega tenant mapped to Azure tenant ${verified.tid}`);
      return null;
    }

    let user = await storage.getUserByAzureObjectId(verified.oid, vegaTenant.id);

    if (!user) {
      const email = verified.preferred_username || verified.upn || verified.email;
      if (email) {
        user = await storage.getUserByEmail(email);
        if (user && user.tenantId === vegaTenant.id) {
          await storage.updateUser(user.id, { azureObjectId: verified.oid });
          user = await storage.getUser(user.id);
        } else {
          user = undefined;
        }
      }
    }

    if (!user) {
      console.error(`[Entra JWT] No Vega user found for oid=${verified.oid}, tid=${verified.tid}`);
      return null;
    }

    const scopes = mapEntraScopes(verified);

    console.log(`[Entra JWT] Authenticated user=${user.email} via Entra JWT (oid=${verified.oid}, tid=${verified.tid})`);

    return {
      user,
      tenant: vegaTenant,
      apiKey: null,
      scopes,
      authMethod: 'entra_jwt',
    };
  } catch (err) {
    console.error('[Entra JWT] Unexpected error:', err);
    return null;
  }
}
