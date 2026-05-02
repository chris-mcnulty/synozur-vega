// Galaxy JWT validator: RS256 + JWKS, requires both iss and aud match
// configured (or per-tenant) values. Tenant is resolved from client_id/azp.

import jwt from 'jsonwebtoken';
import jwksRsa, { JwksClient } from 'jwks-rsa';
import { storage } from '../storage';
import { assertSafeJwksUri } from './jwks-url-validator';
import type { Tenant } from '@shared/schema';

export interface GalaxyJwtClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  client_id?: string;
  azp?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

export interface GalaxyAuthContext {
  tenant: Tenant;
  galaxyUserId: string;
  galaxyClientId: string;
  email?: string;
  name?: string;
  claims: GalaxyJwtClaims;
  /**
   * If a pre-existing Vega user in the same tenant owns the email claim
   * presented by Galaxy, we capture their identity here. Ownership
   * predicates match against this identity in addition to the JIT
   * portal_user, so artifacts assigned to the real Vega user remain visible
   * after Galaxy auth without mutating the Vega user record.
   */
  linkedVegaUser?: { id: string; email: string };
}

const DEFAULT_ISSUER = process.env.GALAXY_ISSUER;
const DEFAULT_AUDIENCE = process.env.GALAXY_AUDIENCE;
const DEFAULT_JWKS_URI = process.env.GALAXY_JWKS_URI;

const jwksClientCache = new Map<string, JwksClient>();

function getJwksClient(jwksUri: string): JwksClient {
  let client = jwksClientCache.get(jwksUri);
  if (!client) {
    client = jwksRsa({
      jwksUri,
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
    jwksClientCache.set(jwksUri, client);
  }
  return client;
}

function getSigningKey(jwksUri: string, header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!header.kid) {
      return reject(new Error('No kid in JWT header'));
    }
    getJwksClient(jwksUri).getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      if (!key) return reject(new Error('No signing key found'));
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Extract the Galaxy customer/client identifier from token claims.
 * Galaxy MAY put it in `client_id` (RFC 9068) or `azp` (OIDC).
 */
function extractClientId(claims: GalaxyJwtClaims): string | null {
  return claims.client_id || claims.azp || null;
}

/**
 * Validate a Galaxy-issued bearer token. Returns auth context on success
 * or null on any validation failure. Tenant resolution is by
 * tenants.galaxyClientId — never by ambient request context.
 */
export async function validateGalaxyJwt(token: string): Promise<GalaxyAuthContext | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      console.log('[Galaxy JWT] Token could not be decoded');
      return null;
    }

    const payload = decoded.payload as Record<string, unknown>;
    const iss = payload.iss as string | undefined;
    const sub = payload.sub as string | undefined;

    if (!iss || !sub) {
      console.log('[Galaxy JWT] Missing iss or sub claim');
      return null;
    }

    // Pre-resolve tenant via the client_id claim so we can apply per-tenant overrides
    const preliminaryClientId = (payload.client_id as string) || (payload.azp as string) || null;
    let candidateTenant: Tenant | undefined;
    if (preliminaryClientId) {
      candidateTenant = await storage.getTenantByGalaxyClientId(preliminaryClientId);
    }

    const expectedIssuer = candidateTenant?.galaxySettings?.issuer || DEFAULT_ISSUER;
    const expectedAudience = candidateTenant?.galaxySettings?.audience || DEFAULT_AUDIENCE;
    const jwksUri = candidateTenant?.galaxySettings?.jwksUri || DEFAULT_JWKS_URI;

    if (!jwksUri) {
      console.error('[Galaxy JWT] No JWKS URI configured (set GALAXY_JWKS_URI or per-tenant galaxySettings.jwksUri)');
      return null;
    }
    // Defense-in-depth SSRF guard: even if a malicious jwksUri slipped past
    // the tenant PATCH validator, refuse to fetch from non-public targets.
    try {
      await assertSafeJwksUri(jwksUri);
    } catch (err) {
      console.error('[Galaxy JWT] Refusing JWKS URI:', err instanceof Error ? err.message : err);
      return null;
    }
    if (!expectedIssuer) {
      console.error('[Galaxy JWT] No expected issuer configured (set GALAXY_ISSUER)');
      return null;
    }
    if (iss !== expectedIssuer) {
      console.warn(`[Galaxy JWT] Issuer mismatch: got ${iss}, expected ${expectedIssuer}`);
      return null;
    }

    let signingKey: string;
    try {
      signingKey = await getSigningKey(jwksUri, decoded.header);
    } catch (err) {
      console.error('[Galaxy JWT] Failed to get signing key:', err instanceof Error ? err.message : err);
      return null;
    }

    if (!expectedAudience) {
      console.error('[Galaxy JWT] No expected audience configured (set GALAXY_AUDIENCE or per-tenant galaxySettings.audience). Refusing to validate token.');
      return null;
    }
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['RS256'],
      issuer: expectedIssuer,
      audience: expectedAudience,
    };

    let verified: GalaxyJwtClaims;
    try {
      verified = jwt.verify(token, signingKey, verifyOptions) as GalaxyJwtClaims;
    } catch (err) {
      console.error('[Galaxy JWT] Token verification failed:', err instanceof Error ? err.message : err);
      return null;
    }

    const galaxyClientId = extractClientId(verified);
    if (!galaxyClientId) {
      console.error('[Galaxy JWT] Token missing client_id/azp claim — cannot resolve tenant');
      return null;
    }

    // Authoritative tenant resolution AFTER signature verification.
    const tenant = await storage.getTenantByGalaxyClientId(galaxyClientId);
    if (!tenant) {
      console.warn(`[Galaxy JWT] No Vega tenant mapped to Galaxy client_id=${galaxyClientId}`);
      return null;
    }
    if (!tenant.galaxyEnabled) {
      console.warn(`[Galaxy JWT] Galaxy integration disabled for tenant ${tenant.id} (${tenant.name})`);
      return null;
    }

    return {
      tenant,
      galaxyUserId: verified.sub,
      galaxyClientId,
      email: verified.email || verified.preferred_username,
      name: verified.name,
      claims: verified,
    };
  } catch (err) {
    console.error('[Galaxy JWT] Unexpected error:', err);
    return null;
  }
}
