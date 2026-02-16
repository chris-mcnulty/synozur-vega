import { Client } from '@microsoft/microsoft-graph-client';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

const tokenCaches: Map<string, TokenCache> = new Map();

export interface PlannerCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export function clearPlannerTokenCache(): void {
  console.log('[PLANNER-AUTH] Clearing token cache');
  tokenCaches.clear();
}

async function getClientCredentialsToken(credentials: PlannerCredentials): Promise<string> {
  const cacheKey = `${credentials.tenantId}:${credentials.clientId}`;
  const cached = tokenCaches.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.accessToken;
  }

  console.log('[PLANNER-AUTH] Requesting new token for tenant:', credentials.tenantId);
  const tokenEndpoint = `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', credentials.clientId);
  params.append('client_secret', credentials.clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[PLANNER-AUTH] Token request failed:', errorText);
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[PLANNER-AUTH] Got new token, expires in:', data.expires_in, 'seconds');

  tokenCaches.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  });

  return data.access_token;
}

export function getAppCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getPlannerCredentialsForTenant(azureTenantId: string): PlannerCredentials | null {
  if (!azureTenantId) return null;

  const invalidTenantIds = ['common', 'organizations', 'consumers'];
  if (invalidTenantIds.includes(azureTenantId.toLowerCase())) {
    console.warn('[PLANNER-AUTH] Tenant ID cannot be "common" for client_credentials flow — need actual Azure tenant GUID');
    return null;
  }

  const appCreds = getAppCredentials();
  if (!appCreds) return null;

  return {
    tenantId: azureTenantId,
    clientId: appCreds.clientId,
    clientSecret: appCreds.clientSecret,
  };
}

export async function getPlannerGraphClient(azureTenantId: string): Promise<Client> {
  const creds = getPlannerCredentialsForTenant(azureTenantId);

  if (!creds) {
    throw new Error(
      `Planner integration not configured for Azure tenant "${azureTenantId}". Ensure AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are set, and the Vega tenant has an Azure Tenant ID configured.`
    );
  }

  const accessToken = await getClientCredentialsToken(creds);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
}

export function isPlannerConfigured(): boolean {
  return getAppCredentials() !== null;
}

export async function testPlannerConnection(azureTenantId: string): Promise<{ success: boolean; message?: string; error?: string; permissionIssue?: string }> {
  try {
    console.log('[PLANNER-AUTH] Testing connection for Azure tenant:', azureTenantId);
    const client = await getPlannerGraphClient(azureTenantId);

    try {
      const groupsResult = await client.api('/groups').top(1).select('id,displayName').get();
      console.log('[PLANNER-AUTH] Groups test successful, found:', groupsResult?.value?.length || 0, 'groups');
    } catch (groupsError: any) {
      console.error('[PLANNER-AUTH] Groups test failed:', groupsError.message);
      const errorMsg = groupsError.message || '';
      if (errorMsg.includes('Insufficient privileges') || errorMsg.includes('Authorization_RequestDenied')) {
        return {
          success: false,
          error: 'Group.Read.All permission not configured or not consented',
          permissionIssue: 'The Azure app needs "Group.Read.All" Application permission with admin consent in this tenant.'
        };
      }
      throw groupsError;
    }

    return { success: true, message: 'Connected to Microsoft Graph with required permissions' };
  } catch (error: any) {
    console.error('[PLANNER-AUTH] Connection test error:', error.message);
    return { success: false, error: error.message };
  }
}
