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
  console.log(`[Entra Status] Configured: ${isConfigured}, ClientID: ${process.env.AZURE_CLIENT_ID ? 'SET' : 'NOT SET'}, ClientSecret: ${process.env.AZURE_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
  res.json({
    configured: isConfigured,
    redirectUri: REDIRECT_URI,
  });
});

router.get('/login', async (req: Request, res: Response) => {
  const requestId = Date.now().toString(36);
  console.log(`[Entra SSO][${requestId}] Login initiated`);
  console.log(`[Entra SSO][${requestId}] Base URL: ${getBaseUrl()}`);
  console.log(`[Entra SSO][${requestId}] Redirect URI: ${REDIRECT_URI}`);
  
  try {
    const client = getMsalClient();
    if (!client) {
      console.error(`[Entra SSO][${requestId}] MSAL client not initialized - credentials missing`);
      return res.status(503).json({ error: 'Azure AD SSO is not configured' });
    }
    console.log(`[Entra SSO][${requestId}] MSAL client initialized successfully`);

    const tenantHint = req.query.tenant as string | undefined;
    console.log(`[Entra SSO][${requestId}] Tenant hint: ${tenantHint || 'none'}`);

    const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
    console.log(`[Entra SSO][${requestId}] PKCE codes generated`);

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
    console.log(`[Entra SSO][${requestId}] State parameter encoded (length: ${state.length})`);

    const authCodeUrlParams = {
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256' as const,
      state,
      prompt: 'select_account',
    };
    console.log(`[Entra SSO][${requestId}] Auth params: scopes=${SCOPES.join(',')}`);

    const authUrl = await client.getAuthCodeUrl(authCodeUrlParams);
    console.log(`[Entra SSO][${requestId}] Auth URL generated, redirecting to Microsoft`);
    res.redirect(authUrl);
  } catch (error: any) {
    console.error(`[Entra SSO][${requestId}] Login error:`, error);
    console.error(`[Entra SSO][${requestId}] Error stack:`, error?.stack);
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  const requestId = Date.now().toString(36);
  console.log(`[Entra Callback][${requestId}] Callback received`);
  console.log(`[Entra Callback][${requestId}] Query params: code=${req.query.code ? 'present' : 'missing'}, state=${req.query.state ? 'present' : 'missing'}, error=${req.query.error || 'none'}`);
  
  try {
    const client = getMsalClient();
    if (!client) {
      console.error(`[Entra Callback][${requestId}] MSAL client not available`);
      return res.redirect('/login?error=sso_not_configured');
    }

    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error(`[Entra Callback][${requestId}] Microsoft returned error: ${error}`);
      console.error(`[Entra Callback][${requestId}] Error description: ${error_description}`);
      return res.redirect(`/login?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent((error_description as string) || '')}`);
    }

    if (!code || typeof code !== 'string') {
      console.error(`[Entra Callback][${requestId}] Missing authorization code`);
      return res.redirect('/login?error=missing_auth_code');
    }

    if (!state || typeof state !== 'string') {
      console.error(`[Entra Callback][${requestId}] Missing state parameter`);
      return res.redirect('/login?error=missing_state');
    }

    console.log(`[Entra Callback][${requestId}] Authorization code received, decoding state...`);

    // Decode state parameter to get PKCE verifier (survives cross-domain redirect)
    let pkceVerifier: string;
    let tenantHint: string | null;
    try {
      const encryptedState = Buffer.from(state, 'base64url').toString();
      const decryptedState = decryptToken(encryptedState);
      const statePayload = JSON.parse(decryptedState);
      pkceVerifier = statePayload.pkceVerifier;
      tenantHint = statePayload.tenantHint;
      console.log(`[Entra Callback][${requestId}] State decoded successfully, tenantHint: ${tenantHint || 'none'}`);
    } catch (stateError: any) {
      console.error(`[Entra Callback][${requestId}] Failed to decode state:`, stateError?.message);
      return res.redirect('/login?error=invalid_state');
    }

    console.log(`[Entra Callback][${requestId}] Exchanging code for tokens...`);
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      codeVerifier: pkceVerifier,
    };

    const tokenResponse = await client.acquireTokenByCode(tokenRequest);

    if (!tokenResponse || !tokenResponse.account) {
      console.error(`[Entra Callback][${requestId}] Token acquisition failed - no response or account`);
      return res.redirect('/login?error=token_acquisition_failed');
    }

    console.log(`[Entra Callback][${requestId}] Token acquired successfully`);

    const { account, idTokenClaims } = tokenResponse;
    const email = (idTokenClaims as any)?.preferred_username || (idTokenClaims as any)?.email || account.username;
    const name = (idTokenClaims as any)?.name || account.name;
    const azureObjectId = account.localAccountId;
    const azureTenantId = account.tenantId;
    
    console.log(`[Entra Callback][${requestId}] User info: email=${email}, azureObjectId=${azureObjectId}, azureTenantId=${azureTenantId}`);
    console.log(`[Entra Callback][${requestId}] Claims: preferred_username=${(idTokenClaims as any)?.preferred_username}, email=${(idTokenClaims as any)?.email}, name=${name}`);

    if (!email) {
      console.error(`[Entra Callback][${requestId}] No email in token claims`);
      return res.redirect('/login?error=no_email_claim');
    }

    console.log(`[Entra Callback][${requestId}] Looking up user by email: ${email}`);
    let user = await storage.getUserByEmail(email);
    
    if (!user) {
      console.log(`[Entra Callback][${requestId}] User not found, attempting JIT provisioning`);
      const emailDomain = email.split('@')[1];
      console.log(`[Entra Callback][${requestId}] Email domain: ${emailDomain}, Azure tenant ID: ${azureTenantId}`);
      
      let matchingTenant = await findTenantByAzureTenantOrDomain(azureTenantId, emailDomain, email);
      let isNewTenant = false;
      let userRole: string = ROLES.TENANT_USER;
      
      if (!matchingTenant) {
        // Self-service SSO tenant creation (same pattern as password signup)
        console.log(`[Entra Callback][${requestId}] No matching Vega tenant found, creating new tenant for ${email}`);
        
        // Check if domain is blocked
        const isBlocked = await storage.isDomainBlocked(emailDomain);
        if (isBlocked) {
          console.log(`[Entra Callback][${requestId}] Domain ${emailDomain} is blocked`);
          return res.redirect('/login?error=domain_blocked&message=Signups from this domain are not allowed');
        }
        
        // Get default service plan (Trial)
        let servicePlan = await storage.getDefaultServicePlan();
        if (!servicePlan) {
          servicePlan = await storage.getServicePlanByName('trial');
        }
        
        const now = new Date();
        const expiresAt = servicePlan?.durationDays 
          ? new Date(now.getTime() + servicePlan.durationDays * 24 * 60 * 60 * 1000)
          : null;
        
        const isPublicDomain = isPublicEmailDomain(email);
        
        if (isPublicDomain) {
          // Public domain (Gmail, Yahoo, etc.): create invite-only personal tenant
          const userName = name || email.split('@')[0];
          matchingTenant = await storage.createTenant({
            name: `${userName}'s Organization`,
            allowedDomains: [], // Don't claim the public domain
            selfServiceSignup: true,
            signupCompletedAt: now,
            servicePlanId: servicePlan?.id,
            planStartedAt: now,
            planExpiresAt: expiresAt,
            planStatus: 'active',
            inviteOnly: true, // New members must be explicitly invited
            azureTenantId: null, // Don't link Azure tenant for public domains
          });
          console.log(`[Entra Callback][${requestId}] Created invite-only SSO tenant for public domain user: ${matchingTenant.id}`);
        } else {
          // Business domain: create standard tenant with domain claim and Azure tenant link
          const companyName = emailDomain.split('.')[0].charAt(0).toUpperCase() + emailDomain.split('.')[0].slice(1);
          matchingTenant = await storage.createTenant({
            name: `${companyName} (${emailDomain})`,
            allowedDomains: [emailDomain],
            selfServiceSignup: true,
            signupCompletedAt: now,
            servicePlanId: servicePlan?.id,
            planStartedAt: now,
            planExpiresAt: expiresAt,
            planStatus: 'active',
            inviteOnly: false,
            azureTenantId, // Link Azure tenant so other users from same org auto-join
          });
          console.log(`[Entra Callback][${requestId}] Created SSO tenant for business domain ${emailDomain}: ${matchingTenant.id} (linked to Azure tenant ${azureTenantId})`);
        }
        
        isNewTenant = true;
        userRole = ROLES.TENANT_ADMIN; // First user is admin
        
        // Push to HubSpot as new deal
        try {
          const { createHubSpotDeal, isHubSpotConnected } = await import('./hubspot');
          const hubspotConnected = await isHubSpotConnected();
          if (hubspotConnected) {
            console.log(`[Entra Callback][${requestId}] Creating HubSpot deal for SSO signup: ${email}`);
            await createHubSpotDeal({
              tenantName: matchingTenant.name,
              email,
              domain: emailDomain,
              planName: servicePlan?.displayName || 'Trial',
              signupDate: new Date(),
            });
          }
        } catch (hubspotError) {
          console.error(`[Entra Callback][${requestId}] Failed to create HubSpot deal:`, hubspotError);
        }
      } else {
        console.log(`[Entra Callback][${requestId}] Found matching tenant: ${matchingTenant.name} (${matchingTenant.id}), inviteOnly=${matchingTenant.inviteOnly}, azureTenantId=${matchingTenant.azureTenantId}`);
        
        // Check if tenant is invite-only - block new users from auto-joining
        if (matchingTenant.inviteOnly === true) {
          console.log(`[Entra Callback][${requestId}] BLOCKING: Tenant ${matchingTenant.name} is invite-only, denying auto-join for ${email}`);
          const tenantNameEncoded = encodeURIComponent(matchingTenant.name);
          return res.redirect(`${getBaseUrl()}/login?error=invite_only&tenant_name=${tenantNameEncoded}`);
        } else {
          console.log(`[Entra Callback][${requestId}] Tenant allows auto-join (inviteOnly=${matchingTenant.inviteOnly}), proceeding with JIT provisioning`);
        }
      }

      const newUser = await storage.createUser({
        email,
        name: name || email.split('@')[0],
        password: '',
        role: userRole,
        tenantId: matchingTenant.id,
        emailVerified: true,
        authProvider: 'entra',
        azureObjectId,
        azureTenantId,
      });
      user = newUser;
      console.log(`[Entra Callback][${requestId}] Created new user via ${isNewTenant ? 'self-service SSO' : 'JIT'}: ${email}, userId: ${user.id}, role: ${userRole}`);
    } else {
      console.log(`[Entra Callback][${requestId}] Existing user found: ${email}, userId: ${user.id}, tenantId: ${user.tenantId}`);
      if (!user.azureObjectId) {
        console.log(`[Entra Callback][${requestId}] Linking existing user to Azure AD`);
        const updatedUser = await storage.updateUser(user.id, {
          azureObjectId,
          azureTenantId,
          authProvider: 'entra',
          emailVerified: true,
        });
        if (updatedUser) {
          user = updatedUser;
        }
        console.log(`[Entra Callback][${requestId}] Linked existing user to Azure AD: ${email}`);
      }
    }

    if (user.tenantId) {
      const tenant = await storage.getTenantById(user.tenantId);
      if (tenant?.enforceSso && user.authProvider !== 'entra') {
        console.log(`[Entra Callback][${requestId}] Tenant enforces SSO, updating auth provider`);
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
        console.log(`[Entra Callback][${requestId}] Stored Graph token for user ${email}`);
      } catch (tokenError) {
        console.warn(`[Entra Callback][${requestId}] Failed to store Graph token:`, tokenError);
        // Continue - this is not critical for login
      }
    }

    console.log(`[Entra Callback][${requestId}] Creating session for user ${user.id}`);
    (req.session as any).userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error(`[Entra Callback][${requestId}] Session save error:`, err);
        return res.redirect(`${getBaseUrl()}/login?error=session_error`);
      }
      console.log(`[Entra Callback][${requestId}] Login successful, redirecting to dashboard`);
      // Redirect to dashboard after successful SSO login (absolute URL)
      res.redirect(`${getBaseUrl()}/dashboard`);
    });

  } catch (error: any) {
    console.error(`[Entra Callback][${requestId}] Callback error:`, error);
    console.error(`[Entra Callback][${requestId}] Error stack:`, error?.stack);
    res.redirect(`${getBaseUrl()}/login?error=callback_failed`);
  }
});

router.post('/logout', (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('[Entra SSO] Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    
    const postLogoutRedirect = encodeURIComponent(`${getBaseUrl()}/login`);
    const azureLogoutUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;
    
    res.json({ logoutUrl: azureLogoutUrl });
  });
});

async function findTenantByAzureTenantOrDomain(azureTenantId: string, emailDomain: string, userEmail: string) {
  const allTenants = await storage.getAllTenants();
  console.log(`[findTenant] Searching for azureTenantId=${azureTenantId}, domain=${emailDomain}, totalTenants=${allTenants.length}`);
  
  // Azure tenant ID match takes priority (SSO is explicitly configured for this org)
  const azureMatch = allTenants.find(t => t.azureTenantId === azureTenantId);
  if (azureMatch) {
    console.log(`[findTenant] Found by Azure tenant ID: ${azureMatch.name} (id=${azureMatch.id}, inviteOnly=${azureMatch.inviteOnly})`);
    return azureMatch;
  }
  console.log(`[findTenant] No Azure tenant ID match found`);
  
  // For public email domains (Gmail, Yahoo, etc.), skip domain matching
  // Users with public domains must be explicitly invited or create their own tenant
  if (isPublicEmailDomain(userEmail)) {
    console.log(`[findTenant] Skipping domain match for public email: ${userEmail}`);
    return null;
  }
  
  // Find any tenant that has this domain claimed
  const domainMatch = allTenants.find(t => {
    const domains = t.allowedDomains || [];
    return domains.includes(emailDomain.toLowerCase());
  });
  
  if (domainMatch) {
    console.log(`[findTenant] Domain match found: ${domainMatch.name} (id=${domainMatch.id}, inviteOnly=${domainMatch.inviteOnly})`);
    // Return the tenant even if it's invite-only - the caller will check inviteOnly and block if needed
    // This prevents users from creating duplicate tenants when their domain is already claimed
    return domainMatch;
  }
  
  console.log(`[findTenant] No matching tenant found`);
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
    // Use v1.0 /adminconsent endpoint (not v2.0) to grant BOTH Delegated AND Application permissions
    // The v2.0 endpoint with specific scopes only grants Delegated permissions
    // The v1.0 endpoint grants all permissions configured in the app registration (including Application permissions like User.Read.All)
    const adminConsentUrl = new URL('https://login.microsoftonline.com/organizations/adminconsent');
    adminConsentUrl.searchParams.set('client_id', process.env.AZURE_CLIENT_ID);
    adminConsentUrl.searchParams.set('redirect_uri', ADMIN_CONSENT_REDIRECT_URI);
    adminConsentUrl.searchParams.set('state', state);
    // Note: Not setting 'scope' parameter - v1.0 adminconsent grants all pre-configured permissions from app registration

    console.log('[Entra Admin Consent] Initiating admin consent for tenant:', vegaTenantId);
    console.log('[Entra Admin Consent] Using v1.0 adminconsent endpoint to include Application permissions');
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

import { searchAzureADUsers, clearEntraAppTokenCache, getEntraAppId } from './microsoftGraph';

/**
 * GET /auth/entra/users/diagnostic
 * Get diagnostic info about Entra app configuration (for admins)
 */
router.get('/users/diagnostic', async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  const adminRoles = [ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN];
  if (!adminRoles.includes(user.role as any)) {
    return res.status(403).json({ error: 'Global admin privileges required' });
  }

  const configuredAppId = getEntraAppId();
  const expectedVegaAppId = '33479c45-f21f-4911-8189-0c7a53c6a9d7';
  
  res.json({
    configuredAppId,
    expectedVegaAppId,
    isCorrectApp: configuredAppId === expectedVegaAppId,
    hasClientSecret: !!process.env.AZURE_CLIENT_SECRET,
    hasTenantId: !!process.env.AZURE_TENANT_ID,
  });
});

/**
 * POST /auth/entra/users/clear-cache
 * Clear the Entra app token cache (after granting new permissions)
 */
router.post('/users/clear-cache', async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }

  const adminRoles = [ROLES.TENANT_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN, ROLES.VEGA_CONSULTANT];
  if (!adminRoles.includes(user.role as any)) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  // Clear cache for the user's tenant's Azure tenant ID, or all if not specified
  if (user.tenantId) {
    const tenant = await storage.getTenantById(user.tenantId);
    if (tenant?.azureTenantId) {
      clearEntraAppTokenCache(tenant.azureTenantId);
    }
  }
  
  // Also clear all caches to be safe
  clearEntraAppTokenCache();
  
  res.json({ success: true, message: 'Token cache cleared. Please try searching again.' });
});

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

    // Get the tenant's Azure tenant ID from the database
    let azureTenantId: string | undefined;
    let vegaTenantName: string | undefined;
    if (user.tenantId) {
      const tenant = await storage.getTenantById(user.tenantId);
      vegaTenantName = tenant?.name;
      if (tenant?.azureTenantId) {
        azureTenantId = tenant.azureTenantId;
      }
    }
    
    // Diagnostic logging - helps identify which tenant is being targeted
    const synozurHomeTenant = 'b4fbeaf7-1c91-43bb-8031-49eb8d4175ee';
    console.log('[Entra User Search] Starting search...');
    console.log('[Entra User Search] Vega Tenant:', vegaTenantName || 'unknown');
    console.log('[Entra User Search] Target Azure Tenant ID:', azureTenantId || 'NOT SET');
    console.log('[Entra User Search] Is Synozur home tenant:', azureTenantId === synozurHomeTenant ? 'YES' : 'NO');
    if (azureTenantId && azureTenantId !== synozurHomeTenant) {
      console.log('[Entra User Search] WARNING: Targeting non-Synozur tenant - that tenant must grant admin consent separately!');
    }
    
    if (!azureTenantId) {
      return res.status(400).json({ 
        error: 'Azure Tenant ID not configured. Please set it in Tenant Admin → Microsoft 365 Integration settings.' 
      });
    }

    const users = await searchAzureADUsers(query.trim(), limit, azureTenantId);
    res.json({ users });
  } catch (error: any) {
    console.error('[Entra User Search] Error:', error.message || error);
    
    // Handle specific error cases
    if (error.message?.includes('credentials not configured')) {
      return res.status(503).json({ error: 'Azure AD integration not configured. Please ensure AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are set.' });
    }
    
    if (error.message?.includes('Tenant ID cannot be')) {
      return res.status(503).json({ 
        error: 'Invalid Azure AD tenant configuration. Please verify your Azure Tenant ID in Tenant Admin settings.' 
      });
    }
    
    if (error.message?.includes('missing_tenant_id_error') || error.message?.includes('must be specified')) {
      return res.status(503).json({ 
        error: 'Azure AD tenant ID misconfigured. Please verify the Azure Tenant ID is correctly set in Tenant Admin settings.' 
      });
    }
    
    // Handle insufficient privileges - remote tenant admin needs to grant consent
    // For multi-tenant apps using client credentials flow, the remote tenant admin must:
    // 1. Grant admin consent for the Vega app (App ID: 33479c45-f21f-4911-8189-0c7a53c6a9d7)
    // 2. Specifically grant the "User.Read.All" Application permission (not just Delegated)
    if (error.code === 'Authorization_RequestDenied' || error.message?.includes('Insufficient privileges')) {
      console.error('[Entra User Search] Authorization denied. Remote tenant admin must grant admin consent for User.Read.All APPLICATION permission.');
      console.error('[Entra User Search] Vega App ID: 33479c45-f21f-4911-8189-0c7a53c6a9d7');
      console.error('[Entra User Search] The admin consent URL should be: https://login.microsoftonline.com/{tenant-id}/adminconsent?client_id=33479c45-f21f-4911-8189-0c7a53c6a9d7');
      
      return res.status(403).json({ 
        error: 'Your organization\'s IT administrator needs to grant Vega the "User.Read.All" Application permission (not just Delegated). Please have your IT admin visit: Microsoft Entra admin center → Enterprise applications → Find "Vega" app → Permissions → Grant admin consent. The Vega App ID is: 33479c45-f21f-4911-8189-0c7a53c6a9d7',
        code: 'admin_consent_required',
        appId: '33479c45-f21f-4911-8189-0c7a53c6a9d7'
      });
    }
    
    res.status(500).json({ error: 'Failed to search Azure AD users' });
  }
});

/**
 * POST /auth/entra/users/add
 * Create or update a Vega user from Azure AD data
 * SSO users don't need a password - they authenticate through Microsoft
 * Body:
 *   - azureObjectId: Azure AD user object ID
 *   - email: User's email
 *   - displayName: User's display name
 *   - tenantId: Vega tenant ID to add user to
 *   - role: Role to assign (default: tenant_user)
 */
router.post('/users/add', async (req: Request, res: Response) => {
  try {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const adminUser = await storage.getUser(adminUserId);
    if (!adminUser) {
      return res.status(403).json({ error: 'User not found' });
    }

    // Only admins can add users from Azure AD
    const adminRoles = [ROLES.TENANT_ADMIN, ROLES.GLOBAL_ADMIN, ROLES.VEGA_ADMIN, ROLES.VEGA_CONSULTANT];
    if (!adminRoles.includes(adminUser.role as any)) {
      return res.status(403).json({ error: 'Admin privileges required to add users' });
    }

    const { azureObjectId, email, displayName, tenantId, role = 'tenant_user' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Normalize email to lowercase for consistent comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Validate tenantId exists
    const tenant = await storage.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Validate role
    const validRoles = ['tenant_user', 'tenant_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be tenant_user or tenant_admin' });
    }

    // Check if user already exists by email (case-insensitive)
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    
    if (existingUser) {
      // User exists - update their tenant association if needed
      if (existingUser.tenantId !== tenantId) {
        // Update user's tenant
        await storage.updateUser(existingUser.id, {
          tenantId,
          role,
          authProvider: 'azure',
          azureObjectId: azureObjectId || existingUser.azureObjectId,
        });
        console.log(`[Entra Add User] Updated existing user ${email} to tenant ${tenantId}`);
        
        const updatedUser = await storage.getUser(existingUser.id);
        return res.json({ 
          success: true, 
          user: updatedUser,
          message: 'User updated and added to organization'
        });
      } else {
        // User already in this tenant
        return res.json({ 
          success: true, 
          user: existingUser,
          message: 'User already exists in this organization'
        });
      }
    }

    // Create new user - SSO users don't need a password
    // Generate a random placeholder password (never used for SSO)
    const crypto = await import('crypto');
    const placeholderPassword = crypto.randomBytes(32).toString('hex');
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(placeholderPassword, 10);

    const newUser = await storage.createUser({
      email: normalizedEmail,
      password: passwordHash, // Placeholder - SSO users authenticate via Microsoft
      role,
      tenantId,
      emailVerified: true, // SSO users are verified by Microsoft
      authProvider: 'azure',
      azureObjectId: azureObjectId || null,
    });

    console.log(`[Entra Add User] Created new SSO user ${normalizedEmail} in tenant ${tenantId}`);
    
    res.json({ 
      success: true, 
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        tenantId: newUser.tenantId,
        emailVerified: newUser.emailVerified,
        authProvider: newUser.authProvider,
      },
      message: 'User created successfully. They can sign in with Microsoft.'
    });
  } catch (error: any) {
    console.error('[Entra Add User] Error:', error);
    
    // Check for duplicate email constraint violation
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return res.status(409).json({ 
        error: `A user with this email address already exists. You can find them in the Users list.`,
        code: 'duplicate_user'
      });
    }
    
    res.status(500).json({ error: 'Failed to add user from Azure AD' });
  }
});

export const entraRouter = router;
