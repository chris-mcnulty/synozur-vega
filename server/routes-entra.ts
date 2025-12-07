import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication, Configuration, AuthorizationCodeRequest, CryptoProvider } from '@azure/msal-node';
import { storage } from './storage';
import { ROLES } from '../shared/rbac';
import { encryptToken } from './utils/encryption';

const router = Router();

const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[MSAL] ${message}`);
        }
      },
    },
  },
};

const REDIRECT_URI = process.env.AZURE_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/auth/entra/callback`;

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

const PLANNER_SCOPES = [
  'openid',
  'profile', 
  'email',
  'User.Read',
  'Tasks.ReadWrite',
  'Group.Read.All',
  'offline_access',
];

const PLANNER_REDIRECT_URI = process.env.AZURE_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/auth/entra/planner-callback`;

const cryptoProvider = new CryptoProvider();

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication | null {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    console.warn('[Entra SSO] Azure AD credentials not configured');
    return null;
  }
  
  if (!msalClient) {
    msalClient = new ConfidentialClientApplication(MSAL_CONFIG);
  }
  return msalClient;
}

router.get('/status', (req: Request, res: Response) => {
  const isConfigured = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
  res.json({
    configured: isConfigured,
    redirectUri: REDIRECT_URI,
  });
});

router.get('/login', async (req: Request, res: Response) => {
  try {
    const client = getMsalClient();
    if (!client) {
      return res.status(503).json({ error: 'Azure AD SSO is not configured' });
    }

    const tenantHint = req.query.tenant as string | undefined;

    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

    const state = cryptoProvider.createNewGuid();
    
    (req.session as any).pkceVerifier = verifier;
    (req.session as any).authState = state;
    (req.session as any).tenantHint = tenantHint;

    const authCodeUrlParams = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256' as const,
      state,
      prompt: 'select_account',
    };

    const authUrl = await client.getAuthCodeUrl(authCodeUrlParams);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Entra SSO] Login error:', error);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const client = getMsalClient();
    if (!client) {
      return res.redirect('/auth?error=sso_not_configured');
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[Entra SSO] Auth error:', error, error_description);
      return res.redirect(`/auth?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent((error_description as string) || '')}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/auth?error=missing_auth_code');
    }

    const sessionState = (req.session as any).authState;
    if (state !== sessionState) {
      console.error('[Entra SSO] State mismatch');
      return res.redirect('/auth?error=state_mismatch');
    }

    const pkceVerifier = (req.session as any).pkceVerifier;
    const tenantHint = (req.session as any).tenantHint;

    delete (req.session as any).pkceVerifier;
    delete (req.session as any).authState;
    delete (req.session as any).tenantHint;

    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeVerifier: pkceVerifier,
    };

    const tokenResponse = await client.acquireTokenByCode(tokenRequest);

    if (!tokenResponse || !tokenResponse.account) {
      console.error('[Entra SSO] No token response');
      return res.redirect('/auth?error=token_acquisition_failed');
    }

    const { account, idTokenClaims } = tokenResponse;
    const email = (idTokenClaims as any)?.preferred_username || (idTokenClaims as any)?.email || account.username;
    const name = (idTokenClaims as any)?.name || account.name;
    const azureObjectId = account.localAccountId;
    const azureTenantId = (idTokenClaims as any)?.tid || account.tenantId;

    if (!email) {
      console.error('[Entra SSO] No email in token claims');
      return res.redirect('/auth?error=no_email_claim');
    }

    let user = await storage.getUserByEmail(email);
    
    if (!user) {
      const emailDomain = email.split('@')[1];
      const matchingTenant = await findTenantByAzureTenantOrDomain(azureTenantId, emailDomain);
      
      if (!matchingTenant) {
        console.log(`[Entra SSO] No matching tenant for user ${email}`);
        return res.redirect('/auth?error=no_tenant_access&message=Your organization is not registered in Vega');
      }

      const newUser = await storage.createUser({
        email,
        name: name || email.split('@')[0],
        password: '',
        role: ROLES.TENANT_USER,
        tenantId: matchingTenant.id,
        emailVerified: true,
        authProvider: 'entra',
        azureObjectId,
        azureTenantId,
      });
      user = newUser;
      console.log(`[Entra SSO] Created new user via JIT: ${email}`);
    } else {
      if (!user.azureObjectId) {
        const updatedUser = await storage.updateUser(user.id, {
          azureObjectId,
          azureTenantId,
          authProvider: 'entra',
          emailVerified: true,
        });
        if (updatedUser) {
          user = updatedUser;
        }
        console.log(`[Entra SSO] Linked existing user to Azure AD: ${email}`);
      }
    }

    if (user.tenantId) {
      const tenant = await storage.getTenantById(user.tenantId);
      if (tenant?.enforceSso && user.authProvider !== 'entra') {
        const updatedUser = await storage.updateUser(user.id, { authProvider: 'entra' });
        if (updatedUser) {
          user = updatedUser;
        }
      }
    }

    (req.session as any).userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error('[Entra SSO] Session save error:', err);
        return res.redirect('/auth?error=session_error');
      }
      res.redirect('/');
    });

  } catch (error) {
    console.error('[Entra SSO] Callback error:', error);
    res.redirect('/auth?error=callback_failed');
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('[Entra SSO] Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    const postLogoutRedirect = encodeURIComponent(`${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/auth`);
    const azureLogoutUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;
    
    res.json({ logoutUrl: azureLogoutUrl });
  });
});

async function findTenantByAzureTenantOrDomain(azureTenantId: string, emailDomain: string) {
  const allTenants = await storage.getAllTenants();
  
  const azureMatch = allTenants.find(t => t.azureTenantId === azureTenantId);
  if (azureMatch) return azureMatch;
  
  const domainMatch = allTenants.find(t => {
    const domains = t.allowedDomains || [];
    return domains.includes(emailDomain.toLowerCase());
  });
  if (domainMatch) return domainMatch;
  
  return null;
}

router.get('/tenant-config/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const tenant = await storage.getTenantById(tenantId);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({
      ssoEnabled: !!tenant.azureTenantId,
      enforceSso: tenant.enforceSso,
      allowLocalAuth: tenant.allowLocalAuth,
      azureTenantId: tenant.azureTenantId,
    });
  } catch (error) {
    console.error('[Entra SSO] Tenant config error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant SSO config' });
  }
});

router.get('/planner/connect', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = getMsalClient();
    if (!client) {
      return res.status(503).json({ error: 'Azure AD SSO is not configured' });
    }

    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
    const state = cryptoProvider.createNewGuid();
    
    (req.session as any).pkceVerifier = verifier;
    (req.session as any).authState = state;
    (req.session as any).plannerConnect = true;

    const authCodeUrlParams = {
      scopes: PLANNER_SCOPES,
      redirectUri: PLANNER_REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256' as const,
      state,
      prompt: 'consent',
    };

    const authUrl = await client.getAuthCodeUrl(authCodeUrlParams);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Entra Planner] Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Planner connection' });
  }
});

router.get('/planner-callback', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.redirect('/settings?error=not_authenticated');
    }

    const client = getMsalClient();
    if (!client) {
      return res.redirect('/settings?error=sso_not_configured');
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('[Entra Planner] Auth error:', error, error_description);
      return res.redirect(`/settings?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/settings?error=missing_auth_code');
    }

    const sessionState = (req.session as any).authState;
    if (state !== sessionState) {
      console.error('[Entra Planner] State mismatch');
      return res.redirect('/settings?error=state_mismatch');
    }

    const pkceVerifier = (req.session as any).pkceVerifier;
    if (!pkceVerifier) {
      return res.redirect('/settings?error=missing_pkce');
    }

    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: PLANNER_SCOPES,
      redirectUri: PLANNER_REDIRECT_URI,
      codeVerifier: pkceVerifier,
    };

    const tokenResponse = await client.acquireTokenByCode(tokenRequest);

    if (!tokenResponse) {
      return res.redirect('/settings?error=token_failed');
    }

    const user = await storage.getUser(userId);
    if (!user || !user.tenantId) {
      return res.redirect('/settings?error=user_not_found');
    }

    const refreshToken = (tokenResponse as any).refreshToken || null;
    
    await storage.upsertGraphToken({
      userId,
      tenantId: user.tenantId,
      accessToken: encryptToken(tokenResponse.accessToken),
      refreshToken: refreshToken ? encryptToken(refreshToken) : null,
      expiresAt: tokenResponse.expiresOn ? new Date(tokenResponse.expiresOn) : null,
      scopes: PLANNER_SCOPES,
    });

    delete (req.session as any).pkceVerifier;
    delete (req.session as any).authState;
    delete (req.session as any).plannerConnect;

    console.log(`[Entra Planner] Connected for user ${userId}`);
    res.redirect('/settings?planner=connected');

  } catch (error) {
    console.error('[Entra Planner] Callback error:', error);
    res.redirect('/settings?error=callback_failed');
  }
});

router.get('/planner/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = await storage.getGraphToken(userId);
    const isConfigured = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
    
    res.json({
      configured: isConfigured,
      connected: !!token,
      expiresAt: token?.expiresAt,
      scopes: token?.scopes || [],
    });
  } catch (error) {
    console.error('[Entra Planner] Status error:', error);
    res.status(500).json({ error: 'Failed to get Planner status' });
  }
});

router.post('/planner/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await storage.deleteGraphToken(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Entra Planner] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Planner' });
  }
});

export const entraRouter = router;
