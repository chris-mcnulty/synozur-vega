import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { MCP_SCOPES } from '@shared/schema';

const router = Router();

function getOAuthJwtSecret(): string {
  const secret = process.env.MCP_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('MCP_JWT_SECRET or SESSION_SECRET environment variable must be set');
  }
  return secret;
}

function getBaseUrl(): string {
  if (process.env.AZURE_BASE_URL) return process.env.AZURE_BASE_URL;
  if (process.env.REPLIT_DEPLOYMENT_URL) return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return 'http://localhost:5000';
}

export interface OAuthAccessTokenPayload {
  sub: string;
  tenantId: string;
  clientId: string;
  scopes: string[];
  type: 'oauth_access';
  iat: number;
  exp: number;
}

function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function verifyCodeChallenge(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'S256') {
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
  if (method === 'plain') {
    return codeVerifier === codeChallenge;
  }
  return false;
}

export function generateOAuthClientCredentials(): { clientId: string; clientSecret: string; clientSecretHash: string } {
  const clientId = `vega_oauth_${crypto.randomBytes(16).toString('hex')}`;
  const clientSecret = `vega_secret_${crypto.randomBytes(32).toString('base64url')}`;
  const clientSecretHash = bcrypt.hashSync(clientSecret, 10);
  return { clientId, clientSecret, clientSecretHash };
}

router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const { 
      client_id, 
      redirect_uri, 
      response_type, 
      scope, 
      state, 
      code_challenge, 
      code_challenge_method 
    } = req.query as Record<string, string>;

    if (response_type !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only authorization_code grant is supported' });
    }

    if (!client_id || !redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'client_id and redirect_uri are required' });
    }

    const client = await storage.getOauthClientByClientId(client_id);
    if (!client || client.status !== 'active') {
      return res.status(400).json({ error: 'invalid_client', error_description: 'Unknown or inactive client' });
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid redirect_uri' });
    }

    const user = (req.session as any)?.user;
    if (!user) {
      const loginUrl = `/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`;
      return res.redirect(loginUrl);
    }

    const requestedScopes = scope ? scope.split(' ') : client.scopes;
    const allowedScopes = requestedScopes.filter(s => client.scopes.includes(s));

    const code = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storage.createOauthAuthorizationCode({
      code,
      clientId: client_id,
      userId: user.id,
      tenantId: user.tenantId,
      redirectUri: redirect_uri,
      scopes: allowedScopes,
      codeChallenge: code_challenge || null,
      codeChallengeMethod: code_challenge_method || null,
      expiresAt,
      used: false,
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('[OAuth] Authorization error:', error);
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

router.post('/token', async (req: Request, res: Response) => {
  try {
    const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      if (!code || !redirect_uri || !client_id) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'code, redirect_uri, and client_id are required' });
      }

      const client = await storage.getOauthClientByClientId(client_id);
      if (!client || client.status !== 'active') {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown or inactive client' });
      }

      if (client_secret) {
        if (!bcrypt.compareSync(client_secret, client.clientSecretHash)) {
          return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
        }
      }

      const authCode = await storage.getOauthAuthorizationCode(code);
      if (!authCode) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
      }

      if (authCode.used) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
      }

      if (new Date() > authCode.expiresAt) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
      }

      if (authCode.clientId !== client_id) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Client mismatch' });
      }

      if (authCode.redirectUri !== redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' });
      }

      if (authCode.codeChallenge && authCode.codeChallengeMethod) {
        if (!code_verifier) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required for PKCE' });
        }
        if (!verifyCodeChallenge(code_verifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
        }
      }

      await storage.markOauthAuthorizationCodeUsed(authCode.id);

      const accessToken = jwt.sign(
        {
          sub: authCode.userId,
          tenantId: authCode.tenantId,
          clientId: authCode.clientId,
          scopes: authCode.scopes,
          type: 'oauth_access',
        } as Omit<OAuthAccessTokenPayload, 'iat' | 'exp'>,
        getOAuthJwtSecret(),
        { expiresIn: '1h' }
      );

      const newRefreshToken = generateRefreshToken();
      await storage.createOauthRefreshToken({
        token: newRefreshToken,
        clientId: authCode.clientId,
        userId: authCode.userId,
        tenantId: authCode.tenantId,
        scopes: authCode.scopes,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revoked: false,
      });

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
        scope: authCode.scopes.join(' '),
      });
    }

    if (grant_type === 'refresh_token') {
      if (!refresh_token || !client_id) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token and client_id are required' });
      }

      const client = await storage.getOauthClientByClientId(client_id);
      if (!client || client.status !== 'active') {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown or inactive client' });
      }

      if (client_secret) {
        if (!bcrypt.compareSync(client_secret, client.clientSecretHash)) {
          return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
        }
      }

      const storedToken = await storage.getOauthRefreshToken(refresh_token);
      if (!storedToken || storedToken.revoked) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or revoked refresh token' });
      }

      if (new Date() > storedToken.expiresAt) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired' });
      }

      if (storedToken.clientId !== client_id) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Client mismatch' });
      }

      await storage.revokeOauthRefreshToken(storedToken.id);

      const accessToken = jwt.sign(
        {
          sub: storedToken.userId,
          tenantId: storedToken.tenantId,
          clientId: storedToken.clientId,
          scopes: storedToken.scopes,
          type: 'oauth_access',
        } as Omit<OAuthAccessTokenPayload, 'iat' | 'exp'>,
        getOAuthJwtSecret(),
        { expiresIn: '1h' }
      );

      const newRefreshToken = generateRefreshToken();
      await storage.createOauthRefreshToken({
        token: newRefreshToken,
        clientId: storedToken.clientId,
        userId: storedToken.userId,
        tenantId: storedToken.tenantId,
        scopes: storedToken.scopes,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        revoked: false,
      });

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
        scope: storedToken.scopes.join(' '),
      });
    }

    return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Supported grant types: authorization_code, refresh_token' });
  } catch (error) {
    console.error('[OAuth] Token error:', error);
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

router.get('/.well-known/openid-configuration', (_req: Request, res: Response) => {
  const baseUrl = getBaseUrl();
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    jwks_uri: `${baseUrl}/oauth/jwks`,
    scopes_supported: Object.values(MCP_SCOPES),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    code_challenge_methods_supported: ['S256', 'plain'],
  });
});

router.get('/jwks', (_req: Request, res: Response) => {
  res.json({ keys: [] });
});

export const oauthRouter = router;

export function verifyOAuthAccessToken(token: string): OAuthAccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getOAuthJwtSecret()) as OAuthAccessTokenPayload;
    if (decoded.type !== 'oauth_access') return null;
    return decoded;
  } catch {
    return null;
  }
}
