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
  getSharePointSiteFromUrl,
  listSharePointLists,
  getSharePointListItems,
  listSharePointDocuments,
  listSharePointDrives,
  searchSharePointExcelFiles,
  // Shares API (direct URL access)
  resolveFileFromUrl,
  getSharePointFileFromUrl,
  // Combined status
  checkAllM365Connections,
  // Excel
  getExcelWorksheets,
  getExcelCellValue,
  searchExcelFiles,
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
    
    const site = await getSharePointSiteFromUrl(siteUrl);
    if (!site) {
      return res.status(404).json({ error: 'Could not find or access this SharePoint site' });
    }
    
    res.json(site);
  } catch (error: any) {
    console.error('Failed to resolve SharePoint site from URL:', error);
    res.status(500).json({ error: error.message });
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
    
    const result = await getSharePointFileFromUrl(fileUrl);
    if (!result) {
      return res.status(404).json({ 
        error: 'Could not access this file. Make sure the URL is correct and you have access to the file.' 
      });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error('Failed to resolve file from URL:', error);
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

// List SharePoint drives (document libraries)
router.get('/sharepoint/sites/:siteId/drives', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const drives = await listSharePointDrives(req.params.siteId);
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
    const files = await searchSharePointExcelFiles(req.params.siteId, q as string | undefined);
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
    
    const { sourceType, siteId } = req.query;
    const worksheets = await getExcelWorksheets(
      req.params.fileId,
      (sourceType as 'onedrive' | 'sharepoint') || 'onedrive',
      siteId as string | undefined
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
    
    const { cell, sourceType, siteId } = req.query;
    if (!cell) {
      return res.status(400).json({ error: 'Cell reference required (e.g., A1 or Sheet1!B5)' });
    }
    
    const cellValue = await getExcelCellValue(
      req.params.fileId,
      cell as string,
      (sourceType as 'onedrive' | 'sharepoint') || 'onedrive',
      siteId as string | undefined
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
      const cellValue = await getExcelCellValue(
        excelFileId,
        excelSheetName ? `${excelSheetName}!${excelCellReference}` : excelCellReference,
        excelSourceType as 'onedrive' | 'sharepoint'
      );
      
      if (cellValue.numberValue !== undefined) {
        excelLastSyncValue = cellValue.numberValue;
      } else {
        excelSyncError = 'Cell does not contain a numeric value';
      }
    } catch (err: any) {
      excelSyncError = `Failed to read cell: ${err.message}`;
    }
    
    // Update the key result with Excel binding
    const updatedKR = await storage.updateKeyResult(id, {
      excelSourceType,
      excelFileId,
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
    
    try {
      const cellRef = keyResult.excelSheetName 
        ? `${keyResult.excelSheetName}!${keyResult.excelCellReference}`
        : keyResult.excelCellReference;
      
      const cellValue = await getExcelCellValue(
        keyResult.excelFileId,
        cellRef,
        (keyResult.excelSourceType as 'onedrive' | 'sharepoint') || 'onedrive'
      );
      
      if (cellValue.numberValue !== undefined) {
        excelLastSyncValue = cellValue.numberValue;
      } else {
        excelSyncError = 'Cell does not contain a numeric value';
      }
    } catch (err: any) {
      excelSyncError = `Failed to read cell: ${err.message}`;
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
    
    res.json({
      success: !excelSyncError,
      keyResult: updatedKR,
      syncedValue: excelLastSyncValue,
      syncError: excelSyncError,
      previousValue: keyResult.currentValue,
    });
  } catch (error: any) {
    console.error('Failed to sync Key Result from Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
