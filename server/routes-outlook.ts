import { Router, Request, Response } from 'express';
import {
  getOutlookCalendars,
  getOutlookCalendarEvents,
  getOutlookEventDetails,
  getOutlookIntegrationStatus,
} from './services/graph-outlook';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const status = await getOutlookIntegrationStatus(userId);
    res.json(status);
  } catch (error: any) {
    console.error('[Outlook API] Status error:', error);
    res.status(500).json({ error: 'Failed to get Outlook status' });
  }
});

router.get('/calendars', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const calendars = await getOutlookCalendars(userId);
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
    const userId = (req.session as any)?.userId;
    if (!userId) {
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
      userId,
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
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { eventId } = req.params;
    const event = await getOutlookEventDetails(userId, eventId);

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

export const outlookRouter = router;
