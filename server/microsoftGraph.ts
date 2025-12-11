import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';

// Cached connection settings per connector type (Replit connectors)
let outlookConnectionSettings: any;
let oneDriveConnectionSettings: any;
let sharePointConnectionSettings: any;

// Cached token for Entra app confidential client
let entraAppToken: { token: string; expiresAt: number } | null = null;

type ConnectorType = 'outlook' | 'onedrive' | 'sharepoint';

// ==================== Entra App Confidential Client ====================
// Uses the user's own Azure Entra app registration with proper SharePoint permissions

function hasEntraAppCredentials(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_TENANT_ID
  );
}

async function getEntraAppAccessToken(): Promise<string> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Entra app credentials not configured (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)');
  }

  // Check if cached token is still valid (with 5 min buffer)
  if (entraAppToken && entraAppToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return entraAppToken.token;
  }

  console.log('[EntraApp] Acquiring new token via client credentials flow...');
  
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  
  // Request token for Microsoft Graph API
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  
  if (!tokenResponse || !tokenResponse.token) {
    throw new Error('Failed to acquire token from Entra app');
  }

  // Cache the token
  entraAppToken = {
    token: tokenResponse.token,
    expiresAt: tokenResponse.expiresOnTimestamp || (Date.now() + 3600 * 1000), // Default 1 hour
  };

  console.log('[EntraApp] Token acquired successfully');
  return entraAppToken.token;
}

async function getEntraAppGraphClient(): Promise<Client> {
  const accessToken = await getEntraAppAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

export async function checkEntraAppConnection(): Promise<boolean> {
  if (!hasEntraAppCredentials()) {
    return false;
  }
  
  try {
    await getEntraAppAccessToken();
    return true;
  } catch (error) {
    console.error('[EntraApp] Connection check failed:', error);
    return false;
  }
}

// ==================== User Delegated Token Client ====================
// Uses the user's SSO token stored in graphTokens table

import { storage } from './storage';
import { decryptToken, isEncrypted } from './utils/encryption';

async function getUserGraphToken(userId: string): Promise<string | null> {
  console.log(`[Graph] getUserGraphToken called for userId: ${userId}`);
  const graphToken = await storage.getGraphToken(userId);
  console.log(`[Graph] getGraphToken result:`, graphToken ? { 
    userId: graphToken.userId, 
    tenantId: graphToken.tenantId, 
    hasAccessToken: !!graphToken.accessToken,
    hasRefreshToken: !!graphToken.refreshToken,
    expiresAt: graphToken.expiresAt 
  } : 'null');
  
  if (!graphToken || !graphToken.accessToken) {
    console.log(`[Graph] No token found for user ${userId}`);
    return null;
  }

  const accessToken = isEncrypted(graphToken.accessToken) 
    ? decryptToken(graphToken.accessToken) 
    : graphToken.accessToken;

  // Check if token is still valid (with 5 min buffer)
  if (graphToken.expiresAt && new Date(graphToken.expiresAt) > new Date(Date.now() + 5 * 60 * 1000)) {
    return accessToken;
  }

  // Try to refresh token if available
  if (graphToken.refreshToken) {
    try {
      const { ConfidentialClientApplication } = await import('@azure/msal-node');
      const msalConfig = {
        auth: {
          clientId: process.env.AZURE_CLIENT_ID || '',
          authority: `https://login.microsoftonline.com/${graphToken.tenantId || 'common'}`,
          clientSecret: process.env.AZURE_CLIENT_SECRET || '',
        },
      };
      const client = new ConfidentialClientApplication(msalConfig);
      
      const decryptedRefresh = isEncrypted(graphToken.refreshToken) 
        ? decryptToken(graphToken.refreshToken) 
        : graphToken.refreshToken;
      
      const response = await client.acquireTokenByRefreshToken({
        refreshToken: decryptedRefresh,
        scopes: ['Files.Read.All', 'Sites.Read.All', 'User.Read'],
      });

      if (response?.accessToken) {
        const { encryptToken } = await import('./utils/encryption');
        await storage.upsertGraphToken({
          userId,
          tenantId: graphToken.tenantId || '',
          accessToken: encryptToken(response.accessToken),
          refreshToken: graphToken.refreshToken, // Keep existing refresh token
          expiresAt: response.expiresOn || null,
          scopes: graphToken.scopes || ['Files.Read.All', 'Sites.Read.All', 'User.Read'],
        });
        console.log(`[Graph] Refreshed token for user ${userId}`);
        return response.accessToken;
      }
    } catch (error) {
      console.error(`[Graph] Token refresh failed for user ${userId}:`, error);
    }
  }

  // Token is expired and we couldn't refresh it
  console.log(`[Graph] Token expired for user ${userId}, needs re-authentication`);
  return null;
}

async function getUserGraphClient(userId: string): Promise<Client | null> {
  const accessToken = await getUserGraphToken(userId);
  if (!accessToken) {
    return null;
  }

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// ==================== Replit Connector Functions ====================

async function getAccessToken(connectorType: ConnectorType = 'outlook'): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  // Get cached settings for this connector type
  let connectionSettings: any;
  if (connectorType === 'outlook') {
    connectionSettings = outlookConnectionSettings;
  } else if (connectorType === 'onedrive') {
    connectionSettings = oneDriveConnectionSettings;
  } else {
    connectionSettings = sharePointConnectionSettings;
  }

  // Check if cached token is still valid
  if (connectionSettings && connectionSettings.settings?.expires_at && 
      new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }

  // Fetch fresh token
  connectionSettings = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=${connectorType}`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || 
                      connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    const serviceName = connectorType.charAt(0).toUpperCase() + connectorType.slice(1);
    throw new Error(`${serviceName} not connected. Please connect your Microsoft account in Replit.`);
  }

  // Cache the settings
  if (connectorType === 'outlook') {
    outlookConnectionSettings = connectionSettings;
  } else if (connectorType === 'onedrive') {
    oneDriveConnectionSettings = connectionSettings;
  } else {
    sharePointConnectionSettings = connectionSettings;
  }

  return accessToken;
}

async function getMicrosoftClient(connectorType: ConnectorType = 'outlook', userId?: string): Promise<Client> {
  // If userId is provided, try user's delegated token first (for multi-tenant access)
  if (userId) {
    const userClient = await getUserGraphClient(userId);
    if (userClient) {
      console.log(`[Graph] Using user delegated token for ${connectorType}`);
      return userClient;
    }
    console.log(`[Graph] No user token found, falling back to connector for ${connectorType}`);
  }
  
  const accessToken = await getAccessToken(connectorType);

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
}

// Legacy alias for backward compatibility
async function getOutlookClient(): Promise<Client> {
  return getMicrosoftClient('outlook');
}

export interface OutlookCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
}

export interface OutlookEvent {
  id?: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: string;
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: string;
}

export interface EmailMessage {
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
}

export async function checkOutlookConnection(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch (error) {
    return false;
  }
}

export async function getCurrentUser(): Promise<{ displayName: string; mail: string } | null> {
  try {
    const client = await getOutlookClient();
    const user = await client.api('/me').select('displayName,mail').get();
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

export async function listCalendars(): Promise<OutlookCalendar[]> {
  const client = await getOutlookClient();
  
  const response = await client.api('/me/calendars')
    .select('id,name,color,isDefaultCalendar,canEdit')
    .get();
  
  return response.value.map((cal: any) => ({
    id: cal.id,
    name: cal.name,
    color: cal.color,
    isDefaultCalendar: cal.isDefaultCalendar,
    canEdit: cal.canEdit,
  }));
}

export async function createCalendarEvent(
  calendarId: string | null,
  event: OutlookEvent
): Promise<OutlookEvent> {
  const client = await getOutlookClient();
  
  const endpoint = calendarId 
    ? `/me/calendars/${calendarId}/events`
    : '/me/events';
  
  const createdEvent = await client.api(endpoint).post(event);
  
  return {
    id: createdEvent.id,
    subject: createdEvent.subject,
    start: createdEvent.start,
    end: createdEvent.end,
    body: createdEvent.body,
    location: createdEvent.location,
    attendees: createdEvent.attendees,
  };
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<OutlookEvent>
): Promise<OutlookEvent> {
  const client = await getOutlookClient();
  
  const updatedEvent = await client.api(`/me/events/${eventId}`).patch(updates);
  
  return {
    id: updatedEvent.id,
    subject: updatedEvent.subject,
    start: updatedEvent.start,
    end: updatedEvent.end,
    body: updatedEvent.body,
    location: updatedEvent.location,
    attendees: updatedEvent.attendees,
  };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const client = await getOutlookClient();
  await client.api(`/me/events/${eventId}`).delete();
}

export async function getCalendarEvent(eventId: string): Promise<OutlookEvent | null> {
  try {
    const client = await getOutlookClient();
    const event = await client.api(`/me/events/${eventId}`).get();
    
    return {
      id: event.id,
      subject: event.subject,
      start: event.start,
      end: event.end,
      body: event.body,
      location: event.location,
      attendees: event.attendees,
    };
  } catch (error) {
    console.error('Failed to get calendar event:', error);
    return null;
  }
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    const client = await getOutlookClient();
    
    await client.api('/me/sendMail').post({
      message,
      saveToSentItems: true,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export function vegaMeetingToOutlookEvent(
  meeting: {
    title: string;
    date: Date | null;
    attendees?: string[] | null;
    agenda?: string[] | null;
    summary?: string | null;
    meetingType?: string | null;
  },
  durationMinutes: number = 60
): OutlookEvent {
  const startDate = meeting.date || new Date();
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  
  let bodyContent = '';
  
  if (meeting.meetingType) {
    bodyContent += `<p><strong>Meeting Type:</strong> ${meeting.meetingType}</p>`;
  }
  
  if (meeting.agenda && meeting.agenda.length > 0) {
    bodyContent += '<p><strong>Agenda:</strong></p><ul>';
    meeting.agenda.forEach(item => {
      bodyContent += `<li>${item}</li>`;
    });
    bodyContent += '</ul>';
  }
  
  if (meeting.summary) {
    bodyContent += `<p><strong>Summary:</strong></p><p>${meeting.summary}</p>`;
  }
  
  bodyContent += '<p><em>Synced from Vega - Company OS Platform</em></p>';
  
  const event: OutlookEvent = {
    subject: meeting.title,
    body: {
      contentType: 'HTML',
      content: bodyContent,
    },
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'UTC',
    },
    isOnlineMeeting: true,
    onlineMeetingProvider: 'teamsForBusiness',
  };
  
  if (meeting.attendees && meeting.attendees.length > 0) {
    event.attendees = meeting.attendees
      .filter(a => a.includes('@'))
      .map(email => ({
        emailAddress: { address: email.trim() },
        type: 'required',
      }));
  }
  
  return event;
}

export function generateMeetingSummaryEmail(
  meeting: {
    title: string;
    date: Date | null;
    attendees?: string[] | null;
    summary?: string | null;
    decisions?: string[] | null;
    actionItems?: string[] | null;
    risks?: string[] | null;
  },
  toEmails: string[]
): EmailMessage {
  let htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #810FFB;">Meeting Summary: ${meeting.title}</h2>
      <p style="color: #666;">Date: ${meeting.date ? new Date(meeting.date).toLocaleDateString() : 'Not specified'}</p>
  `;
  
  if (meeting.summary) {
    htmlContent += `
      <h3 style="color: #333; border-bottom: 2px solid #810FFB; padding-bottom: 5px;">Summary</h3>
      <p>${meeting.summary}</p>
    `;
  }
  
  if (meeting.decisions && meeting.decisions.length > 0) {
    htmlContent += `
      <h3 style="color: #333; border-bottom: 2px solid #810FFB; padding-bottom: 5px;">Decisions Made</h3>
      <ul>
        ${meeting.decisions.map(d => `<li>${d}</li>`).join('')}
      </ul>
    `;
  }
  
  if (meeting.actionItems && meeting.actionItems.length > 0) {
    htmlContent += `
      <h3 style="color: #333; border-bottom: 2px solid #E60CB3; padding-bottom: 5px;">Action Items</h3>
      <ul>
        ${meeting.actionItems.map(a => `<li>${a}</li>`).join('')}
      </ul>
    `;
  }
  
  if (meeting.risks && meeting.risks.length > 0) {
    htmlContent += `
      <h3 style="color: #333; border-bottom: 2px solid #ff6b35; padding-bottom: 5px;">Risks Identified</h3>
      <ul>
        ${meeting.risks.map(r => `<li>${r}</li>`).join('')}
      </ul>
    `;
  }
  
  htmlContent += `
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
      <p style="color: #999; font-size: 12px;">Sent from Vega - Company OS Platform</p>
    </div>
  `;
  
  return {
    subject: `Meeting Summary: ${meeting.title}`,
    body: {
      contentType: 'HTML',
      content: htmlContent,
    },
    toRecipients: toEmails.map(email => ({
      emailAddress: { address: email.trim() },
    })),
  };
}

// ==================== OneDrive Integration ====================

export interface OneDriveItem {
  id: string;
  name: string;
  size: number;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  parentReference?: { driveId: string; id: string; path: string };
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webUrl: string;
  downloadUrl?: string;
  content?: Buffer;
}

export async function checkOneDriveConnection(): Promise<boolean> {
  try {
    await getAccessToken('onedrive');
    return true;
  } catch (error) {
    return false;
  }
}

export async function listOneDriveRoot(): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('onedrive');
  const response = await client.api('/me/drive/root/children')
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .get();
  return response.value;
}

export async function listOneDriveFolder(folderId: string): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('onedrive');
  const response = await client.api(`/me/drive/items/${folderId}/children`)
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .get();
  return response.value;
}

export async function getOneDriveItem(itemId: string): Promise<OneDriveItem> {
  const client = await getMicrosoftClient('onedrive');
  return await client.api(`/me/drive/items/${itemId}`)
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .get();
}

export async function downloadOneDriveFile(itemId: string): Promise<Buffer> {
  const client = await getMicrosoftClient('onedrive');
  const stream = await client.api(`/me/drive/items/${itemId}/content`).get();
  
  // Convert stream/response to buffer
  if (stream instanceof ArrayBuffer) {
    return Buffer.from(stream);
  }
  return stream;
}

export async function uploadOneDriveFile(
  parentFolderId: string | null,
  fileName: string,
  content: Buffer | string,
  mimeType: string = 'application/octet-stream'
): Promise<OneDriveItem> {
  const client = await getMicrosoftClient('onedrive');
  
  const path = parentFolderId 
    ? `/me/drive/items/${parentFolderId}:/${fileName}:/content`
    : `/me/drive/root:/${fileName}:/content`;
  
  const uploadedFile = await client.api(path)
    .header('Content-Type', mimeType)
    .put(content);
  
  return uploadedFile;
}

export async function createOneDriveFolder(
  parentFolderId: string | null,
  folderName: string
): Promise<OneDriveItem> {
  const client = await getMicrosoftClient('onedrive');
  
  const path = parentFolderId
    ? `/me/drive/items/${parentFolderId}/children`
    : '/me/drive/root/children';
  
  const folder = await client.api(path).post({
    name: folderName,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename'
  });
  
  return folder;
}

export async function deleteOneDriveItem(itemId: string): Promise<void> {
  const client = await getMicrosoftClient('onedrive');
  await client.api(`/me/drive/items/${itemId}`).delete();
}

export async function searchOneDrive(query: string): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('onedrive');
  const response = await client.api(`/me/drive/root/search(q='${encodeURIComponent(query)}')`)
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .get();
  return response.value;
}

// ==================== SharePoint Integration ====================

export interface SharePointSite {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  createdDateTime: string;
}

export interface SharePointList {
  id: string;
  name: string;
  displayName: string;
  webUrl: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  list?: {
    template: string;
    contentTypesEnabled: boolean;
  };
}

export interface SharePointListItem {
  id: string;
  fields: Record<string, any>;
  createdDateTime: string;
  lastModifiedDateTime: string;
  webUrl: string;
}

export async function checkSharePointConnection(userId?: string): Promise<boolean> {
  console.log(`[SharePoint] checkSharePointConnection called with userId: ${userId}`);
  
  // First priority: Check if user has a delegated token (for multi-tenant SSO)
  if (userId) {
    try {
      console.log(`[SharePoint] Checking for user delegated token...`);
      const userClient = await getUserGraphClient(userId);
      if (userClient) {
        console.log('[SharePoint] User delegated token available for SharePoint access');
        return true;
      }
      console.log('[SharePoint] getUserGraphClient returned null');
    } catch (error: any) {
      console.log('[SharePoint] User token check failed:', error.message);
    }
  }
  
  // Second: Check if Entra app is available (has proper SharePoint permissions)
  if (hasEntraAppCredentials()) {
    try {
      await getEntraAppAccessToken();
      console.log('[SharePoint] Entra app credentials available for SharePoint access');
      return true;
    } catch (error) {
      console.log('[SharePoint] Entra app token failed, trying Replit connector');
    }
  }
  
  // Fall back to Replit connector
  try {
    await getAccessToken('sharepoint');
    return true;
  } catch (error) {
    return false;
  }
}

export async function listSharePointSites(userId?: string): Promise<SharePointSite[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  const sites: SharePointSite[] = [];
  
  // With Sites.Selected permission, we can't list all sites
  // Instead, try multiple approaches to find accessible sites
  
  try {
    // Try 1: Get user's followed sites (works with limited permissions)
    const followedResponse = await client.api('/me/followedSites')
      .select('id,name,displayName,webUrl,createdDateTime')
      .top(50)
      .get();
    
    if (followedResponse.value) {
      sites.push(...followedResponse.value);
    }
  } catch (e: any) {
    console.log('Could not fetch followed sites:', e.message);
  }
  
  try {
    // Try 2: Get the root site (tenant root)
    const rootSite = await client.api('/sites/root')
      .select('id,name,displayName,webUrl,createdDateTime')
      .get();
    
    if (rootSite && !sites.find(s => s.id === rootSite.id)) {
      sites.push(rootSite);
    }
  } catch (e: any) {
    console.log('Could not fetch root site:', e.message);
  }
  
  try {
    // Try 3: Search with wildcard (requires Sites.Read.All but worth trying)
    const searchResponse = await client.api('/sites?search=*')
      .select('id,name,displayName,webUrl,createdDateTime')
      .top(50)
      .get();
    
    if (searchResponse.value) {
      for (const site of searchResponse.value) {
        if (!sites.find(s => s.id === site.id)) {
          sites.push(site);
        }
      }
    }
  } catch (e: any) {
    console.log('Site search not available:', e.message);
  }
  
  return sites;
}

// Parse a SharePoint URL to get the site ID
export async function getSharePointSiteFromUrl(siteUrl: string, userId?: string): Promise<SharePointSite | null> {
  let client;
  try {
    client = await getMicrosoftClient('sharepoint', userId);
  } catch (e: any) {
    if (e.message?.includes('expired') || e.message?.includes('token')) {
      const error = new Error('Your session has expired. Please log out and log back in to reconnect to SharePoint.');
      (error as any).code = 'TOKEN_EXPIRED';
      throw error;
    }
    throw e;
  }
  
  try {
    // Extract hostname and path from URL
    const url = new URL(siteUrl);
    const hostname = url.hostname;
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Construct the site path (e.g., "sites/teamsite" or just the root)
    let sitePath = '';
    if (pathParts.length >= 2 && (pathParts[0] === 'sites' || pathParts[0] === 'teams')) {
      sitePath = `/${pathParts[0]}/${pathParts[1]}`;
    }
    
    // Get the site by hostname and path
    const site = await client.api(`/sites/${hostname}:${sitePath}`)
      .select('id,name,displayName,webUrl,createdDateTime')
      .get();
    
    return site;
  } catch (e: any) {
    console.error('Could not resolve SharePoint site from URL:', e.message);
    // Check for token expiration in Graph API errors
    if (e.message?.includes('expired') || e.code === 'InvalidAuthenticationToken') {
      const error = new Error('Your session has expired. Please log out and log back in to reconnect to SharePoint.');
      (error as any).code = 'TOKEN_EXPIRED';
      throw error;
    }
    return null;
  }
}

export async function getSharePointSite(siteId: string, userId?: string): Promise<SharePointSite> {
  const client = await getMicrosoftClient('sharepoint', userId);
  return await client.api(`/sites/${siteId}`)
    .select('id,name,displayName,webUrl,createdDateTime')
    .get();
}

export async function listSharePointLists(siteId: string, userId?: string): Promise<SharePointList[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  const response = await client.api(`/sites/${siteId}/lists`)
    .select('id,name,displayName,webUrl,createdDateTime,lastModifiedDateTime,list')
    .get();
  return response.value;
}

export async function getSharePointListItems(
  siteId: string,
  listId: string,
  expandFields: boolean = true,
  userId?: string
): Promise<SharePointListItem[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  
  let request = client.api(`/sites/${siteId}/lists/${listId}/items`);
  if (expandFields) {
    request = request.expand('fields');
  }
  
  const response = await request.get();
  return response.value;
}

export async function createSharePointListItem(
  siteId: string,
  listId: string,
  fields: Record<string, any>
): Promise<SharePointListItem> {
  const client = await getMicrosoftClient('sharepoint');
  
  const item = await client.api(`/sites/${siteId}/lists/${listId}/items`)
    .post({ fields });
  
  return item;
}

export async function updateSharePointListItem(
  siteId: string,
  listId: string,
  itemId: string,
  fields: Record<string, any>
): Promise<SharePointListItem> {
  const client = await getMicrosoftClient('sharepoint');
  
  const item = await client.api(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`)
    .patch(fields);
  
  return { id: itemId, fields: item, createdDateTime: '', lastModifiedDateTime: '', webUrl: '' };
}

export async function deleteSharePointListItem(
  siteId: string,
  listId: string,
  itemId: string
): Promise<void> {
  const client = await getMicrosoftClient('sharepoint');
  await client.api(`/sites/${siteId}/lists/${listId}/items/${itemId}`).delete();
}

// SharePoint Drive (document library) interface
export interface SharePointDrive {
  id: string;
  name: string;
  description?: string;
  webUrl: string;
  driveType: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

// List all document libraries (drives) in a SharePoint site
export async function listSharePointDrives(siteId: string, userId?: string): Promise<SharePointDrive[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  const response = await client.api(`/sites/${siteId}/drives`)
    .select('id,name,description,webUrl,driveType,createdDateTime,lastModifiedDateTime')
    .get();
  return response.value;
}

// Search for Excel files in SharePoint
export async function searchSharePointExcelFiles(siteId: string, query?: string, userId?: string): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  
  // Get all drives in the site
  const drives = await listSharePointDrives(siteId, userId);
  const allExcelFiles: OneDriveItem[] = [];
  
  for (const drive of drives) {
    try {
      let path: string;
      if (query) {
        path = `/sites/${siteId}/drives/${drive.id}/root/search(q='${query} .xlsx OR ${query} .xls')`;
      } else {
        path = `/sites/${siteId}/drives/${drive.id}/root/search(q='.xlsx OR .xls')`;
      }
      
      const response = await client.api(path)
        .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
        .top(50)
        .get();
      
      // Filter to only Excel files
      const excelFiles = response.value.filter((item: any) => 
        item.file && (item.name.endsWith('.xlsx') || item.name.endsWith('.xls'))
      );
      
      allExcelFiles.push(...excelFiles);
    } catch (error) {
      console.error(`Failed to search drive ${drive.name}:`, error);
    }
  }
  
  return allExcelFiles;
}

// Get document library items (files/folders) from a SharePoint site
export async function listSharePointDocuments(
  siteId: string,
  driveId?: string,
  folderId?: string,
  userId?: string
): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('sharepoint', userId);
  
  let path: string;
  if (driveId && folderId) {
    path = `/sites/${siteId}/drives/${driveId}/items/${folderId}/children`;
  } else if (driveId) {
    path = `/sites/${siteId}/drives/${driveId}/root/children`;
  } else {
    // Get default document library
    path = `/sites/${siteId}/drive/root/children`;
  }
  
  const response = await client.api(path)
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .get();
  
  return response.value;
}

// ==================== SharePoint Shares API (for direct URL access) ====================

// Encode a sharing URL to a shareId token for the Shares API
// See: https://learn.microsoft.com/en-us/graph/api/shares-get
function encodeShareUrl(url: string): string {
  // Base64 encode the URL, then make it URL-safe
  const base64 = Buffer.from(url, 'utf8').toString('base64');
  // Replace + with -, / with _, and remove trailing =
  const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `u!${urlSafe}`;
}

// Resolve a SharePoint/OneDrive file from its web URL using Shares API
// This works with Files.Read permission for files the user has access to
export async function resolveFileFromUrl(fileUrl: string): Promise<OneDriveItem | null> {
  try {
    // Use OneDrive connector as it has Files.Read permission
    const client = await getMicrosoftClient('onedrive');
    const shareId = encodeShareUrl(fileUrl);
    
    const response = await client.api(`/shares/${shareId}/driveItem`)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
      .get();
    
    return response;
  } catch (error: any) {
    console.error('Failed to resolve file from URL:', error.message || error);
    return null;
  }
}

// Get file metadata and content info from a sharing URL
// userId: optional - if provided, uses user's delegated token (for multi-tenant access)
export async function getSharePointFileFromUrl(fileUrl: string, userId?: string): Promise<{
  item: OneDriveItem;
  driveId: string;
  siteId?: string;
} | null> {
  const shareId = encodeShareUrl(fileUrl);
  console.log('[SharePoint] Resolving file URL:', fileUrl);
  console.log('[SharePoint] Encoded shareId:', shareId);
  if (userId) {
    console.log('[SharePoint] Using user delegated token for userId:', userId);
  }
  
  const isSharePointUrl = fileUrl.includes('.sharepoint.com');
  let lastError: any = null;
  
  // PRIORITY 1: Use user's delegated token (best for multi-tenant SharePoint access)
  if (userId) {
    try {
      console.log('[SharePoint] Trying user delegated token...');
      const userClient = await getUserGraphClient(userId);
      
      if (userClient) {
        const response = await userClient.api(`/shares/${shareId}/driveItem`)
          .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
          .get();
        
        if (response) {
          console.log('[SharePoint] Successfully resolved file via user token:', response.name);
          return {
            item: response,
            driveId: response.parentReference?.driveId || '',
            siteId: response.parentReference?.siteId,
          };
        }
      } else {
        console.log('[SharePoint] No user token available, will try other methods');
      }
    } catch (error: any) {
      console.log('[SharePoint] User delegated token failed:', error.code, error.message);
      lastError = error;
      // Fall through to try other methods
    }
  }
  
  // PRIORITY 2: Fall back to Replit connectors
  const connectorOrder: ConnectorType[] = isSharePointUrl 
    ? ['sharepoint', 'onedrive'] 
    : ['onedrive', 'sharepoint'];
  
  for (const connectorType of connectorOrder) {
    try {
      console.log(`[SharePoint] Trying ${connectorType} connector...`);
      const client = await getMicrosoftClient(connectorType);
      
      const response = await client.api(`/shares/${shareId}/driveItem`)
        .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
        .get();
      
      if (!response) {
        console.log(`[SharePoint] No response from ${connectorType} Shares API`);
        continue;
      }
      
      console.log(`[SharePoint] Successfully resolved file via ${connectorType}:`, response.name);
      
      return {
        item: response,
        driveId: response.parentReference?.driveId || '',
        siteId: response.parentReference?.siteId,
      };
    } catch (error: any) {
      console.log(`[SharePoint] ${connectorType} connector failed:`, error.code, error.message);
      lastError = error;
    }
  }
  
  // All methods failed
  if (lastError) {
    console.error('[SharePoint] All methods failed to resolve file');
    if (lastError.body) {
      try {
        const body = JSON.parse(lastError.body);
        console.error('[SharePoint] Error details:', body.error?.message || body);
      } catch (e) {
        console.error('[SharePoint] Error body:', lastError.body);
      }
    }
    throw lastError;
  }
  
  return null;
}

// Get all drives the user has access to (OneDrive + SharePoint document libraries)
export async function getUserDrives(): Promise<Array<{
  id: string;
  name: string;
  driveType: string;
  webUrl?: string;
  owner?: { user?: { displayName: string } };
  siteName?: string;
}>> {
  const allDrives: Array<{
    id: string;
    name: string;
    driveType: string;
    webUrl?: string;
    owner?: { user?: { displayName: string } };
    siteName?: string;
  }> = [];
  
  try {
    const client = await getMicrosoftClient('onedrive');
    
    // Get personal OneDrive drives
    try {
      const personalDrives = await client.api('/me/drives')
        .select('id,name,driveType,webUrl,owner')
        .get();
      
      if (personalDrives.value) {
        allDrives.push(...personalDrives.value);
      }
    } catch (error: any) {
      console.error('[SharePoint] Failed to get personal drives:', error.message);
    }
    
    // Get SharePoint sites using existing function that handles permission fallbacks
    try {
      const sites = await listSharePointSites();
      console.log(`[SharePoint] Found ${sites.length} sites to check for document libraries`);
      
      // For each site, get document libraries
      for (const site of sites) {
        try {
          console.log(`[SharePoint] Fetching drives for site: ${site.displayName || site.name} (${site.id})`);
          const spClient = await getMicrosoftClient('sharepoint');
          const drivesResponse = await spClient.api(`/sites/${site.id}/drives`)
            .select('id,name,driveType,webUrl,description')
            .get();
          
          const siteDrives = drivesResponse.value || [];
          console.log(`[SharePoint] Site ${site.displayName} has ${siteDrives.length} drives`);
          for (const drive of siteDrives) {
            console.log(`[SharePoint]   Drive: ${drive.name}, type: ${drive.driveType}`);
            // Only include document libraries
            if (drive.driveType === 'documentLibrary') {
              allDrives.push({
                id: drive.id,
                name: `${site.displayName || site.name} - ${drive.name}`,
                driveType: drive.driveType,
                webUrl: drive.webUrl,
                siteName: site.displayName || site.name,
              });
            }
          }
        } catch (driveError: any) {
          console.error(`[SharePoint] Failed to get drives for site ${site.displayName}:`, driveError.message);
        }
      }
    } catch (sitesError: any) {
      console.error('[SharePoint] Failed to get SharePoint sites:', sitesError.message);
    }
    
    return allDrives;
  } catch (error: any) {
    console.error('[SharePoint] Failed to get user drives:', error.message);
    return allDrives;
  }
}

// Browse files in any drive (OneDrive or SharePoint document library)
export async function getDriveFiles(driveId: string, folderId?: string, userId?: string): Promise<OneDriveItem[]> {
  try {
    // Use sharepoint client type to use user's delegated token for SharePoint drives
    const client = await getMicrosoftClient('sharepoint', userId);
    
    const path = folderId 
      ? `/drives/${driveId}/items/${folderId}/children`
      : `/drives/${driveId}/root/children`;
    
    const response = await client.api(path)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
      .orderby('name')
      .top(100)
      .get();
    
    return response.value || [];
  } catch (error: any) {
    console.error('[SharePoint] Failed to get drive files:', error.message);
    return [];
  }
}

// Search for Excel files across all drives
export async function searchDriveForExcel(driveId: string, query: string, userId?: string): Promise<OneDriveItem[]> {
  try {
    // Use sharepoint client type to use user's delegated token
    const client = await getMicrosoftClient('sharepoint', userId);
    
    const response = await client.api(`/drives/${driveId}/root/search(q='${query}')`)
      .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
      .filter("file/mimeType eq 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or file/mimeType eq 'application/vnd.ms-excel'")
      .top(50)
      .get();
    
    return response.value || [];
  } catch (error: any) {
    console.error('[SharePoint] Failed to search drive:', error.message);
    return [];
  }
}

// Download file content using the Shares API
export async function downloadFileFromUrl(fileUrl: string): Promise<Buffer | null> {
  try {
    const client = await getMicrosoftClient('onedrive');
    const shareId = encodeShareUrl(fileUrl);
    
    const stream = await client.api(`/shares/${shareId}/driveItem/content`).get();
    
    if (stream instanceof ArrayBuffer) {
      return Buffer.from(stream);
    }
    return stream;
  } catch (error: any) {
    console.error('Failed to download file from URL:', error.message || error);
    return null;
  }
}

// Upload a file to SharePoint
export async function uploadSharePointFile(
  siteId: string,
  driveId: string | null,
  parentFolderId: string | null,
  fileName: string,
  content: Buffer | string,
  mimeType: string = 'application/octet-stream'
): Promise<OneDriveItem> {
  const client = await getMicrosoftClient('sharepoint');
  
  let path: string;
  if (driveId && parentFolderId) {
    path = `/sites/${siteId}/drives/${driveId}/items/${parentFolderId}:/${fileName}:/content`;
  } else if (driveId) {
    path = `/sites/${siteId}/drives/${driveId}/root:/${fileName}:/content`;
  } else if (parentFolderId) {
    path = `/sites/${siteId}/drive/items/${parentFolderId}:/${fileName}:/content`;
  } else {
    path = `/sites/${siteId}/drive/root:/${fileName}:/content`;
  }
  
  const uploadedFile = await client.api(path)
    .header('Content-Type', mimeType)
    .put(content);
  
  return uploadedFile;
}

// ==================== M365 Status Check ====================

export interface M365ConnectionStatus {
  outlook: boolean;
  onedrive: boolean;
  sharepoint: boolean;
}

export async function checkAllM365Connections(): Promise<M365ConnectionStatus> {
  const [outlook, onedrive, sharepoint] = await Promise.all([
    checkOutlookConnection(),
    checkOneDriveConnection(),
    checkSharePointConnection(),
  ]);
  
  return { outlook, onedrive, sharepoint };
}

// ==================== Excel Integration ====================

export interface ExcelWorksheet {
  id: string;
  name: string;
  position: number;
  visibility: string;
}

export interface ExcelCellValue {
  value: any;
  text: string;
  numberValue?: number;
  formula?: string;
}

export interface ExcelRange {
  address: string;
  values: any[][];
  text: string[][];
  formulas?: string[][];
}

export async function getExcelWorksheets(
  itemId: string,
  sourceType: 'onedrive' | 'sharepoint' = 'onedrive',
  siteId?: string,
  driveId?: string
): Promise<ExcelWorksheet[]> {
  const client = await getMicrosoftClient(sourceType === 'sharepoint' ? 'onedrive' : sourceType);
  
  let path: string;
  // Prefer driveId if provided (works with Files.Read permission)
  if (driveId) {
    path = `/drives/${driveId}/items/${itemId}/workbook/worksheets`;
  } else if (sourceType === 'sharepoint' && siteId) {
    path = `/sites/${siteId}/drive/items/${itemId}/workbook/worksheets`;
  } else {
    path = `/me/drive/items/${itemId}/workbook/worksheets`;
  }
  
  const response = await client.api(path).get();
  return response.value.map((ws: any) => ({
    id: ws.id,
    name: ws.name,
    position: ws.position,
    visibility: ws.visibility,
  }));
}

export async function getExcelCellValue(
  itemId: string,
  cellReference: string, // e.g., "A1" or "Sheet1!B5"
  sourceType: 'onedrive' | 'sharepoint' = 'onedrive',
  siteId?: string,
  driveId?: string
): Promise<ExcelCellValue> {
  const client = await getMicrosoftClient(sourceType === 'sharepoint' ? 'onedrive' : sourceType);
  
  // Parse cell reference - could be "A1" or "Sheet1!A1"
  let sheetName: string | undefined;
  let cellAddress = cellReference;
  
  if (cellReference.includes('!')) {
    const parts = cellReference.split('!');
    sheetName = parts[0].replace(/^'|'$/g, ''); // Remove quotes if present
    cellAddress = parts[1];
  }
  
  let path: string;
  const worksheetName = sheetName || 'Sheet1';
  
  // Prefer driveId if provided (works with Files.Read permission)
  if (driveId) {
    path = `/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${cellAddress}')`;
  } else if (sourceType === 'sharepoint' && siteId) {
    path = `/sites/${siteId}/drive/items/${itemId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${cellAddress}')`;
  } else {
    path = `/me/drive/items/${itemId}/workbook/worksheets/${encodeURIComponent(worksheetName)}/range(address='${cellAddress}')`;
  }
  
  const response = await client.api(path).get();
  
  // Extract the value from the response
  const rawValue = response.values?.[0]?.[0];
  const textValue = response.text?.[0]?.[0] ?? String(rawValue ?? '');
  const formula = response.formulas?.[0]?.[0];
  
  return {
    value: rawValue,
    text: textValue,
    numberValue: typeof rawValue === 'number' ? rawValue : parseFloat(textValue) || undefined,
    formula: formula && formula.startsWith('=') ? formula : undefined,
  };
}

export async function getExcelRange(
  itemId: string,
  rangeAddress: string, // e.g., "A1:B10" or "Sheet1!A1:B10"
  sourceType: 'onedrive' | 'sharepoint' = 'onedrive',
  siteId?: string
): Promise<ExcelRange> {
  const client = await getMicrosoftClient(sourceType);
  
  // Parse range reference
  let sheetName: string | undefined;
  let rangeRef = rangeAddress;
  
  if (rangeAddress.includes('!')) {
    const parts = rangeAddress.split('!');
    sheetName = parts[0].replace(/^'|'$/g, '');
    rangeRef = parts[1];
  }
  
  let path: string;
  if (sourceType === 'sharepoint' && siteId) {
    if (sheetName) {
      path = `/sites/${siteId}/drive/items/${itemId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${rangeRef}')`;
    } else {
      path = `/sites/${siteId}/drive/items/${itemId}/workbook/worksheets/Sheet1/range(address='${rangeRef}')`;
    }
  } else {
    if (sheetName) {
      path = `/me/drive/items/${itemId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${rangeRef}')`;
    } else {
      path = `/me/drive/items/${itemId}/workbook/worksheets/Sheet1/range(address='${rangeRef}')`;
    }
  }
  
  const response = await client.api(path).get();
  
  return {
    address: response.address,
    values: response.values,
    text: response.text,
    formulas: response.formulas,
  };
}

// Search for Excel files in OneDrive
export async function searchExcelFiles(query: string = ''): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('onedrive');
  
  // Search for xlsx files
  const searchQuery = query ? `${query} .xlsx` : '.xlsx';
  const response = await client.api(`/me/drive/root/search(q='${encodeURIComponent(searchQuery)}')`)
    .select('id,name,size,createdDateTime,lastModifiedDateTime,webUrl,folder,file,parentReference')
    .filter("file/mimeType eq 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or endswith(name,'.xlsx') or endswith(name,'.xls')")
    .get();
  
  // Filter to only Excel files
  return response.value.filter((item: OneDriveItem) => 
    item.file && (item.name.endsWith('.xlsx') || item.name.endsWith('.xls'))
  );
}
