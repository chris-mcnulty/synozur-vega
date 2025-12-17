import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { storage } from '../storage';
import { encryptToken, decryptToken, isEncrypted } from '../utils/encryption';

const OUTLOOK_SCOPES = [
  'openid',
  'profile',
  'email',
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'offline_access',
];

interface CalendarEvent {
  id: string;
  subject: string;
  body?: { contentType: string; content: string };
  bodyPreview?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: Array<{
    emailAddress: { address: string; name: string };
    type: string;
    status: { response: string };
  }>;
  organizer?: { emailAddress: { address: string; name: string } };
  webLink?: string;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  categories?: string[];
  showAs?: string;
  importance?: string;
  isAllDay?: boolean;
}

function getMsalClient(): ConfidentialClientApplication | null {
  if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
    return null;
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
  });
}

async function getAccessToken(userId: string): Promise<string | null> {
  const graphToken = await storage.getGraphToken(userId, 'outlook');
  if (!graphToken) {
    console.warn(`[Graph Outlook] No token found for user ${userId}`);
    return null;
  }

  if (!graphToken.accessToken) {
    console.warn(`[Graph Outlook] Token found but accessToken is null for user ${userId}`);
    return null;
  }

  const accessToken = isEncrypted(graphToken.accessToken)
    ? decryptToken(graphToken.accessToken)
    : graphToken.accessToken;

  if (graphToken.expiresAt && new Date(graphToken.expiresAt) > new Date()) {
    return accessToken;
  }

  if (graphToken.refreshToken) {
    try {
      const msalClient = getMsalClient();
      if (!msalClient) {
        return null;
      }

      const decryptedRefresh = isEncrypted(graphToken.refreshToken)
        ? decryptToken(graphToken.refreshToken)
        : graphToken.refreshToken;

      const refreshRequest = {
        refreshToken: decryptedRefresh,
        scopes: OUTLOOK_SCOPES,
      };

      const response = await msalClient.acquireTokenByRefreshToken(refreshRequest);
      if (response) {
        const newRefreshToken = (response as any).refreshToken || decryptedRefresh;

        await storage.upsertGraphToken({
          userId,
          tenantId: graphToken.tenantId,
          accessToken: encryptToken(response.accessToken),
          refreshToken: encryptToken(newRefreshToken),
          expiresAt: response.expiresOn ? new Date(response.expiresOn) : null,
          scopes: graphToken.scopes,
          service: 'outlook',
        });
        return response.accessToken;
      }
    } catch (error) {
      console.error(`[Graph Outlook] Token refresh failed for user ${userId}:`, error);
    }
  }

  return accessToken;
}

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function getOutlookCalendars(userId: string): Promise<any[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect Outlook.');
  }

  const client = getGraphClient(accessToken);

  try {
    const response = await client.api('/me/calendars').get();
    return response.value || [];
  } catch (error) {
    console.error('[Graph Outlook] Failed to get calendars:', error);
    throw error;
  }
}

export async function getOutlookCalendarEvents(
  userId: string,
  startDateTime: Date,
  endDateTime: Date,
  calendarId?: string
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect Outlook.');
  }

  const client = getGraphClient(accessToken);

  try {
    const startISO = startDateTime.toISOString();
    const endISO = endDateTime.toISOString();

    const calendarPath = calendarId 
      ? `/me/calendars/${calendarId}/calendarView`
      : '/me/calendarView';

    const response = await client
      .api(calendarPath)
      .query({
        startDateTime: startISO,
        endDateTime: endISO,
        $orderby: 'start/dateTime',
        $select: 'id,subject,bodyPreview,start,end,location,attendees,organizer,webLink,isOnlineMeeting,onlineMeetingUrl,categories,showAs,importance,isAllDay',
        $top: 100,
      })
      .get();

    return response.value || [];
  } catch (error) {
    console.error('[Graph Outlook] Failed to get calendar events:', error);
    throw error;
  }
}

export async function getOutlookEventDetails(
  userId: string,
  eventId: string
): Promise<CalendarEvent | null> {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    throw new Error('No valid access token available. Please reconnect Outlook.');
  }

  const client = getGraphClient(accessToken);

  try {
    const event = await client
      .api(`/me/events/${eventId}`)
      .select('id,subject,body,bodyPreview,start,end,location,attendees,organizer,webLink,isOnlineMeeting,onlineMeetingUrl,categories,showAs,importance,isAllDay')
      .get();

    return event;
  } catch (error) {
    console.error('[Graph Outlook] Failed to get event details:', error);
    throw error;
  }
}

export async function getOutlookIntegrationStatus(userId: string): Promise<{
  connected: boolean;
  calendarCount: number;
  lastSyncAt: Date | null;
}> {
  const token = await storage.getGraphToken(userId, 'outlook');

  if (!token) {
    return { connected: false, calendarCount: 0, lastSyncAt: null };
  }

  try {
    const calendars = await getOutlookCalendars(userId);
    return {
      connected: true,
      calendarCount: calendars.length,
      lastSyncAt: token.lastUsedAt,
    };
  } catch (error) {
    console.error('[Graph Outlook] Failed to get integration status:', error);
    return {
      connected: true,
      calendarCount: 0,
      lastSyncAt: token.lastUsedAt,
    };
  }
}
