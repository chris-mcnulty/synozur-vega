import { Client } from '@microsoft/microsoft-graph-client';

// Cached connection settings per connector type
let outlookConnectionSettings: any;
let oneDriveConnectionSettings: any;
let sharePointConnectionSettings: any;

type ConnectorType = 'outlook' | 'onedrive' | 'sharepoint';

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

async function getMicrosoftClient(connectorType: ConnectorType = 'outlook'): Promise<Client> {
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

export async function checkSharePointConnection(): Promise<boolean> {
  try {
    await getAccessToken('sharepoint');
    return true;
  } catch (error) {
    return false;
  }
}

export async function listSharePointSites(): Promise<SharePointSite[]> {
  const client = await getMicrosoftClient('sharepoint');
  
  // Get sites that the user follows or has access to
  const response = await client.api('/sites?search=*')
    .select('id,name,displayName,webUrl,createdDateTime')
    .top(50)
    .get();
  
  return response.value;
}

export async function getSharePointSite(siteId: string): Promise<SharePointSite> {
  const client = await getMicrosoftClient('sharepoint');
  return await client.api(`/sites/${siteId}`)
    .select('id,name,displayName,webUrl,createdDateTime')
    .get();
}

export async function listSharePointLists(siteId: string): Promise<SharePointList[]> {
  const client = await getMicrosoftClient('sharepoint');
  const response = await client.api(`/sites/${siteId}/lists`)
    .select('id,name,displayName,webUrl,createdDateTime,lastModifiedDateTime,list')
    .get();
  return response.value;
}

export async function getSharePointListItems(
  siteId: string,
  listId: string,
  expandFields: boolean = true
): Promise<SharePointListItem[]> {
  const client = await getMicrosoftClient('sharepoint');
  
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

// Get document library items (files/folders) from a SharePoint site
export async function listSharePointDocuments(
  siteId: string,
  driveId?: string,
  folderId?: string
): Promise<OneDriveItem[]> {
  const client = await getMicrosoftClient('sharepoint');
  
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
