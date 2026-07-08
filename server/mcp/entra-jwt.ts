import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { storage } from '../storage';
import type { McpAuthContext } from './auth';

const MICROSOFT_JWKS_URI = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const MICROSOFT_ISSUER_PREFIXES = [
  'https://login.microsoftonline.com/',
  'https://sts.windows.net/',
];

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

function getExpectedAudiences(): string[] | null {
  const clientId = process.env.MCP_ENTRA_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  if (!clientId) return null;
  const audiences = [clientId, `api://${clientId}`];
  return audiences;
}

function getAllowedTenantIds(): string[] | null {
  const envVal = process.env.MCP_ENTRA_ALLOWED_TENANTS;
  if (!envVal) return null;
  return envVal.split(',').map(t => t.trim()).filter(Boolean);
}

const ALL_READ_SCOPES = [
  'read:okrs', 'read:big_rocks', 'read:strategies', 'read:foundations',
  'read:teams', 'read:meetings',
];

const ALL_WRITE_SCOPES = [
  'write:okrs', 'write:big_rocks',
];

const ALL_MCP_SCOPES = [...ALL_READ_SCOPES, ...ALL_WRITE_SCOPES];

// Only explicit, unambiguous MCP grant claims are honored. Broad substring
// matching (e.g. any claim containing "read") previously allowed ordinary
// Microsoft Graph/sign-in tokens to be silently upgraded into full MCP
// access. Tokens must carry one of these exact MCP-specific scope/role
// values, or one (or more) of the literal Vega MCP scope strings, to be
// granted any MCP permissions.
const MCP_READ_GRANT_CLAIMS = new Set(['mcp.read', 'mcp.read.all', 'vega.mcp.read']);
const MCP_READWRITE_GRANT_CLAIMS = new Set(['mcp.readwrite', 'mcp.readwrite.all', 'vega.mcp.readwrite']);
const VALID_MCP_SCOPE_VALUES = new Set(ALL_MCP_SCOPES);

function mapEntraScopes(claims: EntraJwtClaims): string[] {
  const scopes = new Set<string>();

  const claimValues: string[] = [];
  if (claims.scp) {
    claimValues.push(...claims.scp.split(' '));
  }
  if (claims.roles) {
    claimValues.push(...claims.roles);
  }

  for (const raw of claimValues) {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();

    // Explicit, exact MCP grant claim.
    if (MCP_READWRITE_GRANT_CLAIMS.has(lower)) {
      ALL_MCP_SCOPES.forEach(s => scopes.add(s));
      continue;
    }
    if (MCP_READ_GRANT_CLAIMS.has(lower)) {
      ALL_READ_SCOPES.forEach(s => scopes.add(s));
      continue;
    }

    // Exact literal Vega MCP scope string (e.g. "read:okrs").
    if (VALID_MCP_SCOPE_VALUES.has(trimmed)) {
      scopes.add(trimmed);
    }
  }

  // No fallback: a token without any explicit MCP scope/role claim is
  // granted zero MCP permissions rather than defaulting to broad read access.
  return [...scopes];
}

export async function validateEntraJwt(token: string): Promise<McpAuthContext | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      console.log('[Entra JWT] Token could not be decoded as JWT');
      return null;
    }

    const payload = decoded.payload as Record<string, unknown>;
    const iss = payload.iss as string | undefined;
    const aud = payload.aud as string | undefined;
    const oid = payload.oid as string | undefined;
    const tid = payload.tid as string | undefined;
    console.log(`[Entra JWT] Token decoded: iss=${iss}, aud=${aud}, oid=${oid}, tid=${tid}, alg=${decoded.header.alg}, kid=${decoded.header.kid}`);

    const isValidIssuer = iss && MICROSOFT_ISSUER_PREFIXES.some(prefix => iss.startsWith(prefix));
    if (!isValidIssuer) {
      console.log(`[Entra JWT] Issuer does not match any Microsoft prefix: ${iss}`);
      return null;
    }

    let signingKey: string;
    try {
      signingKey = await getSigningKey(decoded.header);
      console.log('[Entra JWT] Signing key retrieved successfully');
    } catch (err) {
      console.error('[Entra JWT] Failed to get signing key:', err instanceof Error ? err.message : err);
      return null;
    }

    const expectedAudiences = getExpectedAudiences();
    console.log(`[Entra JWT] Expected audiences: ${JSON.stringify(expectedAudiences)}, token aud: ${aud}`);
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
    };
    if (expectedAudiences) {
      verifyOptions.audience = expectedAudiences;
    }

    let verified: EntraJwtClaims;
    try {
      verified = jwt.verify(token, signingKey, verifyOptions) as EntraJwtClaims;
      console.log(`[Entra JWT] Token signature and claims verified successfully`);
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
    console.log(`[Entra JWT] Looking for Azure tenant ${verified.tid} in ${allTenants.length} Vega tenants. Mapped tenants: ${allTenants.filter(t => t.azureTenantId).map(t => `${t.name}=${t.azureTenantId}`).join(', ')}`);
    const vegaTenant = allTenants.find(t => t.azureTenantId === verified.tid);
    if (!vegaTenant) {
      console.error(`[Entra JWT] No Vega tenant mapped to Azure tenant ${verified.tid}`);
      return null;
    }

    console.log(`[Entra JWT] Matched Vega tenant: ${vegaTenant.name} (${vegaTenant.id})`);
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

    if (scopes.length === 0) {
      console.error(`[Entra JWT] Token for user=${user.email} (oid=${verified.oid}) has no explicit MCP scope/role grant; denying MCP access`);
      return null;
    }

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
