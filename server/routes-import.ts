import express, { type Request, type Response, Router } from 'express';
import multer from 'multer';
import { VivaGoalsImporter } from './viva-goals-importer';
import { storage } from './storage';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  },
});

// Import options validation schema
const importOptionsSchema = z.object({
  duplicateStrategy: z.enum(['skip', 'merge', 'create']).default('skip'),
  importCheckIns: z.boolean().default(true),
  importTeams: z.boolean().default(true),
  fiscalYearStartMonth: z.number().min(1).max(12).default(1),
});

/**
 * POST /api/import/viva-goals
 * Upload and import Viva Goals export ZIP file
 */
router.post('/viva-goals', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user and tenant info
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.tenantId) {
      return res.status(403).json({ error: 'User must belong to a tenant' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse and validate import options from form data
    let options;
    try {
      const rawOptions = req.body.options ? JSON.parse(req.body.options) : {};
      options = importOptionsSchema.parse(rawOptions);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid import options', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Create importer instance
    const importer = new VivaGoalsImporter({
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      ...options,
    });

    // Parse the ZIP file
    const parseResult = await importer.importFromZip(req.file.buffer);

    // Execute the import (create entities in database)
    const importResult = await importer.executeImport(storage);

    // Record import history
    try {
      await storage.createImportHistory({
        tenantId: user.tenantId,
        importType: 'viva_goals',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        status: importResult.status,
        objectivesCreated: importResult.summary.objectivesCreated,
        keyResultsCreated: importResult.summary.keyResultsCreated,
        bigRocksCreated: importResult.summary.bigRocksCreated,
        checkInsCreated: importResult.summary.checkInsCreated,
        teamsCreated: importResult.summary.teamsCreated,
        warnings: importResult.warnings,
        errors: importResult.errors,
        skippedItems: importResult.skippedItems,
        duplicateStrategy: options.duplicateStrategy,
        fiscalYearStartMonth: options.fiscalYearStartMonth,
        importedBy: user.id,
      });
    } catch (historyError) {
      console.error('Failed to record import history:', historyError);
      // Don't fail the import if history recording fails
    }

    // Return import results
    res.json({
      success: importResult.status !== 'failed',
      ...importResult,
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/import/history
 * Get import history for current tenant
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !user.tenantId) {
      return res.status(403).json({ error: 'User must belong to a tenant' });
    }

    const history = await storage.getImportHistory(user.tenantId);
    res.json(history);

  } catch (error) {
    console.error('Error fetching import history:', error);
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

export { router as importRouter };
