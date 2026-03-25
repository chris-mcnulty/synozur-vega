import { Router, Request, Response } from "express";
import { storage } from "./storage";
import type { Foundation, Strategy, Objective, KeyResult, BigRock, Team, GroundingDocument, Meeting, VocabularyTerms } from "@shared/schema";

const router = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

interface ExportFilters {
  level?: string[];
  teamId?: string;
  quarter?: number;
  year?: number;
  status?: string[];
  includeFoundations?: boolean;
  includeStrategies?: boolean;
  includeObjectives?: boolean;
  includeBigRocks?: boolean;
  includeTeams?: boolean;
  includeGroundingDocs?: boolean;
  includeMeetings?: boolean;
}

function getProgressEmoji(progress: number): string {
  if (progress >= 100) return "✅";
  if (progress >= 70) return "🟢";
  if (progress >= 40) return "🟡";
  return "🔴";
}

function getStatusEmoji(status: string | null | undefined): string {
  switch (status) {
    case "completed": return "✅";
    case "on_track": return "🟢";
    case "behind": return "🟡";
    case "at_risk": return "🔴";
    case "not_started": return "⬜";
    default: return "⬜";
  }
}

router.get("/company-os", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) {
      return res.status(403).json({ error: "No tenant access" });
    }

    // Use x-tenant-id header for tenant switching support (consultants/admins)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const effectiveTenantId = headerTenantId || user.tenantId;

    const tenant = await storage.getTenantById(effectiveTenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const filters: ExportFilters = {
      level: req.query.level ? (req.query.level as string).split(",") : undefined,
      teamId: req.query.teamId as string | undefined,
      quarter: req.query.quarter ? parseInt(req.query.quarter as string) : undefined,
      year: req.query.year ? parseInt(req.query.year as string) : undefined,
      status: req.query.status ? (req.query.status as string).split(",") : undefined,
      includeFoundations: req.query.includeFoundations !== "false",
      includeStrategies: req.query.includeStrategies !== "false",
      includeObjectives: req.query.includeObjectives !== "false",
      includeBigRocks: req.query.includeBigRocks !== "false",
      includeTeams: req.query.includeTeams !== "false",
      includeGroundingDocs: req.query.includeGroundingDocs !== "false",
      includeMeetings: req.query.includeMeetings === "true",
    };

    const [foundation, strategies, objectives, keyResults, bigRocks, teams, groundingDocs, meetings, vocabulary] = await Promise.all([
      // Always fetch foundation - needed for Goals (Outcomes section) even when includeFoundations is false
      storage.getFoundationByTenantId(effectiveTenantId),
      filters.includeStrategies ? storage.getStrategiesByTenantId(effectiveTenantId) : Promise.resolve([]),
      storage.getObjectivesByTenantId(effectiveTenantId, filters.quarter, filters.year),
      storage.getKeyResultsByTenantId(effectiveTenantId),
      filters.includeBigRocks ? storage.getBigRocksByTenantId(effectiveTenantId, filters.quarter, filters.year) : Promise.resolve([]),
      filters.includeTeams ? storage.getTeamsByTenantId(effectiveTenantId) : Promise.resolve([]),
      filters.includeGroundingDocs ? storage.getTenantGroundingDocuments(effectiveTenantId) : Promise.resolve([]),
      filters.includeMeetings ? storage.getMeetingsByTenantId(effectiveTenantId) : Promise.resolve([]),
      storage.getEffectiveVocabulary(effectiveTenantId),
    ]);

    const v = (key: keyof VocabularyTerms, form: 'singular' | 'plural' = 'singular') => vocabulary[key]?.[form] || key;

    let filteredObjectives = objectives;
    if (filters.level && filters.level.length > 0) {
      filteredObjectives = filteredObjectives.filter((obj: Objective) => filters.level!.includes(obj.level || ""));
    }
    if (filters.teamId) {
      filteredObjectives = filteredObjectives.filter((obj: Objective) => obj.teamId === filters.teamId);
    }
    if (filters.status && filters.status.length > 0) {
      filteredObjectives = filteredObjectives.filter((obj: Objective) => filters.status!.includes(obj.status || ""));
    }

    const keyResultsMap: Record<string, KeyResult[]> = {};
    keyResults.forEach((kr: KeyResult) => {
      if (!keyResultsMap[kr.objectiveId]) {
        keyResultsMap[kr.objectiveId] = [];
      }
      keyResultsMap[kr.objectiveId].push(kr);
    });

    const exportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    let markdown = `# ${tenant.name} - Company Operating System\n\n`;
    markdown += `**Generated:** ${exportDate}\n\n`;
    
    if (filters.year && filters.quarter) {
      markdown += `**Period:** Q${filters.quarter} ${filters.year}\n\n`;
    } else if (filters.year) {
      markdown += `**Period:** Full Year ${filters.year}\n\n`;
    }
    
    markdown += `---\n\n`;

    if (filters.includeFoundations && foundation) {
      markdown += `## Foundation\n\n`;
      
      if (foundation.mission) {
        markdown += `### Mission\n\n${foundation.mission}\n\n`;
      }
      
      if (foundation.vision) {
        markdown += `### Vision\n\n${foundation.vision}\n\n`;
      }
      
      const values = foundation.values as Array<{ title?: string; name?: string; description?: string }> | null;
      if (values && values.length > 0) {
        markdown += `### Core Values\n\n`;
        values.forEach((value, index) => {
          const valueName = value.title || value.name || 'Unnamed Value';
          markdown += `${index + 1}. **${valueName}**`;
          if (value.description) {
            markdown += ` - ${value.description}`;
          }
          markdown += `\n`;
        });
        markdown += `\n`;
      }
      
      // Ambitions (3-5 year strategic targets)
      const ambitions = foundation.ambitions as Array<{ id?: string; title?: string; description?: string; targetYear?: number; status?: string; linkedValueTitles?: string[] }> | null;
      if (ambitions && ambitions.length > 0) {
        const activeAmbitions = ambitions.filter(a => a.status === 'active');
        if (activeAmbitions.length > 0) {
          markdown += `### Ambitions (Long-Term Strategic Targets)\n\n`;
          activeAmbitions.forEach((ambition, index) => {
            markdown += `${index + 1}. **${ambition.title || 'Untitled Ambition'}**`;
            if (ambition.targetYear) {
              markdown += ` (Target: ${ambition.targetYear})`;
            }
            if (ambition.description) {
              markdown += `\n   ${ambition.description}`;
            }
            if (ambition.linkedValueTitles && ambition.linkedValueTitles.length > 0) {
              markdown += `\n   *Values: ${ambition.linkedValueTitles.join(', ')}*`;
            }
            markdown += `\n`;
          });
          markdown += `\n`;
        }
      }
      
      markdown += `---\n\n`;
    }

    if (filters.includeStrategies && strategies.length > 0) {
      markdown += `## ${v('strategy', 'plural')}\n\n`;
      
      strategies.forEach((strategy: Strategy, index: number) => {
        markdown += `### ${index + 1}. ${strategy.title}\n\n`;
        
        if (strategy.description) {
          markdown += `${strategy.description}\n\n`;
        }
        
        if (strategy.status) {
          markdown += `**Status:** ${strategy.status}\n\n`;
        }
      });
      
      markdown += `---\n\n`;
    }

    if (filters.includeObjectives && filteredObjectives.length > 0) {
      markdown += `## ${v('objective', 'plural')} & ${v('keyResult', 'plural')}\n\n`;
      
      const companyObjectives = filteredObjectives.filter((obj: Objective) => obj.level === "company" || obj.level === "organization");
      const departmentObjectives = filteredObjectives.filter((obj: Objective) => obj.level === "department");
      const teamObjectives = filteredObjectives.filter((obj: Objective) => obj.level === "team");
      const individualObjectives = filteredObjectives.filter((obj: Objective) => obj.level === "individual");

      const renderObjectives = (objs: Objective[], levelName: string) => {
        if (objs.length === 0) return;
        
        markdown += `### ${levelName} ${v('objective', 'plural')}\n\n`;
        
        objs.forEach((obj: Objective, index: number) => {
          const team = teams.find((t: Team) => t.id === obj.teamId);
          const krs = keyResultsMap[obj.id] || [];
          const progress = krs.length > 0
            ? Math.round(krs.reduce((sum: number, kr: KeyResult) => {
                const krProgress = kr.targetValue > 0 
                  ? Math.min(100, ((kr.currentValue ?? 0) / kr.targetValue) * 100)
                  : 0;
                return sum + krProgress;
              }, 0) / krs.length)
            : 0;
          
          markdown += `#### ${index + 1}. ${obj.title}\n\n`;
          markdown += `${getProgressEmoji(progress)} **Progress:** ${progress}%`;
          if (obj.status) {
            markdown += ` | **Status:** ${obj.status.replace("_", " ")}`;
          }
          if (team) {
            markdown += ` | **Team:** ${team.name}`;
          }
          if (obj.ownerEmail) {
            markdown += ` | **Owner:** ${obj.ownerEmail}`;
          }
          markdown += `\n\n`;
          
          if (obj.description) {
            markdown += `${obj.description}\n\n`;
          }
          
          if (krs.length > 0) {
            markdown += `**${v('keyResult', 'plural')}:**\n\n`;
            krs.forEach((kr: KeyResult, krIndex: number) => {
              const krProgress = kr.targetValue > 0 
                ? Math.min(100, Math.round(((kr.currentValue ?? 0) / kr.targetValue) * 100))
                : 0;
              markdown += `  ${krIndex + 1}. ${getProgressEmoji(krProgress)} ${kr.title}\n`;
              markdown += `     - Progress: ${kr.currentValue ?? 0} / ${kr.targetValue} ${kr.unit || ""} (${krProgress}%)\n`;
            });
            markdown += `\n`;
          }
        });
      };

      renderObjectives(companyObjectives, "Company");
      renderObjectives(departmentObjectives, "Department");
      renderObjectives(teamObjectives, "Team");
      renderObjectives(individualObjectives, "Individual");
      
      markdown += `---\n\n`;
    }

    if (filters.includeBigRocks && bigRocks.length > 0) {
      markdown += `## ${v('bigRock', 'plural')}\n\n`;
      
      const completedRocks = bigRocks.filter((br: BigRock) => br.status === "completed");
      const inProgressRocks = bigRocks.filter((br: BigRock) => br.status === "in_progress");
      const notStartedRocks = bigRocks.filter((br: BigRock) => br.status === "not_started" || !br.status);
      
      markdown += `**Summary:** ${completedRocks.length} completed, ${inProgressRocks.length} in progress, ${notStartedRocks.length} not started\n\n`;
      
      bigRocks.forEach((rock: BigRock, index: number) => {
        const team = teams.find((t: Team) => t.id === rock.teamId);
        markdown += `${index + 1}. ${getStatusEmoji(rock.status)} **${rock.title}**`;
        if (team) {
          markdown += ` (${team.name})`;
        }
        if (rock.status) {
          markdown += ` - ${rock.status.replace("_", " ")}`;
        }
        markdown += `\n`;
        if (rock.description) {
          markdown += `   ${rock.description}\n`;
        }
      });
      
      markdown += `\n---\n\n`;
    }

    // Annual Goals in Outcomes section (after OKRs and Big Rocks)
    // Gated on includeObjectives since Goals belong in Outcomes, not Foundations
    if (filters.includeObjectives && foundation) {
      const ambitions = foundation.ambitions as Array<{ id?: string; title?: string; description?: string; targetYear?: number; status?: string; linkedValueTitles?: string[] }> | null;
      if (foundation.annualGoals && foundation.annualGoals.length > 0) {
        markdown += `## Annual ${v('goal', 'plural')} (${filters.year || new Date().getFullYear()})\n\n`;
        foundation.annualGoals.forEach((goal, index: number) => {
          const goalTitle = typeof goal === 'string' ? goal : (goal.title || 'Untitled Goal');
          const goalDescription = typeof goal === 'object' ? goal.description : undefined;
          const linkedAmbitionId = typeof goal === 'object' ? goal.linkedAmbitionId : undefined;
          markdown += `${index + 1}. **${goalTitle}**`;
          if (goalDescription) {
            markdown += ` - ${goalDescription}`;
          }
          if (linkedAmbitionId && ambitions) {
            const linkedAmbition = ambitions.find(a => a.id === linkedAmbitionId);
            if (linkedAmbition) {
              markdown += ` *(Links to: ${linkedAmbition.title})*`;
            }
          }
          markdown += `\n`;
        });
        markdown += `\n---\n\n`;
      }
    }

    if (filters.includeTeams && teams.length > 0) {
      markdown += `## Teams\n\n`;
      
      teams.forEach((team: Team, index: number) => {
        const teamObjs = filteredObjectives.filter((obj: Objective) => obj.teamId === team.id);
        const teamRocks = bigRocks.filter((br: BigRock) => br.teamId === team.id);
        
        markdown += `### ${index + 1}. ${team.name}\n\n`;
        if (team.description) {
          markdown += `${team.description}\n\n`;
        }
        markdown += `- **${v('objective', 'plural')}:** ${teamObjs.length}\n`;
        markdown += `- **${v('bigRock', 'plural')}:** ${teamRocks.length}\n\n`;
      });
      
      markdown += `---\n\n`;
    }

    if (filters.includeGroundingDocs && groundingDocs.length > 0) {
      markdown += `## AI Grounding Documents\n\n`;
      
      // Group by category
      const docsByCategory = groundingDocs.reduce((acc: Record<string, GroundingDocument[]>, doc: GroundingDocument) => {
        const cat = doc.category || 'uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(doc);
        return acc;
      }, {});
      
      Object.entries(docsByCategory).forEach(([category, docs]: [string, GroundingDocument[]]) => {
        markdown += `### ${category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n`;
        docs.forEach((doc: GroundingDocument, index: number) => {
          markdown += `${index + 1}. **${doc.title}**`;
          if (doc.description) {
            markdown += ` - ${doc.description}`;
          }
          markdown += `\n`;
          if (doc.content) {
            // Truncate very long content in markdown export
            const preview = doc.content.length > 500 ? doc.content.substring(0, 500) + '...' : doc.content;
            markdown += `   > ${preview.replace(/\n/g, '\n   > ')}\n\n`;
          }
        });
      });
      
      markdown += `---\n\n`;
    }

    if (filters.includeMeetings && meetings.length > 0) {
      markdown += `## ${v('focusRhythm')} - ${v('meeting')} Schedule\n\n`;
      
      // Group meetings by type/cadence
      const meetingsByType: Record<string, Meeting[]> = {};
      meetings.forEach((meeting: Meeting) => {
        const type = meeting.meetingType || 'other';
        if (!meetingsByType[type]) meetingsByType[type] = [];
        meetingsByType[type].push(meeting);
      });
      
      // Define cadence order for display
      const cadenceOrder = ['weekly', 'monthly', 'quarterly', 'annual', 'other'];
      const orderedTypes = Object.keys(meetingsByType).sort((a, b) => {
        const aIndex = cadenceOrder.indexOf(a);
        const bIndex = cadenceOrder.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
      
      orderedTypes.forEach(type => {
        const typeMeetings = meetingsByType[type];
        const displayType = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
        markdown += `### ${displayType} ${v('meeting', 'plural')}\n\n`;
        
        typeMeetings.forEach((meeting: Meeting, index: number) => {
          markdown += `${index + 1}. **${meeting.title}**\n`;
          if (meeting.date) {
            const meetingDate = new Date(meeting.date);
            markdown += `   - Date: ${meetingDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
          }
          if (meeting.facilitator) {
            markdown += `   - Facilitator: ${meeting.facilitator}\n`;
          }
          if (meeting.isRecurring) {
            markdown += `   - Recurring: ${meeting.recurrencePattern || 'Yes'}\n`;
          }
          const agenda = meeting.agenda as string[] | null;
          if (agenda && agenda.length > 0) {
            markdown += `   - Agenda:\n`;
            agenda.forEach((item: string) => {
              markdown += `     - ${item}\n`;
            });
          }
          markdown += `\n`;
        });
      });
      
      markdown += `---\n\n`;
    }

    const totalObjectives = filteredObjectives.length;
    const completedObjectives = filteredObjectives.filter((obj: Objective) => obj.status === "completed").length;
    const avgProgress = filteredObjectives.length > 0
      ? Math.round(filteredObjectives.reduce((sum: number, obj: Objective) => {
          const krs = keyResultsMap[obj.id] || [];
          const objProgress = krs.length > 0
            ? krs.reduce((s: number, kr: KeyResult) => {
                return s + Math.min(100, ((kr.currentValue ?? 0) / (kr.targetValue || 1)) * 100);
              }, 0) / krs.length
            : 0;
          return sum + objProgress;
        }, 0) / filteredObjectives.length)
      : 0;

    markdown += `## Summary Statistics\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total ${v('objective', 'plural')} | ${totalObjectives} |\n`;
    markdown += `| Completed ${v('objective', 'plural')} | ${completedObjectives} |\n`;
    markdown += `| Average Progress | ${avgProgress}% |\n`;
    markdown += `| Total ${v('bigRock', 'plural')} | ${bigRocks.length} |\n`;
    markdown += `| Completed ${v('bigRock', 'plural')} | ${bigRocks.filter((br: BigRock) => br.status === "completed").length} |\n`;
    markdown += `| Total Teams | ${teams.length} |\n`;

    markdown += `\n---\n\n`;
    markdown += `*Generated by Vega - Company Operating System*\n`;

    const format = req.query.format || "markdown";
    
    if (format === "json") {
      const foundationForJson = filters.includeFoundations && foundation ? {
        ...foundation,
        annualGoals: undefined,
      } : undefined;
      
      res.json({
        tenant: { name: tenant.name },
        exportDate,
        filters,
        foundation: foundationForJson,
        strategies: filters.includeStrategies ? strategies : undefined,
        annualGoals: filters.includeObjectives && foundation?.annualGoals ? foundation.annualGoals : undefined,
        objectives: filters.includeObjectives ? filteredObjectives.map((obj: Objective) => ({
          ...obj,
          keyResults: keyResultsMap[obj.id] || [],
        })) : undefined,
        bigRocks: filters.includeBigRocks ? bigRocks : undefined,
        teams: filters.includeTeams ? teams : undefined,
        groundingDocuments: filters.includeGroundingDocs ? groundingDocs : undefined,
        meetings: filters.includeMeetings ? meetings : undefined,
        summary: {
          totalObjectives,
          completedObjectives,
          avgProgress,
          totalBigRocks: bigRocks.length,
          completedBigRocks: bigRocks.filter((br: BigRock) => br.status === "completed").length,
          totalTeams: teams.length,
        },
      });
    } else {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${tenant.name.replace(/[^a-zA-Z0-9]/g, "_")}_Company_OS_${new Date().toISOString().split("T")[0]}.md"`);
      res.send(markdown);
    }
  } catch (error) {
    console.error("Error exporting Company OS:", error);
    res.status(500).json({ error: "Failed to export Company OS" });
  }
});

router.get("/strategic-alignment", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getUser(req.session.userId!);
    if (!user?.tenantId) {
      return res.status(403).json({ error: "No tenant access" });
    }

    // Use x-tenant-id header for tenant switching support (consultants/admins)
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    const effectiveTenantId = headerTenantId || user.tenantId;

    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : undefined;

    const [foundation, strategies, objectives, keyResults, bigRocks, teams] = await Promise.all([
      storage.getFoundationByTenantId(effectiveTenantId),
      storage.getStrategiesByTenantId(effectiveTenantId),
      storage.getObjectivesByTenantId(effectiveTenantId, quarter, year),
      storage.getKeyResultsByTenantId(effectiveTenantId),
      storage.getBigRocksByTenantId(effectiveTenantId, quarter, year),
      storage.getTeamsByTenantId(effectiveTenantId),
    ]);

    const objectiveIds = new Set(objectives.map(o => o.id));
    const filteredKeyResults = keyResults.filter(kr => objectiveIds.has(kr.objectiveId));

    res.json({
      foundation,
      strategies,
      objectives,
      keyResults: filteredKeyResults,
      bigRocks,
      teams,
    });
  } catch (error) {
    console.error("Error fetching strategic alignment:", error);
    res.status(500).json({ error: "Failed to fetch strategic alignment data" });
  }
});

export default router;
