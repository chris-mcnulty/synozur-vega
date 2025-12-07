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
  // OneDrive
  checkOneDriveConnection,
  listOneDriveRoot,
  listOneDriveFolder,
  getOneDriveItem,
  searchOneDrive,
  uploadOneDriveFile,
  createOneDriveFolder,
  deleteOneDriveItem,
  // SharePoint
  checkSharePointConnection,
  listSharePointSites,
  getSharePointSite,
  listSharePointLists,
  getSharePointListItems,
  listSharePointDocuments,
  // Combined status
  checkAllM365Connections,
} from './microsoftGraph';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await checkOutlookConnection();
    
    if (connected) {
      const outlookUser = await getCurrentUser();
      res.json({
        connected: true,
        user: outlookUser ? { displayName: outlookUser.displayName, email: outlookUser.mail } : null,
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
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
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

// ==================== Combined M365 Status ====================

router.get('/status/all', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const status = await checkAllM365Connections();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== OneDrive Routes ====================

router.get('/onedrive/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await checkOneDriveConnection();
    res.json({ connected });
  } catch (error: any) {
    res.json({ connected: false, error: error.message });
  }
});

router.get('/onedrive/files', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { folderId } = req.query;
    
    const files = folderId 
      ? await listOneDriveFolder(folderId as string)
      : await listOneDriveRoot();
    
    res.json(files);
  } catch (error: any) {
    console.error('Failed to list OneDrive files:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/onedrive/files/:itemId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const item = await getOneDriveItem(req.params.itemId);
    res.json(item);
  } catch (error: any) {
    console.error('Failed to get OneDrive item:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/onedrive/search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await searchOneDrive(q as string);
    res.json(results);
  } catch (error: any) {
    console.error('Failed to search OneDrive:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/onedrive/folders', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { name, parentFolderId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name required' });
    }
    
    const folder = await createOneDriveFolder(parentFolderId || null, name);
    res.json(folder);
  } catch (error: any) {
    console.error('Failed to create OneDrive folder:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/onedrive/files/:itemId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await deleteOneDriveItem(req.params.itemId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete OneDrive item:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SharePoint Routes ====================

router.get('/sharepoint/status', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const connected = await checkSharePointConnection();
    res.json({ connected });
  } catch (error: any) {
    res.json({ connected: false, error: error.message });
  }
});

router.get('/sharepoint/sites', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const sites = await listSharePointSites();
    res.json(sites);
  } catch (error: any) {
    console.error('Failed to list SharePoint sites:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sharepoint/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const site = await getSharePointSite(req.params.siteId);
    res.json(site);
  } catch (error: any) {
    console.error('Failed to get SharePoint site:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sharepoint/sites/:siteId/lists', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const lists = await listSharePointLists(req.params.siteId);
    res.json(lists);
  } catch (error: any) {
    console.error('Failed to list SharePoint lists:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sharepoint/sites/:siteId/lists/:listId/items', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const items = await getSharePointListItems(req.params.siteId, req.params.listId);
    res.json(items);
  } catch (error: any) {
    console.error('Failed to list SharePoint list items:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sharepoint/sites/:siteId/documents', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { driveId, folderId } = req.query;
    const documents = await listSharePointDocuments(
      req.params.siteId,
      driveId as string | undefined,
      folderId as string | undefined
    );
    res.json(documents);
  } catch (error: any) {
    console.error('Failed to list SharePoint documents:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
