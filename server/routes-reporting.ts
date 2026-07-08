import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { insertReviewSnapshotSchema, insertReportTemplateSchema, insertReportInstanceSchema } from "@shared/schema";
import { z } from "zod";
import { generateReportPDF } from "./pdf-service";
import { generateReportPPTX, SlideOptions, DEFAULT_SLIDE_OPTIONS } from "./pptx-service";
import { generatePeriodSummary } from "./ai";
import { requireValidatedTenant, getValidatedTenantId } from "./middleware/validateTenant";
import { canAccessAnyTenant } from "@shared/rbac";

const router = Router();

/**
 * Normalize progress to a maximum of 100% to avoid inflated averages
 * Any value above 100 is capped at 100
 */
function normalizeProgress(progress: number): number {
  return Math.min(progress, 100);
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
router.get("/snapshots/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const snapshot = await storage.getReviewSnapshotById(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    if (snapshot.tenantId !== req.effectiveTenantId) {
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
    
    // Get key results for all objectives using batch method
    const objectiveIds = objectives.map(obj => obj.id);
    const keyResultsMap = await storage.getKeyResultsByObjectiveIds(objectiveIds);
    const keyResults = Array.from(keyResultsMap.values()).flat();
    
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
      createdBy: req.user?.id,
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
router.patch("/snapshots/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const existing = await storage.getReviewSnapshotById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    if (existing.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    const { tenantId: _ignoreTenantId, ...updateBody } = req.body || {};
    const snapshot = await storage.updateReviewSnapshot(req.params.id, {
      ...updateBody,
      updatedBy: req.user?.id,
    });
    res.json(snapshot);
  } catch (error) {
    console.error("Error updating snapshot:", error);
    res.status(500).json({ error: "Failed to update snapshot" });
  }
});

// Delete snapshot
router.delete("/snapshots/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const existing = await storage.getReviewSnapshotById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
    if (existing.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Snapshot not found" });
    }
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
router.get("/templates", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const templates = await storage.getReportTemplates(req.effectiveTenantId || undefined);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get single template (tenant-specific templates or global templates)
router.get("/templates/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const template = await storage.getReportTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    const isGlobal = template.tenantId === null || template.tenantId === undefined;
    if (!isGlobal && template.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Create template
router.post("/templates", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const role = (req.user?.role || '') as string;
    const canManageGlobal = canAccessAnyTenant(role as any);
    // Non-platform-admins can only create templates scoped to their own tenant
    const requestedTenantId = req.body.tenantId;
    if (requestedTenantId && requestedTenantId !== req.effectiveTenantId && !canManageGlobal) {
      return res.status(403).json({ error: "Access denied" });
    }
    const tenantId = canManageGlobal ? (requestedTenantId ?? req.effectiveTenantId) : req.effectiveTenantId;
    const validated = insertReportTemplateSchema.parse({
      ...req.body,
      tenantId,
      createdBy: req.user?.id,
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
router.patch("/templates/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const existing = await storage.getReportTemplateById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }
    const role = (req.user?.role || '') as string;
    const canManageGlobal = canAccessAnyTenant(role as any);
    const isGlobal = existing.tenantId === null || existing.tenantId === undefined;
    if (isGlobal && !canManageGlobal) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!isGlobal && existing.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Template not found" });
    }
    const { tenantId: _ignoreTenantId, ...updateBody } = req.body || {};
    const template = await storage.updateReportTemplate(req.params.id, {
      ...updateBody,
      updatedBy: req.user?.id,
    });
    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/templates/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const existing = await storage.getReportTemplateById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }
    const role = (req.user?.role || '') as string;
    const canManageGlobal = canAccessAnyTenant(role as any);
    const isGlobal = existing.tenantId === null || existing.tenantId === undefined;
    if (isGlobal && !canManageGlobal) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!isGlobal && existing.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Template not found" });
    }
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
router.get("/reports/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    if (report.tenantId !== req.effectiveTenantId) {
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
      if (snapshot && snapshot.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (snapshot) {
        const snapshotObjectives = (snapshot.objectivesSnapshot as any[]) || [];
        const snapshotKeyResults = (snapshot.keyResultsSnapshot as any[]) || [];
        const snapshotBigRocks = (snapshot.bigRocksSnapshot as any[]) || [];
        
        const summaryData = {
          totalObjectives: snapshot.objectivesTotal || 0,
          completedObjectives: snapshot.objectivesCompleted || 0,
          averageProgress: snapshot.overallProgress || 0,
          totalKeyResults: snapshot.keyResultsTotal || 0,
          completedKeyResults: snapshot.keyResultsCompleted || 0,
          totalBigRocks: snapshotBigRocks.length || 0,
          completedBigRocks: snapshotBigRocks.filter((br: any) => br.status === 'completed').length || 0,
        };
        
        // Generate AI summary for snapshot-based reports too
        let aiSummary = null;
        try {
          aiSummary = await generatePeriodSummary({
            tenantId,
            periodType,
            quarter,
            year,
            objectives: snapshotObjectives.map((o: any) => ({ title: o.title, progress: o.progress || 0, level: o.level || undefined })),
            keyResults: snapshotKeyResults.map((kr: any) => ({ title: kr.title, progress: kr.progress || 0 })),
            bigRocks: snapshotBigRocks.map((br: any) => ({ title: br.title, status: br.status })),
            checkIns: [],
            summary: summaryData,
          });
        } catch (aiError) {
          console.error("AI summary generation failed for snapshot:", aiError);
        }
        
        reportData = {
          summary: summaryData,
          objectives: snapshot.objectivesSnapshot,
          keyResults: snapshot.keyResultsSnapshot,
          bigRocks: snapshot.bigRocksSnapshot,
          achievements: snapshot.keyAchievements,
          challenges: snapshot.challenges,
          aiSummary,
        };
      }
    } else {
      // Capture current state using header tenant ID
      const [objectives, bigRocks, teams] = await Promise.all([
        storage.getObjectivesByTenantId(tenantId, quarter, year),
        storage.getBigRocksByTenantId(tenantId, quarter, year),
        storage.getTeamsByTenantId(tenantId),
      ]);
      
      // Use batch methods to avoid N+1 queries
      const objectiveIds = objectives.map(obj => obj.id);
      const keyResultsMap = await storage.getKeyResultsByObjectiveIds(objectiveIds);
      const keyResults = Array.from(keyResultsMap.values()).flat();
      
      // Fetch check-ins for all key results in a single query
      const keyResultIds = keyResults.map(kr => kr.id);
      const checkInsMap = await storage.getCheckInsByEntityIds('key_result', keyResultIds);
      const checkIns = Array.from(checkInsMap.values()).flat();
      
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
      createdBy: req.user?.id,
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
router.delete("/reports/:id", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const existing = await storage.getReportInstanceById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Report not found" });
    }
    if (existing.tenantId !== req.effectiveTenantId) {
      return res.status(404).json({ error: "Report not found" });
    }
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
router.get("/reports/:id/pdf", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    if (report.tenantId !== req.effectiveTenantId) {
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

    const vocabulary = await storage.getEffectiveVocabulary(report.tenantId);
    const pdfBuffer = await generateReportPDF({
      report,
      snapshot: snapshot || undefined,
      tenant,
      vocabulary,
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
router.get("/reports/:id/pptx", requireValidatedTenant, async (req: Request, res: Response) => {
  try {
    const report = await storage.getReportInstanceById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    if (report.tenantId !== req.effectiveTenantId) {
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

    const vocabulary = await storage.getEffectiveVocabulary(report.tenantId);
    const pptxBuffer = await generateReportPPTX({
      report,
      snapshot: snapshot || undefined,
      tenant,
      slideOptions,
      vocabulary,
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
    
    // Use batch method to avoid N+1 queries
    const objectiveIds = objectives.map(obj => obj.id);
    const keyResultsMap = await storage.getKeyResultsByObjectiveIds(objectiveIds);
    const keyResults = Array.from(keyResultsMap.values()).flat();

    // Owner-reported confidence per objective: latest non-null check-in value
    // and the trailing 4-week average from check-ins. Aggregated as the mean
    // across objectives at the bottom of this block.
    const objectiveConfidence: Array<{
      objectiveId: string;
      title: string;
      confidenceLatest: number | null;
      confidence4wAvg: number | null;
    }> = [];
    let averageConfidence: number | null = null;
    if (objectives.length > 0) {
      const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const latestValues: number[] = [];
      for (const obj of objectives) {
        const cis = await storage.getCheckInsByEntityId('objective', obj.id);
        const sorted = (cis || []).slice().sort((a, b) => {
          const da = new Date(a.asOfDate || a.createdAt || 0).getTime();
          const db = new Date(b.asOfDate || b.createdAt || 0).getTime();
          return db - da;
        });
        const latestWithConf = sorted.find((c) => c.confidence != null);
        const latest =
          latestWithConf && typeof latestWithConf.confidence === 'number'
            ? Math.round(latestWithConf.confidence * 100) / 100
            : null;

        const recent = sorted.filter((c) => {
          if (c.confidence == null) return false;
          const t = new Date(c.asOfDate || c.createdAt || 0).getTime();
          return now - t <= FOUR_WEEKS_MS;
        });
        let avg4w: number | null = null;
        if (recent.length > 0) {
          const sum = recent.reduce(
            (acc, c) => acc + (c.confidence as number),
            0,
          );
          avg4w = Math.round((sum / recent.length) * 100) / 100;
        }

        objectiveConfidence.push({
          objectiveId: obj.id,
          title: obj.title,
          confidenceLatest: latest,
          confidence4wAvg: avg4w,
        });
        if (latest != null) latestValues.push(latest);
      }
      if (latestValues.length > 0) {
        const sum = latestValues.reduce((a, b) => a + b, 0);
        averageConfidence = Math.round((sum / latestValues.length) * 100) / 100;
      }
    }

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
        averageConfidence,
        totalKeyResults: keyResults.length,
        completedKeyResults,
        totalBigRocks: bigRocks.length,
        completedBigRocks,
      },
      objectivesByStatus,
      objectiveConfidence,
      quarter,
      year,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;
