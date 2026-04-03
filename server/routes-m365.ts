import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { hasPermission, PERMISSIONS, Role } from '@shared/rbac';
import {
  checkOutlookConnectionForUser, type OutlookConnectionStatus,
  getCurrentUser,
  listCalendarsForUser,
  listCalendarEventsForUser,
  createCalendarEventForUser,
  updateCalendarEventForUser,
  deleteCalendarEventForUser,
  getCalendarEventForUser,
  sendEmail,
  vegaMeetingToOutlookEvent,
  generateMeetingSummaryEmail,
  getFreeBusyForAttendees,
  computeSuggestedTimeSlots,
  localNineAMTomorrow,
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
  getSharePointSiteFromUrl,
  listSharePointLists,
  getSharePointListItems,
  listSharePointDocuments,
  listSharePointDrives,
  searchSharePointExcelFiles,
  // Shares API (direct URL access)
  resolveFileFromUrl,
  getSharePointFileFromUrl,
  getUserDrives,
  getDriveFiles,
  searchDriveForExcel,
  // Combined status
  checkAllM365Connections,
  // Excel
  getExcelWorksheets,
  getExcelCellValue,
  searchExcelFiles,
} from './microsoftGraph';

const router = Router();

function outlookDisconnectedError(status: OutlookConnectionStatus & { connected: false }) {
  return status.reason === 'token_expired'
    ? 'Your Outlook connection has expired. Please go to Settings and reconnect your Microsoft 365 account.'
    : 'Outlook is not yet connected. Please go to Settings and connect your Microsoft 365 account.';
}

function checkM365Permission(req: Request): boolean {
  const user = req.user;
  if (!user) return false;
  return hasPermission(user.role as Role, PERMISSIONS.USE_M365_FEATURES);
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }
    
    const userId = (user as any).id;
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    
    if (connectionStatus.connected) {
      let outlookUser = null;
      try {
        outlookUser = await getCurrentUser();
      } catch {
      }
      res.json({
        connected: true,
        user: outlookUser ? { displayName: outlookUser.displayName, email: outlookUser.mail } : null,
      });
    } else {
      res.json({ connected: false, user: null, reason: connectionStatus.reason });
    }
  } catch (error: any) {
    res.json({ connected: false, user: null, error: error.message });
  }
});

router.get('/calendars', async (req: Request, res: Response) => {
  try {
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }
    
    const userId = (req as any).user?.id;
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      return res.status(401).json({ error: outlookDisconnectedError(connectionStatus), reason: connectionStatus.reason });
    }
    
    const calendars = await listCalendarsForUser(userId);
    res.json(calendars);
  } catch (error: any) {
    console.error('Failed to list calendars:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/calendar/events', async (req: Request, res: Response) => {
  try {
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }
    
    const user = req.user!;
    const userId = user.id || (user as any).id;
    
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      return res.status(401).json({ error: outlookDisconnectedError(connectionStatus), reason: connectionStatus.reason });
    }
    
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const events = await listCalendarEventsForUser(userId, start, end);
    res.json(events);
  } catch (error: any) {
    console.error('Failed to list calendar events:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/calendar/events/:eventId', async (req: Request, res: Response) => {
  try {
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }
    
    const user = req.user!;
    const userId = user.id || (user as any).id;
    
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      return res.status(401).json({ error: outlookDisconnectedError(connectionStatus), reason: connectionStatus.reason });
    }
    
    const { eventId } = req.params;
    const event = await getCalendarEventForUser(userId, eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error: any) {
    console.error('Failed to get calendar event:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/meetings/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { calendarId, durationMinutes = 60, startDateTime, meetingTime } = req.body;
    const user = req.user!;
    const userId = user.id || (user as any).id;
    
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }
    
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      return res.status(401).json({ error: outlookDisconnectedError(connectionStatus), reason: connectionStatus.reason });
    }
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Use organizer-confirmed startDateTime (from availability suggestions or manual picker) if provided
    let effectiveDate = meeting.date;
    if (startDateTime) {
      const parsedStart = new Date(startDateTime);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ error: 'Invalid startDateTime value' });
      }
      effectiveDate = parsedStart;
    }
    
    const appBaseUrl = `${req.protocol}://${req.get('host')}`;
    const outlookEvent = vegaMeetingToOutlookEvent({
      title: meeting.title,
      date: effectiveDate,
      attendees: meeting.attendees,
      agenda: meeting.agenda,
      summary: meeting.summary,
      meetingType: meeting.meetingType,
      meetingUrl: `${appBaseUrl}/focus-rhythm/${id}`,
    }, durationMinutes);
    
    let syncedEvent;
    let syncError: string | null = null;

    try {
      if (meeting.outlookEventId) {
        syncedEvent = await updateCalendarEventForUser(userId, meeting.outlookEventId, outlookEvent);
      } else {
        syncedEvent = await createCalendarEventForUser(userId, calendarId || null, outlookEvent);
      }
    } catch (syncErr: any) {
      syncError = syncErr.message || 'Failed to create calendar event';
      console.error('Calendar sync error:', syncErr);
    }

    if (syncError) {
      // Record the failure but return a proper error so the client onError handler fires
      await storage.updateMeeting(id, {
        syncedAt: new Date(),
        syncStatus: 'error',
        syncError,
        updatedBy: user.id,
      });
      return res.status(502).json({ error: `Outlook calendar error: ${syncError}` });
    }

    const meetingUpdate: Record<string, any> = {
      outlookEventId: syncedEvent?.id || meeting.outlookEventId,
      outlookCalendarId: calendarId || meeting.outlookCalendarId,
      syncedAt: new Date(),
      syncStatus: 'synced',
      syncError: null,
      updatedBy: user.id,
    };
    // When the organizer picks a specific start time, persist it back to the meeting
    // so the Vega UI reflects the confirmed date/time (not the old placeholder date).
    if (startDateTime && effectiveDate) {
      meetingUpdate.date = effectiveDate;
      // Also persist the local meetingTime ("HH:mm") so the Clock row appears in the UI.
      if (meetingTime && typeof meetingTime === 'string' && /^\d{2}:\d{2}$/.test(meetingTime)) {
        meetingUpdate.meetingTime = meetingTime;
      }
    }
    // Persist the confirmed duration so it's reflected in the meeting card.
    if (typeof durationMinutes === 'number' && durationMinutes > 0) {
      meetingUpdate.duration = durationMinutes;
    }
    const updatedMeeting = await storage.updateMeeting(id, meetingUpdate);

    res.json({
      success: true,
      meeting: updatedMeeting,
      outlookEventId: syncedEvent?.id,
    });
  } catch (error: any) {
    console.error('Failed to sync meeting to Outlook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/suggest-times', async (req: Request, res: Response) => {
  try {
    if (!checkM365Permission(req)) {
      return res.status(403).json({ error: 'M365 features not available for your role' });
    }

    const user = req.user!;
    const userId = user.id || (user as any).id;

    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      const msg = connectionStatus.reason === 'token_expired'
        ? 'Your Outlook connection has expired. Please go to Settings and reconnect your Microsoft 365 account.'
        : 'Outlook is not yet connected. Please go to Settings and connect your Microsoft 365 account.';
      return res.status(401).json({ error: msg, reason: connectionStatus.reason });
    }

    const { attendeeEmails, durationMinutes: rawDuration = 60, windowStartDate, windowEndDate, timezone } = req.body;
    const durationMinutes = Number(rawDuration);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
      return res.status(400).json({ error: 'durationMinutes must be an integer between 1 and 480' });
    }

    if (!attendeeEmails || !Array.isArray(attendeeEmails) || attendeeEmails.length === 0) {
      return res.status(400).json({ error: 'attendeeEmails array is required' });
    }

    const validEmails = attendeeEmails.filter((e: any) => typeof e === 'string' && e.includes('@'));
    if (validEmails.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses provided' });
    }

    // Validate the timezone string first — needed for window start fallback and slot filtering
    let organizerTimezone = 'UTC';
    if (timezone && typeof timezone === 'string') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        organizerTimezone = timezone;
      } catch {
        // Invalid timezone — silently fall back to UTC
      }
    }

    const windowStart = windowStartDate ? new Date(windowStartDate) : localNineAMTomorrow(organizerTimezone);
    if (isNaN(windowStart.getTime())) {
      return res.status(400).json({ error: 'Invalid windowStartDate value' });
    }

    const windowEnd = windowEndDate ? new Date(windowEndDate) : (() => {
      const d = new Date(windowStart);
      d.setDate(d.getDate() + 7);
      return d;
    })();
    if (isNaN(windowEnd.getTime())) {
      return res.status(400).json({ error: 'Invalid windowEndDate value' });
    }

    if (windowEnd.getTime() - windowStart.getTime() < durationMinutes * 60 * 1000) {
      return res.status(400).json({ error: 'Search window is too small for the requested duration' });
    }

    const schedules = await getFreeBusyForAttendees(userId, validEmails, windowStart, windowEnd);
    const suggestions = computeSuggestedTimeSlots(schedules, durationMinutes, windowStart, windowEnd, 5, organizerTimezone);

    // If ALL attendees returned a Graph-level error (e.g. mailbox not found, access denied),
    // we genuinely have no useful availability data — flag for the UI to fall back to manual.
    const noData = schedules.length > 0 && schedules.every(s => !!s.error);

    res.json({
      suggestions,
      noData,
      attendeeCount: validEmails.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  } catch (error: any) {
    console.error('[M365] suggest-times error:', error);
    if (error.message?.includes('not connected') || error.message?.includes('unavailable') || error.message?.includes('token')) {
      return res.status(401).json({ error: 'Your Outlook connection may have expired. Please go to Settings and reconnect your Microsoft 365 account.', reason: 'token_expired' });
    }
    res.status(500).json({ error: error.message || 'Failed to fetch availability suggestions' });
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
    
    const userId = user.id || (user as any).id;
    
    const meeting = await storage.getMeetingById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    if (meeting.tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (deleteFromOutlook && meeting.outlookEventId) {
      try {
        await deleteCalendarEventForUser(userId, meeting.outlookEventId);
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
    
    const userId = user.id || (user as any).id;
    
    const connectionStatus = await checkOutlookConnectionForUser(userId);
    if (!connectionStatus.connected) {
      return res.status(401).json({ error: outlookDisconnectedError(connectionStatus), reason: connectionStatus.reason });
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
    
    const appBaseUrl = `${req.protocol}://${req.get('host')}`;
    const emailMessage = generateMeetingSummaryEmail({
      title: meeting.title,
      date: meeting.date,
      attendees: meeting.attendees,
      summary: meeting.summary,
      decisions: meeting.decisions,
      actionItems: meeting.actionItems,
      risks: meeting.risks,
      meetingUrl: `${appBaseUrl}/focus-rhythm/${id}`,
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
    
    const event = await getCalendarEventForUser(user.id, meeting.outlookEventId);
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
    
    const connected = await checkSharePointConnection(user.id);
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
    
    const sites = await listSharePointSites(user.id);
    res.json(sites);
  } catch (error: any) {
    console.error('Failed to list SharePoint sites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve a SharePoint site from URL
router.post('/sharepoint/resolve-url', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { siteUrl } = req.body;
    if (!siteUrl) {
      return res.status(400).json({ error: 'Site URL is required' });
    }
    
    const site = await getSharePointSiteFromUrl(siteUrl, user.id);
    if (!site) {
      return res.status(404).json({ error: 'Could not find or access this SharePoint site. Check the URL and your permissions.' });
    }
    
    res.json(site);
  } catch (error: any) {
    console.error('Failed to resolve SharePoint site from URL:', error);
    // Check for token expiration
    if (error.code === 'TOKEN_EXPIRED' || error.message?.includes('expired') || error.message?.includes('log out')) {
      return res.status(401).json({ 
        error: 'Your Microsoft 365 session has expired. Please log out and log back in to reconnect.',
        code: 'TOKEN_EXPIRED'
      });
    }
    res.status(500).json({ error: error.message || 'Failed to access SharePoint site' });
  }
});

// Resolve a file directly from its SharePoint/OneDrive URL
// This uses the Shares API and works with Files.Read permission
router.post('/sharepoint/resolve-file', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }
    
    // Pass userId to use user's delegated token for multi-tenant SharePoint access
    const result = await getSharePointFileFromUrl(fileUrl, user.id);
    if (!result) {
      return res.status(404).json({ 
        error: 'Could not access this file. Make sure the URL is correct and you have access to the file.' 
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Failed to resolve file from URL:', error);
    // Return more specific error message
    const errorCode = error.code || error.statusCode;
    let errorMessage = 'Could not access file';
    
    if (errorCode === 'accessDenied' || errorCode === 403) {
      errorMessage = 'Access denied. Make sure you have permission to view this file.';
    } else if (errorCode === 'itemNotFound' || errorCode === 404) {
      errorMessage = 'File not found. Check that the URL is correct.';
    } else if (errorCode === 'invalidRequest' || errorCode === 400) {
      errorMessage = 'Invalid URL format. Please copy the URL directly from your browser when viewing the file.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(error.statusCode || 500).json({ error: errorMessage });
  }
});

// Get all drives the user has access to (OneDrive + SharePoint)
router.get('/drives', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const drives = await getUserDrives();
    res.json(drives);
  } catch (error: any) {
    console.error('Failed to get user drives:', error);
    res.status(500).json({ error: error.message });
  }
});

// Browse files in a specific drive
router.get('/drives/:driveId/files', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { driveId } = req.params;
    const { folderId } = req.query;
    
    // Pass userId to use user's delegated token for SharePoint access
    const files = await getDriveFiles(driveId, folderId as string | undefined, user.id);
    res.json(files);
  } catch (error: any) {
    console.error('Failed to get drive files:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search for Excel files in a drive
router.get('/drives/:driveId/search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { driveId } = req.params;
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Pass userId to use user's delegated token for SharePoint access
    const files = await searchDriveForExcel(driveId, q as string, user.id);
    res.json(files);
  } catch (error: any) {
    console.error('Failed to search drive:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/sharepoint/sites/:siteId', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const site = await getSharePointSite(req.params.siteId, user.id);
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
    
    const lists = await listSharePointLists(req.params.siteId, user.id);
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
    
    const items = await getSharePointListItems(req.params.siteId, req.params.listId, true, user.id);
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
      folderId as string | undefined,
      user.id // Pass user ID for delegated token access
    );
    res.json(documents);
  } catch (error: any) {
    console.error('Failed to list SharePoint documents:', error);
    res.status(500).json({ error: error.message });
  }
});

// List SharePoint drives (document libraries)
router.get('/sharepoint/sites/:siteId/drives', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const drives = await listSharePointDrives(req.params.siteId, user.id);
    res.json(drives);
  } catch (error: any) {
    console.error('Failed to list SharePoint drives:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search Excel files in SharePoint site
router.get('/sharepoint/sites/:siteId/excel-search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { q } = req.query;
    const files = await searchSharePointExcelFiles(req.params.siteId, q as string | undefined, user.id);
    res.json(files);
  } catch (error: any) {
    console.error('Failed to search SharePoint Excel files:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Excel Integration Routes ====================

router.get('/excel/search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { q } = req.query;
    const files = await searchExcelFiles(q as string || '');
    res.json(files);
  } catch (error: any) {
    console.error('Failed to search Excel files:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/excel/files/:fileId/worksheets', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { sourceType, siteId, driveId } = req.query;
    // Pass userId to use user's delegated token for SharePoint files
    const worksheets = await getExcelWorksheets(
      req.params.fileId,
      (sourceType as 'onedrive' | 'sharepoint') || 'onedrive',
      siteId as string | undefined,
      driveId as string | undefined,
      user.id
    );
    res.json(worksheets);
  } catch (error: any) {
    console.error('Failed to get Excel worksheets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/excel/files/:fileId/cell', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { cell, sourceType, siteId, driveId } = req.query;
    if (!cell) {
      return res.status(400).json({ error: 'Cell reference required (e.g., A1 or Sheet1!B5)' });
    }
    
    // Pass userId to use user's delegated token for SharePoint files
    const cellValue = await getExcelCellValue(
      req.params.fileId,
      cell as string,
      (sourceType as 'onedrive' | 'sharepoint') || 'onedrive',
      siteId as string | undefined,
      driveId as string | undefined,
      user.id
    );
    res.json(cellValue);
  } catch (error: any) {
    console.error('Failed to get Excel cell value:', error);
    res.status(500).json({ error: error.message });
  }
});

// Link a Key Result to an Excel cell
router.post('/key-results/:id/link-excel', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { id } = req.params;
    const { 
      excelSourceType,
      excelFileId,
      excelDriveId,
      excelFileName,
      excelFilePath,
      excelSheetName,
      excelCellReference,
      excelAutoSync
    } = req.body;
    
    // Validate required fields
    if (!excelSourceType || !excelFileId || !excelCellReference) {
      return res.status(400).json({ 
        error: 'Missing required fields: excelSourceType, excelFileId, excelCellReference' 
      });
    }
    
    // Get the key result and verify access
    const keyResult = await storage.getKeyResultById(id);
    if (!keyResult) {
      return res.status(404).json({ error: 'Key Result not found' });
    }
    
    if (keyResult.tenantId !== user.tenantId && !['admin', 'vega_consultant', 'vega_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Try to fetch the initial value from Excel
    let excelLastSyncValue: number | null = null;
    let excelSyncError: string | null = null;
    
    try {
      // Use driveId for SharePoint files (more reliable API path)
      // Pass userId to use user's delegated token for SharePoint access
      const cellValue = await getExcelCellValue(
        excelFileId,
        excelSheetName ? `${excelSheetName}!${excelCellReference}` : excelCellReference,
        excelSourceType as 'onedrive' | 'sharepoint',
        undefined, // siteId - not needed when we have driveId
        excelDriveId || undefined,
        user.id
      );
      
      if (cellValue.numberValue !== undefined) {
        excelLastSyncValue = cellValue.numberValue;
      } else {
        excelSyncError = 'Cell does not contain a numeric value';
      }
    } catch (err: any) {
      console.error('[Excel] Failed to read cell during link:', err);
      excelSyncError = `Failed to read cell: ${err.message}`;
    }
    
    // Update the key result with Excel binding
    const updatedKR = await storage.updateKeyResult(id, {
      excelSourceType,
      excelFileId,
      excelDriveId: excelDriveId || null,
      excelFileName: excelFileName || null,
      excelFilePath: excelFilePath || null,
      excelSheetName: excelSheetName || null,
      excelCellReference,
      excelLastSyncAt: new Date(),
      excelLastSyncValue,
      excelSyncError,
      excelAutoSync: excelAutoSync ?? false,
      // Optionally update the current value if we got a valid number
      ...(excelLastSyncValue !== null && !excelSyncError ? { currentValue: excelLastSyncValue } : {}),
      updatedBy: user.id,
    });
    
    res.json({
      success: true,
      keyResult: updatedKR,
      syncedValue: excelLastSyncValue,
      syncError: excelSyncError,
    });
  } catch (error: any) {
    console.error('Failed to link Key Result to Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unlink a Key Result from Excel
router.delete('/key-results/:id/link-excel', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { id } = req.params;
    
    const keyResult = await storage.getKeyResultById(id);
    if (!keyResult) {
      return res.status(404).json({ error: 'Key Result not found' });
    }
    
    if (keyResult.tenantId !== user.tenantId && !['admin', 'vega_consultant', 'vega_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Clear all Excel-related fields
    const updatedKR = await storage.updateKeyResult(id, {
      excelSourceType: null,
      excelFileId: null,
      excelDriveId: null,
      excelFileName: null,
      excelFilePath: null,
      excelSheetName: null,
      excelCellReference: null,
      excelLastSyncAt: null,
      excelLastSyncValue: null,
      excelSyncError: null,
      excelAutoSync: false,
      updatedBy: user.id,
    });
    
    res.json({ success: true, keyResult: updatedKR });
  } catch (error: any) {
    console.error('Failed to unlink Key Result from Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync a Key Result's value from Excel
router.post('/key-results/:id/sync-excel', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { id } = req.params;
    const { updateCurrentValue } = req.body;
    
    const keyResult = await storage.getKeyResultById(id);
    if (!keyResult) {
      return res.status(404).json({ error: 'Key Result not found' });
    }
    
    if (keyResult.tenantId !== user.tenantId && !['admin', 'vega_consultant', 'vega_admin'].includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!keyResult.excelFileId || !keyResult.excelCellReference) {
      return res.status(400).json({ error: 'Key Result is not linked to an Excel source' });
    }
    
    // Fetch the current value from Excel
    let excelLastSyncValue: number | null = null;
    let excelSyncError: string | null = null;
    
    let needsRelink = false;
    try {
      const cellRef = keyResult.excelSheetName 
        ? `${keyResult.excelSheetName}!${keyResult.excelCellReference}`
        : keyResult.excelCellReference;
      
      // Pass userId to use user's delegated token for SharePoint access
      const cellValue = await getExcelCellValue(
        keyResult.excelFileId,
        cellRef,
        (keyResult.excelSourceType as 'onedrive' | 'sharepoint') || 'onedrive',
        undefined, // siteId - not needed when we have driveId
        keyResult.excelDriveId || undefined,
        user.id
      );
      
      if (cellValue.numberValue !== undefined) {
        excelLastSyncValue = cellValue.numberValue;
      } else {
        excelSyncError = 'Cell does not contain a numeric value';
      }
    } catch (err: any) {
      console.error('[Excel] Failed to read cell during sync:', err);
      // Detect token/auth failures and surface them as a reconnect prompt
      needsRelink = /token|expired|unauthorized|unauthenticated|forbidden|401|403/i.test(err.message || '');
      excelSyncError = needsRelink
        ? 'Microsoft 365 token expired — please reconnect your OneDrive/SharePoint account via My Settings'
        : `Failed to read cell: ${err.message}`;
    }
    
    // Update the key result
    const updateData: any = {
      excelLastSyncAt: new Date(),
      excelLastSyncValue,
      excelSyncError,
      updatedBy: user.id,
    };
    
    // Optionally update the current value
    if (updateCurrentValue !== false && excelLastSyncValue !== null && !excelSyncError) {
      updateData.currentValue = excelLastSyncValue;
      
      // Recalculate progress based on new value
      const initial = keyResult.initialValue ?? 0;
      const target = keyResult.targetValue ?? 100;
      const range = target - initial;
      
      if (range !== 0) {
        const progress = Math.min(100, Math.max(0, ((excelLastSyncValue - initial) / range) * 100));
        updateData.progress = progress;
      }
    }
    
    const updatedKR = await storage.updateKeyResult(id, updateData);
    
    // Create a check-in record if value changed and sync was successful
    if (updateCurrentValue !== false && excelLastSyncValue !== null && !excelSyncError) {
      const previousValue = keyResult.currentValue ?? keyResult.initialValue ?? 0;
      const valueChanged = excelLastSyncValue !== previousValue;
      
      if (valueChanged) {
        const initial = keyResult.initialValue ?? 0;
        const target = keyResult.targetValue ?? 100;
        const range = target - initial;
        const newProgress = range !== 0 
          ? Math.min(100, Math.max(0, ((excelLastSyncValue - initial) / range) * 100))
          : 0;
        const previousProgress = range !== 0 
          ? Math.min(100, Math.max(0, ((previousValue - initial) / range) * 100))
          : 0;
        
        try {
          await storage.createCheckIn({
            tenantId: keyResult.tenantId,
            entityType: 'key_result',
            entityId: id,
            previousValue: previousValue,
            newValue: excelLastSyncValue,
            previousProgress: previousProgress,
            newProgress: newProgress,
            note: `Auto-synced from Excel: ${keyResult.excelFileName || 'linked file'}`,
            userId: user.id,
            userEmail: user.email,
            asOfDate: new Date() as any,
          });
          console.log(`[Excel] Created check-in for KR ${id}: ${previousValue} → ${excelLastSyncValue}`);
        } catch (checkInErr) {
          console.error('[Excel] Failed to create check-in:', checkInErr);
        }
      }
    }
    
    res.json({
      success: !excelSyncError,
      keyResult: updatedKR,
      syncedValue: excelLastSyncValue,
      syncError: excelSyncError,
      needsRelink,
      previousValue: keyResult.currentValue,
    });
  } catch (error: any) {
    console.error('Failed to sync Key Result from Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
