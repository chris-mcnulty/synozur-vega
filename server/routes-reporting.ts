import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { insertReviewSnapshotSchema, insertReportTemplateSchema, insertReportInstanceSchema } from "@shared/schema";
import { z } from "zod";
import { generateReportPDF } from "./pdf-service";
import { generateReportPPTX, SlideOptions, DEFAULT_SLIDE_OPTIONS } from "./pptx-service";
import { generatePeriodSummary } from "./ai";
import { requireValidatedTenant, getValidatedTenantId } from "./middleware/validateTenant";

const router = Router();

/**
 * Normalize progress to a maximum of 100% to avoid inflated averages
 * Any value above 100 is capped at 100
 */
function normalizeProgress(progress: number): number {
  return Math.min(progress, 100);
}

// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// ============================================
// REVIEW SNAPSHOTS ROUTES
// ============================================

// Get snapshots for a tenant
router.get("/snapshots", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
    
    const snapshots = await storage.getReviewSnapshotsByTenantId(tenantId, year, quarter);
    res.json(snapshots);
  } catch (error) {
    console.error("Error fetching snapshots:", error);
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

// Get single snapshot
router.get("/snapshots/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await storage.getReviewSnapshotById(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching snapshot:", error);
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

// Create snapshot (capture current state)
router.post("/snapshots", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    
    // Get current OKR data to snapshot
    const [objectives, bigRocks] = await Promise.all([
      storage.getObjectivesByTenantId(tenantId, req.body.quarter, req.body.year),
      storage.getBigRocksByTenantId(tenantId, req.body.quarter, req.body.year),
    ]);
    
    // Get key results for all objectives
    const keyResults = await Promise.all(
      objectives.map(obj => storage.getKeyResultsByObjectiveId(obj.id))
    ).then(results => results.flat());
    
    // Calculate metrics (normalize progress to max 100% to avoid inflated averages)
    const completedObjectives = objectives.filter(o => (o.progress || 0) >= 100).length;
    const completedKeyResults = keyResults.filter(kr => (kr.progress || 0) >= 100).length;
    const overallProgress = objectives.length > 0
      ? Math.round(objectives.reduce((sum, o) => sum + normalizeProgress(o.progress || 0), 0) / objectives.length)
      : 0;
    
    const snapshotData = {
      tenantId: tenantId,
      title: req.body.title || `${req.body.reviewType} Review - Q${req.body.quarter} ${req.body.year}`,
      description: req.body.description,
      reviewType: req.body.reviewType || 'quarterly',
      quarter: req.body.quarter,
      year: req.body.year,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      snapshotDate: new Date(),
      executiveSummary: req.body.executiveSummary,
      keyAchievements: req.body.keyAchievements || [],
      challenges: req.body.challenges || [],
      lessonsLearned: req.body.lessonsLearned || [],
      nextQuarterPriorities: req.body.nextQuarterPriorities || [],
      objectivesSnapshot: objectives,
      keyResultsSnapshot: keyResults,
      bigRocksSnapshot: bigRocks,
      overallProgress,
      objectivesCompleted: completedObjectives,
      objectivesTotal: objectives.length,
      keyResultsCompleted: completedKeyResults,
      keyResultsTotal: keyResults.length,
      status: 'draft',
      createdBy: user.id,
    };
    
    const validated = insertReviewSnapshotSchema.parse(snapshotData);
    const snapshot = await storage.createReviewSnapshot(validated);
    res.status(201).json(snapshot);
  } catch (error) {
    console.error("Error creating snapshot:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

// Update snapshot
router.patch("/snapshots/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    const snapshot = await storage.updateReviewSnapshot(req.params.id, {
      ...req.body,
      updatedBy: user?.id,
    });
    res.json(snapshot);
  } catch (error) {
    console.error("Error updating snapshot:", error);
    res.status(500).json({ error: "Failed to update snapshot" });
  }
});

// Delete snapshot
router.delete("/snapshots/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await storage.deleteReviewSnapshot(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting snapshot:", error);
    res.status(500).json({ error: "Failed to delete snapshot" });
  }
});

// ============================================
// REPORT TEMPLATES ROUTES
// ============================================

// Get templates (global + tenant-specific)
router.get("/templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    const templates = await storage.getReportTemplates(user?.tenantId || undefined);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get single template
router.get("/templates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const template = await storage.getReportTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Create template
router.post("/templates", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    const validated = insertReportTemplateSchema.parse({
      ...req.body,
      tenantId: req.body.tenantId || user?.tenantId,
      createdBy: user?.id,
    });
    const template = await storage.createReportTemplate(validated);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Update template
router.patch("/templates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    const template = await storage.updateReportTemplate(req.params.id, {
      ...req.body,
      updatedBy: user?.id,
    });
    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/templates/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await storage.deleteReportTemplate(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ============================================
// REPORT INSTANCES ROUTES
// ============================================

// Get generated reports
router.get("/reports", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const reportType = req.query.reportType as string | undefined;
    
    const reports = await storage.getReportInstances(tenantId, year, reportType);
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Get single report
router.get("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// Generate a new report
router.post("/reports/generate", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    const user = req.user;
    
    const { templateId, snapshotId, periodType, periodStart, periodEnd, quarter, year, title, description } = req.body;
    
    // Get snapshot data if provided, otherwise capture current state
    let reportData: any = {};
    
    if (snapshotId) {
      const snapshot = await storage.getReviewSnapshotById(snapshotId);
      if (snapshot) {
        reportData = {
          summary: {
            totalObjectives: snapshot.objectivesTotal || 0,
            completedObjectives: snapshot.objectivesCompleted || 0,
            averageProgress: snapshot.overallProgress || 0,
            totalKeyResults: snapshot.keyResultsTotal || 0,
            completedKeyResults: snapshot.keyResultsCompleted || 0,
            totalBigRocks: (snapshot.bigRocksSnapshot as any[])?.length || 0,
            completedBigRocks: (snapshot.bigRocksSnapshot as any[])?.filter((br: any) => br.status === 'completed').length || 0,
          },
          objectives: snapshot.objectivesSnapshot,
          keyResults: snapshot.keyResultsSnapshot,
          bigRocks: snapshot.bigRocksSnapshot,
          achievements: snapshot.keyAchievements,
          challenges: snapshot.challenges,
        };
      }
    } else {
      // Capture current state using header tenant ID
      const [objectives, bigRocks, teams] = await Promise.all([
        storage.getObjectivesByTenantId(tenantId, quarter, year),
        storage.getBigRocksByTenantId(tenantId, quarter, year),
        storage.getTeamsByTenantId(tenantId),
      ]);
      
      const keyResults = await Promise.all(
        objectives.map(obj => storage.getKeyResultsByObjectiveId(obj.id))
      ).then(results => results.flat());
      
      // Fetch check-ins for all key results
      const checkIns = await Promise.all(
        keyResults.map(kr => storage.getCheckInsByEntityId('key_result', kr.id))
      ).then(results => results.flat());
      
      const completedObjectives = objectives.filter(o => (o.progress || 0) >= 100).length;
      const completedKeyResults = keyResults.filter(kr => (kr.progress || 0) >= 100).length;
      const completedBigRocks = bigRocks.filter(br => br.status === 'completed').length;
      // Normalize progress to max 100% to avoid inflated averages
      const averageProgress = objectives.length > 0
        ? Math.round(objectives.reduce((sum, o) => sum + normalizeProgress(o.progress || 0), 0) / objectives.length)
        : 0;
      
      // Calculate status counts (use normalized progress for consistency)
      const onTrackCount = objectives.filter(o => normalizeProgress(o.progress || 0) >= 70).length;
      const atRiskCount = objectives.filter(o => normalizeProgress(o.progress || 0) >= 40 && normalizeProgress(o.progress || 0) < 70).length;
      const behindCount = objectives.filter(o => normalizeProgress(o.progress || 0) < 40).length;
      
      // Calculate progress by level (normalize each objective's progress)
      const levelGroups = new Map<string, { count: number; totalProgress: number }>();
      objectives.forEach(obj => {
        const level = obj.level || 'team';
        const group = levelGroups.get(level) || { count: 0, totalProgress: 0 };
        group.count++;
        group.totalProgress += normalizeProgress(obj.progress || 0);
        levelGroups.set(level, group);
      });
      const progressByLevel = Array.from(levelGroups.entries()).map(([level, data]) => ({
        level,
        avgProgress: Math.round(data.totalProgress / data.count),
        count: data.count,
      }));
      
      const summaryData = {
        totalObjectives: objectives.length,
        completedObjectives,
        averageProgress,
        totalKeyResults: keyResults.length,
        completedKeyResults,
        totalBigRocks: bigRocks.length,
        completedBigRocks,
        onTrackCount,
        atRiskCount,
        behindCount,
        progressByLevel,
      };
      
      let aiSummary = null;
      try {
        aiSummary = await generatePeriodSummary({
          tenantId,
          periodType,
          quarter,
          year,
          objectives: objectives.map(o => ({ title: o.title, progress: o.progress || 0, level: o.level || undefined })),
          keyResults: keyResults.map(kr => ({ title: kr.title, progress: kr.progress || 0 })),
          bigRocks: bigRocks.map(br => ({ title: br.title, status: br.status })),
          checkIns: checkIns.map(ci => ({ 
            note: ci.note || undefined, 
            achievements: ci.achievements || undefined, 
            challenges: ci.challenges || undefined, 
            createdAt: ci.createdAt 
          })),
          summary: summaryData,
        });
      } catch (aiError) {
        console.error("AI summary generation failed:", aiError);
      }
      
      reportData = {
        summary: summaryData,
        objectives,
        keyResults,
        bigRocks,
        teams,
        checkIns,
        aiSummary,
      };
    }
    
    const instanceData = {
      tenantId: tenantId,
      templateId,
      snapshotId,
      title: title || `${periodType} Report - ${quarter ? `Q${quarter} ` : ''}${year}`,
      description,
      reportType: periodType === 'quarter' ? 'qbr' : periodType === 'year' ? 'annual_review' : 'weekly_status',
      periodType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      quarter,
      year,
      status: 'completed',
      generatedAt: new Date(),
      reportData,
      createdBy: user.id,
    };
    
    const validated = insertReportInstanceSchema.parse(instanceData);
    const report = await storage.createReportInstance(validated);
    res.status(201).json(report);
  } catch (error) {
    console.error("Error generating report:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// Delete report
router.delete("/reports/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await storage.deleteReportInstance(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// ============================================
// PDF EXPORT
// ============================================

// Export report as PDF
router.get("/reports/:id/pdf", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) {
      return res.status(403).json({ error: "No tenant access" });
    }

    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Use the report's tenant for branding (the report stores the correct tenantId)
    const tenant = await storage.getTenantById(report.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Get snapshot if linked
    let snapshot;
    if (report.snapshotId) {
      snapshot = await storage.getReviewSnapshotById(report.snapshotId);
    }

    const pdfBuffer = await generateReportPDF({
      report,
      snapshot: snapshot || undefined,
      tenant,
    });

    const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Export report as PPTX
router.get("/reports/:id/pptx", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) {
      return res.status(403).json({ error: "No tenant access" });
    }

    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Use the report's tenant for branding (the report stores the correct tenantId)
    const tenant = await storage.getTenantById(report.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Get snapshot if linked
    let snapshot;
    if (report.snapshotId) {
      snapshot = await storage.getReviewSnapshotById(report.snapshotId);
    }

    const slideOptions: Partial<SlideOptions> = {};
    if (req.query.executiveScorecard !== undefined) slideOptions.executiveScorecard = req.query.executiveScorecard === 'true';
    if (req.query.teamPerformance !== undefined) slideOptions.teamPerformance = req.query.teamPerformance === 'true';
    if (req.query.objectivesDeepDive !== undefined) slideOptions.objectivesDeepDive = req.query.objectivesDeepDive === 'true';
    if (req.query.keyResultsTrend !== undefined) slideOptions.keyResultsTrend = req.query.keyResultsTrend === 'true';
    if (req.query.atRiskItems !== undefined) slideOptions.atRiskItems = req.query.atRiskItems === 'true';
    if (req.query.bigRocksKanban !== undefined) slideOptions.bigRocksKanban = req.query.bigRocksKanban === 'true';
    if (req.query.periodComparison !== undefined) slideOptions.periodComparison = req.query.periodComparison === 'true';
    if (req.query.checkInHighlights !== undefined) slideOptions.checkInHighlights = req.query.checkInHighlights === 'true';

    const pptxBuffer = await generateReportPPTX({
      report,
      snapshot: snapshot || undefined,
      tenant,
      slideOptions,
    });

    const filename = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pptx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);
    res.send(pptxBuffer);
  } catch (error: any) {
    console.error("Error generating PPTX:", error?.message || error);
    console.error("PPTX Error stack:", error?.stack);
    res.status(500).json({ error: "Failed to generate PPTX", details: error?.message });
  }
});

// ============================================
// QUICK REPORT DATA (for dashboard widgets)
// ============================================

// Get current OKR summary for dashboard/reports
router.get("/summary", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = req.effectiveTenantId!;
    
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    
    const [objectives, bigRocks] = await Promise.all([
      storage.getObjectivesByTenantId(tenantId, quarter, year),
      storage.getBigRocksByTenantId(tenantId, quarter, year),
    ]);
    
    const keyResults = await Promise.all(
      objectives.map(obj => storage.getKeyResultsByObjectiveId(obj.id))
    ).then(results => results.flat());
    
    const completedObjectives = objectives.filter(o => (o.progress || 0) >= 100).length;
    const completedKeyResults = keyResults.filter(kr => (kr.progress || 0) >= 100).length;
    const completedBigRocks = bigRocks.filter(br => br.status === 'completed').length;
    // Normalize progress to max 100% to avoid inflated averages
    const averageProgress = objectives.length > 0
      ? Math.round(objectives.reduce((sum, o) => sum + normalizeProgress(o.progress || 0), 0) / objectives.length)
      : 0;
    
    // Group by status (use normalized progress for consistency)
    const objectivesByStatus = {
      onTrack: objectives.filter(o => normalizeProgress(o.progress || 0) >= 70).length,
      atRisk: objectives.filter(o => normalizeProgress(o.progress || 0) >= 40 && normalizeProgress(o.progress || 0) < 70).length,
      behind: objectives.filter(o => normalizeProgress(o.progress || 0) < 40).length,
    };
    
    res.json({
      summary: {
        totalObjectives: objectives.length,
        completedObjectives,
        averageProgress,
        totalKeyResults: keyResults.length,
        completedKeyResults,
        totalBigRocks: bigRocks.length,
        completedBigRocks,
      },
      objectivesByStatus,
      quarter,
      year,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;
