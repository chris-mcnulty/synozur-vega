import { Router, Request, Response } from 'express';
import {
  getOutlookCalendars,
  getOutlookCalendarEvents,
  getOutlookEventDetails,
  getOutlookIntegrationStatus,
} from './services/graph-outlook';
import {
  createCalendarEventForUser,
  vegaMeetingToOutlookEvent,
  checkOutlookConnectionForUser,
} from './microsoftGraph';
import { storage } from './storage';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const status = await getOutlookIntegrationStatus(user.id);
    res.json(status);
  } catch (error: any) {
    console.error('[Outlook API] Status error:', error);
    res.status(500).json({ error: 'Failed to get Outlook status' });
  }
});

router.get('/calendars', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const calendars = await getOutlookCalendars(user.id);
    res.json(calendars);
  } catch (error: any) {
    console.error('[Outlook API] Calendars error:', error);
    if (error.message?.includes('reconnect')) {
      return res.status(401).json({ error: error.message, reconnectRequired: true });
    }
    res.status(500).json({ error: 'Failed to get calendars' });
  }
});

router.get('/events', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { startDate, endDate, calendarId } = req.query;

    const start = startDate
      ? new Date(startDate as string)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate
      ? new Date(endDate as string)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const events = await getOutlookCalendarEvents(
      user.id,
      start,
      end,
      calendarId as string | undefined
    );

    res.json(events);
  } catch (error: any) {
    console.error('[Outlook API] Events error:', error);
    if (error.message?.includes('reconnect')) {
      return res.status(401).json({ error: error.message, reconnectRequired: true });
    }
    res.status(500).json({ error: 'Failed to get calendar events' });
  }
});

router.get('/events/:eventId', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { eventId } = req.params;
    const event = await getOutlookEventDetails(user.id, eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error: any) {
    console.error('[Outlook API] Event details error:', error);
    if (error.message?.includes('reconnect')) {
      return res.status(401).json({ error: error.message, reconnectRequired: true });
    }
    res.status(500).json({ error: 'Failed to get event details' });
  }
});

router.post('/schedule-meeting', async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { meetingId, durationMinutes, calendarId } = req.body;

    if (!meetingId || typeof meetingId !== 'string') {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const userId = (user as any).id;
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      const msg = connectionStatus.reason === 'token_expired'
        ? 'Your Outlook connection has expired. Please go to Settings and reconnect your Microsoft 365 account.'
        : 'Outlook is not yet connected. Please go to Settings and connect your Microsoft 365 account.';
      return res.status(400).json({ error: msg, reason: connectionStatus.reason });
    }

    const meeting = await storage.getMeetingById(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.tenantId !== (user as any).tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const objectives = meeting.linkedObjectiveIds?.length
      ? await Promise.all(meeting.linkedObjectiveIds.map((id: string) => storage.getObjectiveById(id).catch(() => null)))
      : [];
    const keyResults = meeting.linkedKeyResultIds?.length
      ? await Promise.all(meeting.linkedKeyResultIds.map((id: string) => storage.getKeyResultById(id).catch(() => null)))
      : [];
    const bigRocks = meeting.linkedBigRockIds?.length
      ? await Promise.all(meeting.linkedBigRockIds.map((id: string) => storage.getBigRockById(id).catch(() => null)))
      : [];

    const validObjectives = objectives.filter(Boolean);
    const validKeyResults = keyResults.filter(Boolean);
    const validBigRocks = bigRocks.filter(Boolean);

    const duration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;

    const outlookEvent = vegaMeetingToOutlookEvent(
      {
        title: meeting.title,
        date: meeting.date,
        attendees: meeting.attendees,
        agenda: meeting.agenda,
        summary: meeting.summary,
        meetingType: meeting.meetingType,
      },
      duration
    );

    let bodyContent = outlookEvent.body?.content || '';
    const insertBefore = '<p><em>Synced from Vega';

    let linkedContent = '';
    if (validBigRocks.length > 0) {
      linkedContent += '<p><strong>Linked Initiatives (Big Rocks):</strong></p><ul>';
      validBigRocks.forEach((rock: any) => {
        const status = rock.status === 'on_track' ? 'On Track' : rock.status === 'at_risk' ? 'At Risk' : rock.status === 'behind' ? 'Behind' : rock.status === 'completed' ? 'Complete' : 'Not Started';
        linkedContent += `<li>${rock.title} [${status}]</li>`;
      });
      linkedContent += '</ul>';
    }

    if (validObjectives.length > 0) {
      linkedContent += '<p><strong>Linked Objectives:</strong></p><ul>';
      validObjectives.forEach((obj: any) => {
        const progress = obj.progress?.toFixed(0) || 0;
        const status = obj.status === 'on_track' ? 'On Track' : obj.status === 'at_risk' ? 'At Risk' : obj.status === 'behind' ? 'Behind' : obj.status === 'completed' ? 'Complete' : 'Not Started';
        linkedContent += `<li>${obj.title} [${status} - ${progress}%]</li>`;
      });
      linkedContent += '</ul>';
    }

    if (validKeyResults.length > 0) {
      linkedContent += '<p><strong>Linked Key Results:</strong></p><ul>';
      validKeyResults.forEach((kr: any) => {
        const progress = kr.progress?.toFixed(0) || 0;
        linkedContent += `<li>${kr.title} [${progress}%]</li>`;
      });
      linkedContent += '</ul>';
    }

    if (meeting.decisions && meeting.decisions.length > 0) {
      linkedContent += '<p><strong>Decisions:</strong></p><ul>';
      meeting.decisions.forEach((d: string) => {
        linkedContent += `<li>${d}</li>`;
      });
      linkedContent += '</ul>';
    }

    if (meeting.actionItems && meeting.actionItems.length > 0) {
      linkedContent += '<p><strong>Action Items:</strong></p><ul>';
      meeting.actionItems.forEach((a: string) => {
        linkedContent += `<li>${a}</li>`;
      });
      linkedContent += '</ul>';
    }

    if (meeting.risks && meeting.risks.length > 0) {
      linkedContent += '<p><strong>Risks:</strong></p><ul>';
      meeting.risks.forEach((r: string) => {
        linkedContent += `<li>${r}</li>`;
      });
      linkedContent += '</ul>';
    }

    if (linkedContent) {
      bodyContent = bodyContent.replace(insertBefore, linkedContent + insertBefore);
    }

    outlookEvent.body = {
      contentType: 'HTML',
      content: bodyContent,
    };

    const createdEvent = await createCalendarEventForUser(userId, calendarId || null, outlookEvent);

    res.json({
      success: true,
      eventId: createdEvent.id,
      subject: createdEvent.subject,
    });
  } catch (error: any) {
    console.error('[Outlook API] Schedule meeting error:', error);
    if (error.message?.includes('not connected') || error.message?.includes('unavailable') || error.message?.includes('token')) {
      return res.status(400).json({ error: 'Your Outlook connection may have expired. Please go to Settings and reconnect your Microsoft 365 account.', reason: 'token_expired' });
    }
    res.status(500).json({ error: 'Something went wrong scheduling to Outlook. Please try again, or reconnect in Settings if the problem persists.' });
  }
});

export const outlookRouter = router;
