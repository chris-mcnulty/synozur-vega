import { Router, Request, Response } from 'express';
import { storage } from './storage';
import {
  checkOutlookConnection,
  getCurrentUser,
  listCalendars,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  sendEmail,
  vegaMeetingToOutlookEvent,
  generateMeetingSummaryEmail,
} from './microsoftGraph';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const connected = await checkOutlookConnection();
    
    if (connected) {
      const user = await getCurrentUser();
      res.json({
        connected: true,
        user: user ? { displayName: user.displayName, email: user.mail } : null,
      });
    } else {
      res.json({ connected: false, user: null });
    }
  } catch (error: any) {
    res.json({ connected: false, user: null, error: error.message });
  }
});

router.get('/calendars', async (req: Request, res: Response) => {
  try {
    const connected = await checkOutlookConnection();
    if (!connected) {
      return res.status(401).json({ error: 'Outlook not connected' });
    }
    
    const calendars = await listCalendars();
    res.json(calendars);
  } catch (error: any) {
    console.error('Failed to list calendars:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/meetings/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { calendarId, durationMinutes = 60 } = req.body;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await checkOutlookConnection();
    if (!connected) {
      return res.status(401).json({ error: 'Outlook not connected. Please connect your Microsoft account.' });
    }
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const outlookEvent = vegaMeetingToOutlookEvent({
      title: meeting.title,
      date: meeting.date,
      attendees: meeting.attendees,
      agenda: meeting.agenda,
      summary: meeting.summary,
      meetingType: meeting.meetingType,
    }, durationMinutes);
    
    let syncedEvent;
    let syncStatus = 'synced';
    let syncError = null;
    
    try {
      if (meeting.outlookEventId) {
        syncedEvent = await updateCalendarEvent(meeting.outlookEventId, outlookEvent);
      } else {
        syncedEvent = await createCalendarEvent(calendarId || null, outlookEvent);
      }
    } catch (syncErr: any) {
      syncStatus = 'error';
      syncError = syncErr.message;
      console.error('Calendar sync error:', syncErr);
    }
    
    const updatedMeeting = await storage.updateMeeting(id, {
      outlookEventId: syncedEvent?.id || meeting.outlookEventId,
      outlookCalendarId: calendarId || meeting.outlookCalendarId,
      syncedAt: new Date(),
      syncStatus,
      syncError,
      updatedBy: user.id,
    });
    
    res.json({
      success: syncStatus === 'synced',
      meeting: updatedMeeting,
      outlookEventId: syncedEvent?.id,
      error: syncError,
    });
  } catch (error: any) {
    console.error('Failed to sync meeting to Outlook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/meetings/:id/unlink', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { deleteFromOutlook = false } = req.body;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (deleteFromOutlook && meeting.outlookEventId) {
      try {
        await deleteCalendarEvent(meeting.outlookEventId);
      } catch (err) {
        console.error('Failed to delete Outlook event:', err);
      }
    }
    
    const updatedMeeting = await storage.updateMeeting(id, {
      outlookEventId: null,
      outlookCalendarId: null,
      syncedAt: null,
      syncStatus: 'not_synced',
      syncError: null,
      updatedBy: user.id,
    });
    
    res.json({ success: true, meeting: updatedMeeting });
  } catch (error: any) {
    console.error('Failed to unlink meeting from Outlook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/meetings/:id/send-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { additionalRecipients = [] } = req.body;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await checkOutlookConnection();
    if (!connected) {
      return res.status(401).json({ error: 'Outlook not connected. Please connect your Microsoft account.' });
    }
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const allRecipients = [
      ...(meeting.attendees || []).filter((a: string) => a.includes('@')),
      ...additionalRecipients,
    ];
    
    if (allRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid email recipients. Add attendees with email addresses.' });
    }
    
    const emailMessage = generateMeetingSummaryEmail({
      title: meeting.title,
      date: meeting.date,
      attendees: meeting.attendees,
      summary: meeting.summary,
      decisions: meeting.decisions,
      actionItems: meeting.actionItems,
      risks: meeting.risks,
    }, allRecipients);
    
    let summaryEmailStatus = 'sent';
    let summaryEmailSentAt: Date | null = new Date();
    
    try {
      await sendEmail(emailMessage);
    } catch (emailErr: any) {
      summaryEmailStatus = 'failed';
      summaryEmailSentAt = null;
      console.error('Failed to send summary email:', emailErr);
      return res.status(500).json({ error: 'Failed to send email: ' + emailErr.message });
    }
    
    const updatedMeeting = await storage.updateMeeting(id, {
      summaryEmailStatus,
      summaryEmailSentAt,
      updatedBy: user.id,
    });
    
    res.json({
      success: true,
      meeting: updatedMeeting,
      recipientCount: allRecipients.length,
    });
  } catch (error: any) {
    console.error('Failed to send meeting summary:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/meetings/:id/outlook-event', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!meeting.outlookEventId) {
      return res.status(404).json({ error: 'Meeting not synced to Outlook' });
    }
    
    const event = await getCalendarEvent(meeting.outlookEventId);
    res.json(event);
  } catch (error: any) {
    console.error('Failed to get Outlook event:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
