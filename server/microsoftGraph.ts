import { Client } from '@microsoft/microsoft-graph-client';

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=outlook',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Outlook not connected. Please connect your Microsoft account in Replit.');
  }
  return accessToken;
}

async function getOutlookClient(): Promise<Client> {
  const accessToken = await getAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken
    }
  });
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
