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
 * Note: Routes are protected by adminOnly middleware at registration
 */
router.post('/viva-goals', upload.single('file'), async (req: Request, res: Response) => {
  try {
    // User is guaranteed by adminOnly middleware
    const user = req.user!;

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

    // Use tenant from request body (from dropdown) or fall back to effectiveTenantId
    const targetTenantId = req.body.tenantId || req.effectiveTenantId;
    if (!targetTenantId) {
      return res.status(400).json({ error: 'No tenant selected for import' });
    }

    // Create importer instance
    const importer = new VivaGoalsImporter({
      tenantId: targetTenantId,
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
        tenantId: targetTenantId,
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

/**
 * GET /api/import/export-cos
 * Export Company OS data as JSON (.cos file)
 */
router.get('/export-cos', async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !user.tenantId) {
      return res.status(403).json({ error: 'User must belong to a tenant' });
    }

    // Use x-tenant-id header for tenant switching support (consultants/admins)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const tenantId = headerTenantId || user.tenantId;
    const tenant = await storage.getTenantById(tenantId);

    // Gather all Company OS data including teams
    const [
      foundation,
      strategies,
      objectives,
      bigRocks,
      groundingDocuments,
      teams,
    ] = await Promise.all([
      storage.getFoundationByTenantId(tenantId),
      storage.getStrategiesByTenantId(tenantId),
      storage.getObjectivesByTenantId(tenantId),
      storage.getBigRocksByTenantId(tenantId),
      storage.getTenantGroundingDocuments(tenantId),
      storage.getTeamsByTenantId(tenantId),
    ]);

    // Wrap foundation in array for export (there's only one per tenant)
    const foundations = foundation ? [foundation] : [];

    // Get all Key Results for the objectives
    const keyResults = await Promise.all(
      objectives.map((obj: any) => storage.getKeyResultsByObjectiveId(obj.id))
    ).then(results => results.flat());

    // Get check-ins for objectives, key results, and big rocks
    const checkIns: any[] = [];
    for (const obj of objectives) {
      const objCheckIns = await storage.getCheckInsByEntityId('objective', obj.id);
      checkIns.push(...objCheckIns);
    }
    for (const kr of keyResults) {
      const krCheckIns = await storage.getCheckInsByEntityId('key_result', kr.id);
      checkIns.push(...krCheckIns);
    }
    for (const br of bigRocks) {
      const brCheckIns = await storage.getCheckInsByEntityId('big_rock', br.id);
      checkIns.push(...brCheckIns);
    }

    // Build export object
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      tenant: {
        name: tenant?.name,
        id: tenantId,
      },
      data: {
        foundations,
        strategies,
        objectives,
        keyResults,
        bigRocks,
        checkIns,
        groundingDocuments,
        teams,
      },
      metadata: {
        counts: {
          foundations: foundations.length,
          strategies: strategies.length,
          objectives: objectives.length,
          keyResults: keyResults.length,
          bigRocks: bigRocks.length,
          checkIns: checkIns.length,
          groundingDocuments: groundingDocuments.length,
          teams: teams.length,
        },
      },
    };

    // Set headers for file download
    const fileName = `company-os-export-${new Date().toISOString().split('T')[0]}.cos`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: 'Export failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Configure multer for .cos file uploads
const cosUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept .cos and .json files
    if (file.originalname.endsWith('.cos') || file.originalname.endsWith('.json') || 
        file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only .cos or .json files are allowed'));
    }
  },
});

// Import options for COS files
const cosImportOptionsSchema = z.object({
  duplicateStrategy: z.enum(['skip', 'replace', 'create']).default('skip'),
  importCheckIns: z.boolean().default(true),
});

/**
 * POST /api/import/import-cos
 * Import Company OS data from .cos file
 */
router.post('/import-cos', cosUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user || !user.tenantId) {
      return res.status(403).json({ error: 'User must belong to a tenant' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse options
    let options;
    try {
      const rawOptions = req.body.options ? JSON.parse(req.body.options) : {};
      options = cosImportOptionsSchema.parse(rawOptions);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid import options', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }

    // Parse the uploaded file
    let importData;
    try {
      const fileContent = req.file.buffer.toString('utf-8');
      importData = JSON.parse(fileContent);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid JSON file' });
    }

    // Validate file structure
    if (!importData.version || !importData.data) {
      return res.status(400).json({ error: 'Invalid .cos file format' });
    }

    // Use x-tenant-id header for tenant switching support (consultants/admins)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const targetTenantId = headerTenantId || user.tenantId;
    const results = {
      teams: { created: 0, updated: 0, skipped: 0, errors: 0 },
      foundations: { created: 0, updated: 0, skipped: 0, errors: 0 },
      strategies: { created: 0, updated: 0, skipped: 0, errors: 0 },
      objectives: { created: 0, updated: 0, skipped: 0, errors: 0 },
      keyResults: { created: 0, updated: 0, skipped: 0, errors: 0 },
      bigRocks: { created: 0, updated: 0, skipped: 0, errors: 0 },
      checkIns: { created: 0, updated: 0, skipped: 0, errors: 0 },
      groundingDocuments: { created: 0, updated: 0, skipped: 0, errors: 0 },
    };

    // Map old IDs to new IDs for relationships
    const idMap = new Map<string, string>();

    // Pre-fetch existing data for efficiency (avoid repeated lookups in loops)
    const [existingFoundation, existingStrategies, existingObjectives, existingBigRocks, existingGroundingDocs, existingTeams] = await Promise.all([
      storage.getFoundationByTenantId(targetTenantId),
      storage.getStrategiesByTenantId(targetTenantId),
      storage.getObjectivesByTenantId(targetTenantId),
      storage.getBigRocksByTenantId(targetTenantId),
      storage.getTenantGroundingDocuments(targetTenantId),
      storage.getTeamsByTenantId(targetTenantId),
    ]);

    // Import teams FIRST (so objectives can reference them)
    if (importData.data.teams) {
      for (const team of importData.data.teams) {
        try {
          const existingMatch = existingTeams.find((t: any) => t.name === team.name);
          
          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(team.id, existingMatch.id);
              results.teams.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateTeam(existingMatch.id, {
                description: team.description,
                managerId: team.managerId,
                parentTeamId: team.parentTeamId ? idMap.get(team.parentTeamId) : null,
                metadata: team.metadata,
              });
              idMap.set(team.id, existingMatch.id);
              results.teams.updated++;
            } else {
              const newTeam = await storage.createTeam({
                tenantId: targetTenantId,
                name: team.name,
                description: team.description,
                managerId: team.managerId,
                parentTeamId: team.parentTeamId ? idMap.get(team.parentTeamId) : null,
                metadata: team.metadata,
              });
              idMap.set(team.id, newTeam.id);
              results.teams.created++;
            }
          } else {
            const newTeam = await storage.createTeam({
              tenantId: targetTenantId,
              name: team.name,
              description: team.description,
              managerId: team.managerId,
              parentTeamId: team.parentTeamId ? idMap.get(team.parentTeamId) : null,
              metadata: team.metadata,
            });
            idMap.set(team.id, newTeam.id);
            results.teams.created++;
          }
        } catch (err) {
          console.error('Error importing team:', err);
          results.teams.errors++;
        }
      }
    }

    // Import foundations (only one per tenant, uses upsert)
    if (importData.data.foundations && importData.data.foundations.length > 0) {
      // Take the first foundation from import (there should only be one per tenant)
      const foundationData = importData.data.foundations[0];
      try {
        if (existingFoundation) {
          if (options.duplicateStrategy === 'skip') {
            idMap.set(foundationData.id, existingFoundation.id);
            results.foundations.skipped++;
          } else {
            // For 'replace' or 'create', upsert the foundation
            const updated = await storage.upsertFoundation({
              tenantId: targetTenantId,
              mission: foundationData.mission,
              vision: foundationData.vision,
              values: foundationData.values,
              annualGoals: foundationData.annualGoals,
              fiscalYearStartMonth: foundationData.fiscalYearStartMonth,
              tagline: foundationData.tagline,
              companySummary: foundationData.companySummary,
              messagingStatement: foundationData.messagingStatement,
              cultureStatement: foundationData.cultureStatement,
              brandVoice: foundationData.brandVoice,
              updatedBy: user.id,
            });
            idMap.set(foundationData.id, updated.id);
            results.foundations.updated++;
          }
        } else {
          // No existing foundation, create new
          const created = await storage.upsertFoundation({
            tenantId: targetTenantId,
            mission: foundationData.mission,
            vision: foundationData.vision,
            values: foundationData.values,
            annualGoals: foundationData.annualGoals,
            fiscalYearStartMonth: foundationData.fiscalYearStartMonth,
            tagline: foundationData.tagline,
            companySummary: foundationData.companySummary,
            messagingStatement: foundationData.messagingStatement,
            cultureStatement: foundationData.cultureStatement,
            brandVoice: foundationData.brandVoice,
            updatedBy: user.id,
          });
          idMap.set(foundationData.id, created.id);
          results.foundations.created++;
        }
      } catch (err) {
        console.error('Error importing foundation:', err);
        results.foundations.errors++;
      }
    }

    // Import strategies
    if (importData.data.strategies) {
      for (const strategy of importData.data.strategies) {
        try {
          const existingMatch = existingStrategies.find(s => s.title === strategy.title);
          
          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(strategy.id, existingMatch.id);
              results.strategies.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateStrategy(existingMatch.id, {
                description: strategy.description,
                status: strategy.status || 'active',
                linkedGoals: strategy.linkedGoals || [],
              });
              idMap.set(strategy.id, existingMatch.id);
              results.strategies.updated++;
            } else {
              const newStrategy = await storage.createStrategy({
                tenantId: targetTenantId,
                title: strategy.title,
                description: strategy.description,
                status: strategy.status || 'active',
                linkedGoals: strategy.linkedGoals || [],
              });
              idMap.set(strategy.id, newStrategy.id);
              results.strategies.created++;
            }
          } else {
            const newStrategy = await storage.createStrategy({
              tenantId: targetTenantId,
              title: strategy.title,
              description: strategy.description,
              status: strategy.status || 'active',
              linkedGoals: strategy.linkedGoals || [],
            });
            idMap.set(strategy.id, newStrategy.id);
            results.strategies.created++;
          }
        } catch (err) {
          console.error('Error importing strategy:', err);
          results.strategies.errors++;
        }
      }
    }

    // Import objectives
    if (importData.data.objectives) {
      for (const objective of importData.data.objectives as any[]) {
        try {
          const existingMatch = existingObjectives.find((o: any) => o.title === objective.title);
          const parentId = objective.parentId ? idMap.get(objective.parentId) : undefined;
          // Map teamId to new team ID if the team was imported
          const teamId = objective.teamId ? idMap.get(objective.teamId) || null : null;
          
          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(objective.id, existingMatch.id);
              results.objectives.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateObjective(existingMatch.id, {
                description: objective.description,
                parentId: parentId,
                teamId: teamId,
                level: objective.level || 'organization',
                quarter: objective.quarter,
                year: objective.year,
                progress: objective.progress || 0,
                progressMode: objective.progressMode || 'rollup',
                status: objective.status || 'on_track',
                linkedStrategies: objective.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
                linkedGoals: objective.linkedGoals || [],
                linkedValues: objective.linkedValues || [],
              } as any);
              idMap.set(objective.id, existingMatch.id);
              results.objectives.updated++;
            } else {
              const newObjective = await storage.createObjective({
                tenantId: targetTenantId,
                title: objective.title,
                description: objective.description,
                ownerId: user.id,
                ownerEmail: user.email,
                parentId: parentId,
                teamId: teamId,
                level: objective.level || 'organization',
                quarter: objective.quarter,
                year: objective.year,
                progress: objective.progress || 0,
                progressMode: objective.progressMode || 'rollup',
                status: objective.status || 'on_track',
                linkedStrategies: objective.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
                linkedGoals: objective.linkedGoals || [],
                linkedValues: objective.linkedValues || [],
              } as any);
              idMap.set(objective.id, newObjective.id);
              results.objectives.created++;
            }
          } else {
            const newObjective = await storage.createObjective({
              tenantId: targetTenantId,
              title: objective.title,
              description: objective.description,
              ownerId: user.id,
              ownerEmail: user.email,
              parentId: parentId,
              teamId: teamId,
              level: objective.level || 'organization',
              quarter: objective.quarter,
              year: objective.year,
              progress: objective.progress || 0,
              progressMode: objective.progressMode || 'rollup',
              status: objective.status || 'on_track',
              linkedStrategies: objective.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
              linkedGoals: objective.linkedGoals || [],
              linkedValues: objective.linkedValues || [],
            } as any);
            idMap.set(objective.id, newObjective.id);
            results.objectives.created++;
          }
        } catch (err) {
          console.error('Error importing objective:', err);
          results.objectives.errors++;
        }
      }
    }

    // Import key results
    if (importData.data.keyResults) {
      for (const kr of importData.data.keyResults) {
        try {
          const objectiveId = idMap.get(kr.objectiveId);
          if (!objectiveId) {
            results.keyResults.skipped++;
            continue;
          }

          // Find existing KR by title within the same objective
          const existingKrs = await storage.getKeyResultsByObjectiveId(objectiveId);
          const existingMatch = existingKrs.find(k => k.title === kr.title);

          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(kr.id, existingMatch.id);
              results.keyResults.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateKeyResult(existingMatch.id, {
                description: kr.description,
                targetValue: kr.targetValue,
                currentValue: kr.currentValue || 0,
                initialValue: kr.initialValue || 0,
                unit: kr.unit,
                metricType: kr.metricType || 'increase',
                weight: kr.weight || 25,
                progress: kr.progress || 0,
                status: kr.status || 'on_track',
              });
              idMap.set(kr.id, existingMatch.id);
              results.keyResults.updated++;
            } else {
              const newKr = await storage.createKeyResult({
                tenantId: targetTenantId,
                objectiveId,
                title: kr.title,
                description: kr.description,
                targetValue: kr.targetValue,
                currentValue: kr.currentValue || 0,
                initialValue: kr.initialValue || 0,
                unit: kr.unit,
                metricType: kr.metricType || 'increase',
                weight: kr.weight || 25,
                progress: kr.progress || 0,
                status: kr.status || 'on_track',
                ownerId: user.id,
              });
              idMap.set(kr.id, newKr.id);
              results.keyResults.created++;
            }
          } else {
            const newKr = await storage.createKeyResult({
              tenantId: targetTenantId,
              objectiveId,
              title: kr.title,
              description: kr.description,
              targetValue: kr.targetValue,
              currentValue: kr.currentValue || 0,
              initialValue: kr.initialValue || 0,
              unit: kr.unit,
              metricType: kr.metricType || 'increase',
              weight: kr.weight || 25,
              progress: kr.progress || 0,
              status: kr.status || 'on_track',
              ownerId: user.id,
            });
            idMap.set(kr.id, newKr.id);
            results.keyResults.created++;
          }
        } catch (err) {
          console.error('Error importing key result:', err);
          results.keyResults.errors++;
        }
      }
    }

    // Import big rocks
    if (importData.data.bigRocks) {
      for (const br of importData.data.bigRocks) {
        try {
          const objectiveId = br.objectiveId ? idMap.get(br.objectiveId) : null;
          const keyResultId = br.keyResultId ? idMap.get(br.keyResultId) : null;
          // Map teamId to new team ID if the team was imported
          const teamId = br.teamId ? idMap.get(br.teamId) || null : null;

          // Find existing big rock by title (use pre-fetched data)
          const existingMatch = existingBigRocks.find(b => b.title === br.title);

          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(br.id, existingMatch.id);
              results.bigRocks.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateBigRock(existingMatch.id, {
                description: br.description,
                objectiveId: objectiveId || null,
                keyResultId: keyResultId || null,
                teamId: teamId,
                quarter: br.quarter,
                year: br.year,
                completionPercentage: br.completionPercentage || 0,
                status: br.status || 'not_started',
                linkedStrategies: br.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
              });
              idMap.set(br.id, existingMatch.id);
              results.bigRocks.updated++;
            } else {
              const newBr = await storage.createBigRock({
                tenantId: targetTenantId,
                title: br.title,
                description: br.description,
                objectiveId: objectiveId || null,
                keyResultId: keyResultId || null,
                teamId: teamId,
                ownerId: user.id,
                ownerEmail: user.email,
                quarter: br.quarter,
                year: br.year,
                completionPercentage: br.completionPercentage || 0,
                status: br.status || 'not_started',
                linkedStrategies: br.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
              });
              idMap.set(br.id, newBr.id);
              results.bigRocks.created++;
            }
          } else {
            const newBr = await storage.createBigRock({
              tenantId: targetTenantId,
              title: br.title,
              description: br.description,
              objectiveId: objectiveId || null,
              keyResultId: keyResultId || null,
              teamId: teamId,
              ownerId: user.id,
              ownerEmail: user.email,
              quarter: br.quarter,
              year: br.year,
              completionPercentage: br.completionPercentage || 0,
              status: br.status || 'not_started',
              linkedStrategies: br.linkedStrategies?.map((id: string) => idMap.get(id) || id) || [],
            });
            idMap.set(br.id, newBr.id);
            results.bigRocks.created++;
          }
        } catch (err) {
          console.error('Error importing big rock:', err);
          results.bigRocks.errors++;
        }
      }
    }

    // Import check-ins if enabled
    if (options.importCheckIns && importData.data.checkIns) {
      for (const checkIn of importData.data.checkIns) {
        try {
          const entityId = idMap.get(checkIn.entityId);
          if (!entityId) {
            results.checkIns.skipped++;
            continue;
          }

          await storage.createCheckIn({
            tenantId: targetTenantId,
            userId: user.id,
            entityType: checkIn.entityType,
            entityId,
            previousValue: checkIn.previousValue,
            newValue: checkIn.newValue,
            previousProgress: checkIn.previousProgress || 0,
            newProgress: checkIn.newProgress || 0,
            previousStatus: checkIn.previousStatus,
            newStatus: checkIn.newStatus,
            note: checkIn.note,
            achievements: checkIn.achievements,
            challenges: checkIn.challenges,
            nextSteps: checkIn.nextSteps,
            asOfDate: checkIn.asOfDate ? new Date(checkIn.asOfDate) : new Date(),
          });
          results.checkIns.created++;
        } catch (err) {
          console.error('Error importing check-in:', err);
          results.checkIns.errors++;
        }
      }
    }

    // Import grounding documents (AI context)
    if (importData.data.groundingDocuments) {
      for (const doc of importData.data.groundingDocuments) {
        try {
          // Match by title
          const existingMatch = existingGroundingDocs.find(d => d.title === doc.title);

          if (existingMatch) {
            if (options.duplicateStrategy === 'skip') {
              idMap.set(doc.id, existingMatch.id);
              results.groundingDocuments.skipped++;
            } else if (options.duplicateStrategy === 'replace') {
              await storage.updateGroundingDocument(existingMatch.id, {
                description: doc.description,
                category: doc.category,
                content: doc.content,
                priority: doc.priority || 0,
                isActive: doc.isActive !== false,
                updatedBy: user.id,
              });
              idMap.set(doc.id, existingMatch.id);
              results.groundingDocuments.updated++;
            } else {
              const newDoc = await storage.createGroundingDocument({
                tenantId: targetTenantId,
                title: doc.title,
                description: doc.description,
                category: doc.category,
                content: doc.content,
                priority: doc.priority || 0,
                isActive: doc.isActive !== false,
                createdBy: user.id,
              });
              idMap.set(doc.id, newDoc.id);
              results.groundingDocuments.created++;
            }
          } else {
            const newDoc = await storage.createGroundingDocument({
              tenantId: targetTenantId,
              title: doc.title,
              description: doc.description,
              category: doc.category,
              content: doc.content,
              priority: doc.priority || 0,
              isActive: doc.isActive !== false,
              createdBy: user.id,
            });
            idMap.set(doc.id, newDoc.id);
            results.groundingDocuments.created++;
          }
        } catch (err) {
          console.error('Error importing grounding document:', err);
          results.groundingDocuments.errors++;
        }
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      results,
      totals: {
        created: Object.values(results).reduce((sum, r) => sum + r.created, 0),
        updated: Object.values(results).reduce((sum, r) => sum + r.updated, 0),
        skipped: Object.values(results).reduce((sum, r) => sum + r.skipped, 0),
        errors: Object.values(results).reduce((sum, r) => sum + r.errors, 0),
      },
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ 
      error: 'Import failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export { router as importRouter };
