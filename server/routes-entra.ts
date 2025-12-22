import { Router, Request, Response } from 'express';
import { ConfidentialClientApplication, Configuration, AuthorizationCodeRequest, CryptoProvider } from '@azure/msal-node';
import { storage } from './storage';
import { ROLES } from '../shared/rbac';
import { encryptToken, decryptToken } from './utils/encryption';
import { isPublicEmailDomain } from '../shared/publicDomains';

const router = Router();

// Use 'common' authority for multi-tenant app to accept users from any Azure AD tenant
// The AZURE_TENANT_ID is only used as a reference for admin operations, not to restrict logins
const MSAL_CONFIG: Configuration = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/common',
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

// Base URL for redirects - use AZURE_BASE_URL if set, otherwise detect from environment
const getBaseUrl = () => {
  if (process.env.AZURE_BASE_URL) {
    return process.env.AZURE_BASE_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
};

const REDIRECT_URI = `${getBaseUrl()}/auth/entra/callback`;

// Include SharePoint/Files scopes for Excel binding feature
const SCOPES = [
  'openid', 
  'profile', 
  'email', 
  'User.Read',
  'Files.Read.All',      // Read files from OneDrive and SharePoint
  'Sites.Read.All',      // Read SharePoint sites
  'offline_access',      // Get refresh token
];

const PLANNER_SCOPES = [
  'openid',
  'profile', 
  'email',
  'User.Read',
  'Tasks.ReadWrite',
  'Group.Read.All',
  'offline_access',
];

const OUTLOOK_SCOPES = [
  'openid',
  'profile', 
  'email',
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'offline_access',
];

const PLANNER_REDIRECT_URI = `${getBaseUrl()}/auth/entra/planner-callback`;
const OUTLOOK_REDIRECT_URI = `${getBaseUrl()}/auth/entra/outlook-callback`;
const ADMIN_CONSENT_REDIRECT_URI = `${getBaseUrl()}/auth/entra/admin-consent-callback`;

// All scopes needed for Vega platform (including Copilot agent)
const ALL_SCOPES = [
  // Basic user profile
  'openid',
  'profile',
  'email',
  'User.Read',
  'User.Read.All',        // Read all users in org (for Copilot agent)
  // Files and SharePoint
  'Files.Read.All',
  'Sites.Read.All',
  // Planner (Note: Tasks.Read.All and Tasks.ReadWrite.All don't exist - use without .All suffix)
  'Tasks.Read',
  'Tasks.ReadWrite',
  'Group.Read.All',
  // Calendar and Mail
  'Calendars.Read',
  'Calendars.ReadWrite',
  'Mail.Read',
  'Mail.Send',
  // Offline access
  'offline_access',
];

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

    // Encode PKCE verifier and tenant hint in state to survive cross-domain redirect
    // This is necessary when login starts on dev domain but callback goes to production domain
    const statePayload = JSON.stringify({
      nonce: cryptoProvider.createNewGuid(),
      pkceVerifier: verifier,
      tenantHint: tenantHint || null,
    });
    const encryptedState = encryptToken(statePayload);
    
    // URL-safe base64 encoding for state parameter
    const state = Buffer.from(encryptedState).toString('base64url');

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

    if (!state || typeof state !== 'string') {
      console.error('[Entra SSO] Missing state parameter');
      return res.redirect('/auth?error=missing_state');
    }

    // Decode state parameter to get PKCE verifier (survives cross-domain redirect)
    let pkceVerifier: string;
    let tenantHint: string | null;
    try {
      const encryptedState = Buffer.from(state, 'base64url').toString();
      const decryptedState = decryptToken(encryptedState);
      const statePayload = JSON.parse(decryptedState);
      pkceVerifier = statePayload.pkceVerifier;
      tenantHint = statePayload.tenantHint;
    } catch (stateError) {
      console.error('[Entra SSO] Failed to decode state:', stateError);
      return res.redirect('/auth?error=invalid_state');
    }

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
      const matchingTenant = await findTenantByAzureTenantOrDomain(azureTenantId, emailDomain, email);
      
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

    // Store the Graph token for SharePoint/OneDrive access
    // Use the user's Vega tenant ID (not Azure tenant ID) for the foreign key
    if (tokenResponse.accessToken && user.tenantId) {
      try {
        await storage.upsertGraphToken({
          userId: user.id,
          tenantId: user.tenantId, // Vega tenant ID, not Azure tenant ID
          accessToken: encryptToken(tokenResponse.accessToken),
          refreshToken: (tokenResponse as any).refreshToken ? encryptToken((tokenResponse as any).refreshToken) : null,
          expiresAt: tokenResponse.expiresOn || null,
          scopes: SCOPES,
        });
        console.log(`[Entra SSO] Stored Graph token for user ${email}`);
      } catch (tokenError) {
        console.warn('[Entra SSO] Failed to store Graph token:', tokenError);
        // Continue - this is not critical for login
      }
    }

    (req.session as any).userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error('[Entra SSO] Session save error:', err);
        return res.redirect(`${getBaseUrl()}/auth?error=session_error`);
      }
      // Redirect to dashboard after successful SSO login (absolute URL)
      res.redirect(`${getBaseUrl()}/dashboard`);
    });

  } catch (error) {
    console.error('[Entra SSO] Callback error:', error);
    res.redirect(`${getBaseUrl()}/auth?error=callback_failed`);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('[Entra SSO] Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    const postLogoutRedirect = encodeURIComponent(`${getBaseUrl()}/auth`);
    const azureLogoutUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;
    
    res.json({ logoutUrl: azureLogoutUrl });
  });
});

async function findTenantByAzureTenantOrDomain(azureTenantId: string, emailDomain: string, userEmail: string) {
  const allTenants = await storage.getAllTenants();
  
  // Azure tenant ID match takes priority (SSO is explicitly configured for this org)
  const azureMatch = allTenants.find(t => t.azureTenantId === azureTenantId);
  if (azureMatch) return azureMatch;
  
  // For public email domains (Gmail, Yahoo, etc.), skip domain matching
  // Users with public domains must be explicitly invited or create their own tenant
  if (isPublicEmailDomain(userEmail)) {
    console.log(`[Entra SSO] Skipping domain match for public email: ${userEmail}`);
    return null;
  }
  
  // Domain match only works for non-invite-only tenants
  const domainMatch = allTenants.find(t => {
    // Skip invite-only tenants for domain-based auto-join
    if (t.inviteOnly) return false;
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

// Check SSO policy by email domain - used by login page to enforce SSO
router.post('/check-policy', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email.toLowerCase());
    
    // Find tenant by email domain or existing user's tenant
    let tenant = null;
    if (existingUser?.tenantId) {
      tenant = await storage.getTenantById(existingUser.tenantId);
    }
    
    // If no user found, try to find tenant by allowed domain
    if (!tenant) {
      const allTenants = await storage.getAllTenants();
      tenant = allTenants.find(t => {
        const domains = t.allowedDomains || [];
        return domains.includes(emailDomain);
      }) || null;
    }
    
    // If still no tenant, check if any tenant has this Azure tenant configured
    if (!tenant) {
      const allTenants = await storage.getAllTenants();
      // Can't determine Azure tenant from email alone, so just return unknown
      res.json({
        tenantFound: false,
        ssoEnabled: false,
        enforceSso: false,
        allowLocalAuth: true,
        message: 'Email domain not registered with any organization',
      });
      return;
    }
    
    const ssoEnabled = !!tenant.azureTenantId;
    const enforceSso = tenant.enforceSso ?? false;
    const allowLocalAuth = tenant.allowLocalAuth !== false;
    
    // Determine if SSO is required for this user
    const ssoRequired = ssoEnabled && enforceSso && !allowLocalAuth;
    
    res.json({
      tenantFound: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      ssoEnabled,
      enforceSso,
      allowLocalAuth,
      ssoRequired,
      existingUser: !!existingUser,
      authProvider: existingUser?.authProvider || null,
    });
  } catch (error) {
    console.error('[Entra SSO] Check policy error:', error);
    res.status(500).json({ error: 'Failed to check SSO policy' });
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
      service: 'planner',
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

    const token = await storage.getGraphToken(userId, 'planner');
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

    await storage.deleteGraphToken(userId, 'planner');
    res.json({ success: true });
  } catch (error) {
    console.error('[Entra Planner] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Planner' });
  }
});

// ==================== Outlook Calendar OAuth Flow ====================

router.get('/outlook/connect', async (req: Request, res: Response) => {
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
    (req.session as any).outlookConnect = true;

    const authCodeUrlParams = {
      scopes: OUTLOOK_SCOPES,
      redirectUri: OUTLOOK_REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256' as const,
      state,
      prompt: 'consent',
    };

    const authUrl = await client.getAuthCodeUrl(authCodeUrlParams);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Entra Outlook] Connect error:', error);
    res.status(500).json({ error: 'Failed to initiate Outlook connection' });
  }
});

router.get('/outlook-callback', async (req: Request, res: Response) => {
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
      console.error('[Entra Outlook] Auth error:', error, error_description);
      return res.redirect(`/settings?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/settings?error=missing_auth_code');
    }

    const sessionState = (req.session as any).authState;
    if (state !== sessionState) {
      console.error('[Entra Outlook] State mismatch');
      return res.redirect('/settings?error=state_mismatch');
    }

    const pkceVerifier = (req.session as any).pkceVerifier;
    if (!pkceVerifier) {
      return res.redirect('/settings?error=missing_pkce');
    }

    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: OUTLOOK_SCOPES,
      redirectUri: OUTLOOK_REDIRECT_URI,
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
      scopes: OUTLOOK_SCOPES,
      service: 'outlook',
    });

    delete (req.session as any).pkceVerifier;
    delete (req.session as any).authState;
    delete (req.session as any).outlookConnect;

    console.log(`[Entra Outlook] Connected for user ${userId}`);
    res.redirect('/settings?outlook=connected');

  } catch (error) {
    console.error('[Entra Outlook] Callback error:', error);
    res.redirect('/settings?error=callback_failed');
  }
});

router.get('/outlook/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = await storage.getGraphToken(userId, 'outlook');
    const isConfigured = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
    
    res.json({
      configured: isConfigured,
      connected: !!token,
      expiresAt: token?.expiresAt,
      scopes: token?.scopes || [],
    });
  } catch (error) {
    console.error('[Entra Outlook] Status error:', error);
    res.status(500).json({ error: 'Failed to get Outlook status' });
  }
});

router.post('/outlook/disconnect', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await storage.deleteGraphToken(userId, 'outlook');
    res.json({ success: true });
  } catch (error) {
    console.error('[Entra Outlook] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Outlook' });
  }
});

// ==================== Admin Consent Flow ====================
// For multi-tenant apps, tenant admins must grant consent for the org

/**
 * GET /auth/entra/admin-consent
 * Initiates admin consent flow - redirects admin to Microsoft consent page
 * Query params:
 *   - tenantId: The Vega tenant ID to associate consent with
 */
router.get('/admin-consent', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user is a tenant admin or higher
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const adminRoles = [ROLES.TENANT_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN, ROLES.VEGA_CONSULTANT];
    if (!adminRoles.includes(user.role as any)) {
      return res.status(403).json({ error: 'Admin privileges required to grant org-wide consent' });
    }

    const vegaTenantId = req.query.tenantId as string || user.tenantId;
    if (!vegaTenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    // Verify tenant exists
    const tenant = await storage.getTenantById(vegaTenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!process.env.AZURE_CLIENT_ID) {
      return res.status(503).json({ error: 'Azure AD SSO is not configured' });
    }

    // Build state to pass through the consent flow
    const statePayload = JSON.stringify({
      nonce: cryptoProvider.createNewGuid(),
      vegaTenantId,
      userId,
    });
    const encryptedState = encryptToken(statePayload);
    const state = Buffer.from(encryptedState).toString('base64url');

    // Build admin consent URL
    // For multi-tenant apps, we use /adminconsent endpoint
    const adminConsentUrl = new URL('https://login.microsoftonline.com/organizations/v2.0/adminconsent');
    adminConsentUrl.searchParams.set('client_id', process.env.AZURE_CLIENT_ID);
    adminConsentUrl.searchParams.set('redirect_uri', ADMIN_CONSENT_REDIRECT_URI);
    adminConsentUrl.searchParams.set('scope', ALL_SCOPES.join(' '));
    adminConsentUrl.searchParams.set('state', state);

    console.log('[Entra Admin Consent] Initiating admin consent for tenant:', vegaTenantId);
    res.redirect(adminConsentUrl.toString());
  } catch (error) {
    console.error('[Entra Admin Consent] Error initiating consent:', error);
    res.status(500).json({ error: 'Failed to initiate admin consent' });
  }
});

/**
 * GET /auth/entra/admin-consent-callback
 * Handles callback after admin grants (or denies) consent
 */
router.get('/admin-consent-callback', async (req: Request, res: Response) => {
  try {
    const { admin_consent, state, error, error_description, tenant: azureTenantId } = req.query;

    // Decode state to get original context
    let vegaTenantId: string;
    let userId: string;
    
    if (!state || typeof state !== 'string') {
      console.error('[Entra Admin Consent] Missing state parameter');
      return res.redirect('/tenant-admin?error=missing_state');
    }

    try {
      const encryptedState = Buffer.from(state, 'base64url').toString();
      const decryptedState = decryptToken(encryptedState);
      const statePayload = JSON.parse(decryptedState);
      vegaTenantId = statePayload.vegaTenantId;
      userId = statePayload.userId;
    } catch (stateError) {
      console.error('[Entra Admin Consent] Failed to decode state:', stateError);
      return res.redirect('/tenant-admin?error=invalid_state');
    }

    // Check for errors
    if (error) {
      console.error('[Entra Admin Consent] Consent error:', error, error_description);
      
      // Provide user-friendly error messages
      let userMessage = 'consent_denied';
      if (error === 'access_denied') {
        userMessage = 'consent_denied';
      } else if (error === 'consent_required') {
        userMessage = 'consent_required';
      }
      
      return res.redirect(`/tenant-admin?error=${userMessage}&tenantId=${vegaTenantId}`);
    }

    // Verify consent was granted
    if (admin_consent !== 'True') {
      console.error('[Entra Admin Consent] Consent not granted');
      return res.redirect(`/tenant-admin?error=consent_not_granted&tenantId=${vegaTenantId}`);
    }

    // Update tenant with admin consent status
    const tenant = await storage.getTenantById(vegaTenantId);
    if (!tenant) {
      return res.redirect('/tenant-admin?error=tenant_not_found');
    }

    // Update tenant record
    await storage.updateTenant(vegaTenantId, {
      adminConsentGranted: true,
      adminConsentGrantedAt: new Date(),
      adminConsentGrantedBy: userId,
      // If Azure tenant ID was provided in callback, store it
      azureTenantId: (azureTenantId as string) || tenant.azureTenantId,
    });

    console.log(`[Entra Admin Consent] Admin consent granted for Vega tenant ${vegaTenantId} (Azure tenant: ${azureTenantId})`);
    
    // Redirect back to tenant admin with success
    res.redirect(`/tenant-admin?consent=granted&tenantId=${vegaTenantId}`);

  } catch (error) {
    console.error('[Entra Admin Consent] Callback error:', error);
    res.redirect('/tenant-admin?error=callback_failed');
  }
});

/**
 * GET /auth/entra/admin-consent/status
 * Check if admin consent has been granted for a tenant
 */
router.get('/admin-consent/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const vegaTenantId = req.query.tenantId as string || user.tenantId;
    if (!vegaTenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const tenant = await storage.getTenantById(vegaTenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      tenantId: vegaTenantId,
      tenantName: tenant.name,
      adminConsentGranted: tenant.adminConsentGranted || false,
      adminConsentGrantedAt: tenant.adminConsentGrantedAt,
      azureTenantId: tenant.azureTenantId,
      requiredScopes: ALL_SCOPES,
    });
  } catch (error) {
    console.error('[Entra Admin Consent] Status error:', error);
    res.status(500).json({ error: 'Failed to get admin consent status' });
  }
});

/**
 * POST /auth/entra/admin-consent/revoke
 * Revoke admin consent record (doesn't revoke in Azure, just clears local record)
 */
router.post('/admin-consent/revoke', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Only admins can revoke consent
    const adminRoles = [ROLES.TENANT_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN];
    if (!adminRoles.includes(user.role as any)) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const vegaTenantId = req.body.tenantId || user.tenantId;
    if (!vegaTenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    await storage.updateTenant(vegaTenantId, {
      adminConsentGranted: false,
      adminConsentGrantedAt: null,
      adminConsentGrantedBy: null,
    });

    console.log(`[Entra Admin Consent] Admin consent revoked for tenant ${vegaTenantId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Entra Admin Consent] Revoke error:', error);
    res.status(500).json({ error: 'Failed to revoke admin consent' });
  }
});

// ==================== Azure AD User Search ====================

import { searchAzureADUsers } from './microsoftGraph';

/**
 * GET /auth/entra/users/search
 * Search for users in Azure AD
 * Query params:
 *   - q: Search query (searches displayName, mail, userPrincipalName)
 *   - limit: Max results (default 10)
 */
router.get('/users/search', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Only admins can search Azure AD users
    const adminRoles = [ROLES.TENANT_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN, ROLES.VEGA_CONSULTANT];
    if (!adminRoles.includes(user.role as any)) {
      return res.status(403).json({ error: 'Admin privileges required to search Azure AD users' });
    }

    const query = req.query.q as string;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const users = await searchAzureADUsers(query.trim(), limit);
    res.json({ users });
  } catch (error: any) {
    console.error('[Entra User Search] Error:', error);
    
    // Handle specific error cases
    if (error.message?.includes('credentials not configured')) {
      return res.status(503).json({ error: 'Azure AD integration not configured' });
    }
    
    res.status(500).json({ error: 'Failed to search Azure AD users' });
  }
});

export const entraRouter = router;
