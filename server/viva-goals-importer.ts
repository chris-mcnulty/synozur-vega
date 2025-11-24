import AdmZip from 'adm-zip';
import type { Objective, KeyResult, BigRock, CheckIn, Team } from '@shared/schema';

// Viva Goals data types (from export JSON)
interface VivaTimePeriod {
  ID: number;
  'Time Period Name': string;
  'Start Date': string;
  'End Date': string;
}

interface VivaUser {
  ID: number;
  Name: string;
  Email: string;
}

interface VivaTeam {
  ID: number;
  'Team Name': string;
  'Parent Team': string;
  'Team Owners': VivaUser[];
  'Team Type': string;
  Status: string;
  Description: string | null;
}

interface VivaObjective {
  ID: number;
  Title: string;
  Type: 'Big rock' | 'Kpi' | 'Project';
  'Created By': VivaUser;
  Owner: VivaUser[];
  Teams: Array<{ ID: number; Name: string }> | null;
  'Time Period': { ID: number; Name: string };
  'Start Date': string;
  'End Date': string;
  Alignment: Array<{ ID: number; Title: string; Weight: string }> | null;
  Description: string | null;
  'Progress and Status Configuration': {
    Progress: string;
    Status: string;
  };
  Progress: number;
  Status: string;
  Outcome: {
    'Outcome Type': 'Percentage' | 'Metric';
    'Metric Name'?: string;
    'Metric Unit'?: string;
    Start?: number;
    Target?: number;
    'Target Type'?: string;
  };
  'Phased Targets'?: {
    Interval: string;
    'Phased Targets': Array<{
      'Target Value': number;
      'Target Date': string;
    }>;
  };
  'Check-in Owners': VivaUser[];
  'Parent IDs': number[];
  Children: Array<{ ID: number; Title: string; Type: string }> | null;
  Score: number;
  'Goal Type': string;
  'Created At': string;
  'Last Check-in': string;
}

interface VivaCheckIn {
  ID: number;
  'OKR ID': number;
  'CheckIn Date': string;
  'Check In Owner': VivaUser;
  'Check In Note': {
    'Check In Note': string;
    'Check In Note HTML': string;
  };
  'Metric Name': string;
  Status: string;
  'Current Value': number;
  'Activity Date': string;
}

interface ImportOptions {
  tenantId: string;
  userId: string;
  userEmail: string;
  fiscalYearStartMonth: number;
  duplicateStrategy: 'skip' | 'merge' | 'create';
  importCheckIns: boolean;
  importTeams: boolean;
}

interface ImportResult {
  status: 'success' | 'partial' | 'failed';
  summary: {
    objectivesCreated: number;
    keyResultsCreated: number;
    bigRocksCreated: number;
    checkInsCreated: number;
    teamsCreated: number;
  };
  warnings: string[];
  errors: string[];
  skippedItems: any[];
  entityMap: {
    [vivaId: number]: {
      type: 'objective' | 'key_result' | 'big_rock';
      vegaId: string;
    };
  };
}

export class VivaGoalsImporter {
  private options: ImportOptions;
  private result: ImportResult;
  private timePeriods: VivaTimePeriod[] = [];
  private teams: VivaTeam[] = [];
  private users: VivaUser[] = [];
  private objectives: VivaObjective[] = [];
  private checkIns: VivaCheckIn[] = [];

  constructor(options: ImportOptions) {
    this.options = options;
    this.result = {
      status: 'success',
      summary: {
        objectivesCreated: 0,
        keyResultsCreated: 0,
        bigRocksCreated: 0,
        checkInsCreated: 0,
        teamsCreated: 0,
      },
      warnings: [],
      errors: [],
      skippedItems: [],
      entityMap: {},
    };
  }

  async importFromZip(zipBuffer: Buffer): Promise<ImportResult> {
    try {
      // Extract ZIP file
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      // Parse JSON files
      for (const entry of zipEntries) {
        if (!entry.isDirectory && entry.entryName.endsWith('.json')) {
          const content = entry.getData().toString('utf8');
          const data = JSON.parse(content);

          if (entry.entryName.includes('TimePeriods')) {
            this.timePeriods = data;
          } else if (entry.entryName.includes('Teams')) {
            this.teams = data;
          } else if (entry.entryName.includes('Users')) {
            this.users = data;
          } else if (entry.entryName.includes('objectives')) {
            this.objectives = data;
          } else if (entry.entryName.includes('checkins')) {
            this.checkIns = data;
          }
        }
      }

      return this.result;
    } catch (error) {
      this.result.status = 'failed';
      this.result.errors.push(`Failed to parse ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.result;
    }
  }

  /**
   * Parse Viva Goals time period name to extract quarter and year
   * Examples: "Q1 2024" → {quarter: 1, year: 2024}, "Annual 2024" → {quarter: null, year: 2024}
   */
  parseTimePeriod(periodName: string): { quarter: number | null; year: number } {
    const quarterMatch = periodName.match(/Q(\d)\s+(\d{4})/);
    if (quarterMatch) {
      return {
        quarter: parseInt(quarterMatch[1]),
        year: parseInt(quarterMatch[2]),
      };
    }

    const annualMatch = periodName.match(/Annual\s+(\d{4})/);
    if (annualMatch) {
      return {
        quarter: null, // Annual objectives don't have a quarter
        year: parseInt(annualMatch[1]),
      };
    }

    this.result.warnings.push(`Could not parse time period: ${periodName}`);
    return { quarter: null, year: new Date().getFullYear() };
  }

  /**
   * Map Viva Goals status to Vega status
   */
  mapStatus(vivaStatus: string): string {
    const statusMap: Record<string, string> = {
      'On Track': 'on_track',
      'At Risk': 'at_risk',
      'Behind': 'behind',
      'Closed': 'completed',
      'Not Started': 'not_started',
    };
    return statusMap[vivaStatus] || 'not_started';
  }

  /**
   * Map Viva Goals metric type to Vega metric type
   */
  mapMetricType(targetType?: string): 'increase' | 'decrease' | 'maintain' | 'complete' {
    if (!targetType) return 'increase';
    
    const lowerType = targetType.toLowerCase();
    if (lowerType.includes('increase')) return 'increase';
    if (lowerType.includes('decrease')) return 'decrease';
    if (lowerType.includes('maintain')) return 'maintain';
    if (lowerType.includes('complete')) return 'complete';
    
    return 'increase';
  }

  /**
   * Convert Viva Goals "Big rock" to Vega "Objective"
   */
  mapBigRockToObjective(viva: VivaObjective): Partial<Objective> {
    const timePeriod = this.parseTimePeriod(viva['Time Period'].Name);
    const owner = viva.Owner && viva.Owner.length > 0 ? viva.Owner[0] : null;

    // Map phased targets if present
    let phasedTargets = undefined;
    if (viva['Phased Targets'] && viva['Phased Targets']['Phased Targets'] && viva['Phased Targets']['Phased Targets'].length > 0) {
      phasedTargets = {
        interval: viva['Phased Targets'].Interval === 'monthly' ? 'monthly' as const : 
                  viva['Phased Targets'].Interval === 'quarterly' ? 'quarterly' as const : 
                  'custom' as const,
        targets: viva['Phased Targets']['Phased Targets'].map(t => ({
          targetValue: t['Target Value'],
          targetDate: t['Target Date'],
        })),
      };
    }

    return {
      tenantId: this.options.tenantId,
      title: viva.Title,
      description: viva.Description || undefined,
      level: 'organization', // Default to organization level
      ownerEmail: owner?.Email || undefined,
      progress: Math.round(viva.Progress),
      progressMode: viva['Progress and Status Configuration'].Progress.includes('Children') ? 'rollup' : 'manual',
      status: this.mapStatus(viva.Status),
      quarter: timePeriod.quarter || undefined,
      year: timePeriod.year,
      startDate: new Date(viva['Start Date']),
      endDate: new Date(viva['End Date']),
      goalType: viva['Goal Type']?.toLowerCase() === 'aspirational' ? 'aspirational' : 'committed',
      phasedTargets,
      createdBy: this.options.userId,
      updatedBy: this.options.userId,
      lastCheckInAt: viva['Last Check-in'] ? new Date(viva['Last Check-in']) : undefined,
    };
  }

  /**
   * Convert Viva Goals "Kpi" to Vega "Key Result"
   */
  mapKpiToKeyResult(viva: VivaObjective, objectiveId: string): Partial<KeyResult> {
    const owner = viva.Owner && viva.Owner.length > 0 ? viva.Owner[0] : null;
    const outcome = viva.Outcome;

    // Determine metric type and values
    let metricType: 'increase' | 'decrease' | 'maintain' | 'complete' = 'increase';
    let currentValue = 0;
    let targetValue = 100;
    let initialValue = 0;
    let unit = outcome['Metric Unit'] || undefined;

    if (outcome['Outcome Type'] === 'Metric') {
      metricType = this.mapMetricType(outcome['Target Type']);
      initialValue = outcome.Start || 0;
      targetValue = outcome.Target || 100;
      
      // Calculate current value from progress
      const progress = viva.Progress / 100;
      if (metricType === 'increase') {
        currentValue = Math.round(initialValue + (targetValue - initialValue) * progress);
      } else if (metricType === 'decrease') {
        currentValue = Math.round(initialValue - (initialValue - targetValue) * progress);
      } else {
        currentValue = Math.round(targetValue * progress);
      }
    } else {
      // Percentage-based
      currentValue = Math.round(viva.Progress);
      targetValue = 100;
      unit = '%';
    }

    // Map phased targets if present
    let phasedTargets = undefined;
    if (viva['Phased Targets'] && viva['Phased Targets']['Phased Targets'] && viva['Phased Targets']['Phased Targets'].length > 0) {
      phasedTargets = {
        interval: viva['Phased Targets'].Interval === 'monthly' ? 'monthly' as const : 
                  viva['Phased Targets'].Interval === 'quarterly' ? 'quarterly' as const : 
                  'custom' as const,
        targets: viva['Phased Targets']['Phased Targets'].map(t => ({
          targetValue: t['Target Value'],
          targetDate: t['Target Date'],
        })),
      };
    }

    const keyResult: Partial<KeyResult> = {
      objectiveId,
      tenantId: this.options.tenantId,
      title: viva.Title,
      description: viva.Description || undefined,
      metricType,
      currentValue,
      targetValue,
      initialValue,
      unit,
      progress: Math.round(viva.Progress),
      weight: 25, // Default weight, will be adjusted if parent has alignment weights
      status: this.mapStatus(viva.Status),
      createdBy: this.options.userId,
      updatedBy: this.options.userId,
      lastCheckInAt: viva['Last Check-in'] ? new Date(viva['Last Check-in']) : undefined,
    };

    // Add phased targets if present (preserve milestone data)
    if (phasedTargets) {
      keyResult.phasedTargets = phasedTargets;
    }

    return keyResult;
  }

  /**
   * Convert Viva Goals "Project" to Vega "Big Rock"
   */
  mapProjectToBigRock(viva: VivaObjective): Partial<BigRock> {
    const timePeriod = this.parseTimePeriod(viva['Time Period'].Name);
    const owner = viva.Owner && viva.Owner.length > 0 ? viva.Owner[0] : null;

    return {
      tenantId: this.options.tenantId,
      title: viva.Title,
      description: viva.Description || undefined,
      ownerEmail: owner?.Email || undefined,
      status: this.mapStatus(viva.Status),
      completionPercentage: Math.round(viva.Progress),
      quarter: timePeriod.quarter || undefined,
      year: timePeriod.year,
      startDate: new Date(viva['Start Date']),
      dueDate: new Date(viva['End Date']),
      createdBy: this.options.userId,
      updatedBy: this.options.userId,
    };
  }

  /**
   * Convert Viva Goals check-in to Vega check-in
   */
  mapCheckIn(viva: VivaCheckIn, entityType: 'objective' | 'key_result' | 'big_rock', entityId: string): Partial<CheckIn> {
    // For imported check-ins, we don't have historical previous values
    // Use 0 as default for previousProgress/previousValue
    return {
      tenantId: this.options.tenantId,
      entityType,
      entityId,
      previousValue: 0, // Default for imports
      newValue: Math.round(viva['Current Value']),
      previousProgress: 0, // Default for imports
      newProgress: Math.round(viva['Current Value']), // Assuming value equals progress
      previousStatus: 'not_started', // Default for imports
      newStatus: this.mapStatus(viva.Status),
      note: viva['Check In Note']?.['Check In Note'] || undefined,
      source: 'viva_goals_import',
      userId: this.options.userId,
      userEmail: viva['Check In Owner']?.Email || this.options.userEmail,
      asOfDate: new Date(viva['Activity Date']),
    };
  }

  /**
   * Execute the import - create all entities in the database
   */
  async executeImport(storage: any): Promise<ImportResult> {
    try {
      // Phase 1: Create organization-level objectives (Viva "Big rocks")
      const bigRockMap = new Map<number, string>(); // vivaId -> vegaId
      
      const bigRocks = this.objectives.filter(obj => obj.Type === 'Big rock' && !obj['Parent IDs']?.length);
      
      for (const viva of bigRocks) {
        try {
          const objectiveData = this.mapBigRockToObjective(viva);
          
          // Check for duplicates
          const existing = await storage.getObjectives({
            tenantId: objectiveData.tenantId,
            quarter: objectiveData.quarter,
            year: objectiveData.year,
          });
          
          const duplicate = existing.find((obj: any) => obj.title === objectiveData.title);
          
          if (duplicate) {
            if (this.options.duplicateStrategy === 'skip') {
              this.result.warnings.push(`Skipped duplicate objective: "${viva.Title}"`);
              this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
              // Still map it so child entities can reference it
              bigRockMap.set(viva.ID, duplicate.id);
              this.result.entityMap[viva.ID] = {
                type: 'objective',
                vegaId: duplicate.id,
              };
              continue;
            }
          }
          
          const created = await storage.createObjective(objectiveData);
          
          bigRockMap.set(viva.ID, created.id);
          this.result.entityMap[viva.ID] = {
            type: 'objective',
            vegaId: created.id,
          };
          this.result.summary.objectivesCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import objective "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 2: Create Key Results (Viva "KPIs") under objectives
      const kpis = this.objectives.filter(obj => obj.Type === 'Kpi');
      
      for (const viva of kpis) {
        try {
          // Find parent objective
          const parentVivaId = viva['Parent IDs']?.[0];
          const parentVegaId = parentVivaId ? bigRockMap.get(parentVivaId) : null;
          
          if (!parentVegaId) {
            this.result.warnings.push(`KPI "${viva.Title}" has no valid parent objective, skipping`);
            this.result.skippedItems.push({ type: 'key_result', title: viva.Title, vivaId: viva.ID });
            continue;
          }

          const keyResultData = this.mapKpiToKeyResult(viva, parentVegaId);
          const created = await storage.createKeyResult(keyResultData);
          
          this.result.entityMap[viva.ID] = {
            type: 'key_result',
            vegaId: created.id,
          };
          this.result.summary.keyResultsCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import key result "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'key_result', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 3: Create Big Rocks (Viva "Projects")
      const projects = this.objectives.filter(obj => obj.Type === 'Project');
      
      for (const viva of projects) {
        try {
          const bigRockData = this.mapProjectToBigRock(viva);
          
          // Try to link to parent objective if available
          const parentVivaId = viva['Parent IDs']?.[0];
          const parentVegaId = parentVivaId ? bigRockMap.get(parentVivaId) : null;
          
          if (parentVegaId) {
            bigRockData.objectiveId = parentVegaId;
          }

          const created = await storage.createBigRock(bigRockData);
          
          this.result.entityMap[viva.ID] = {
            type: 'big_rock',
            vegaId: created.id,
          };
          this.result.summary.bigRocksCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import big rock "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'big_rock', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 4: Import check-ins (if enabled)
      if (this.options.importCheckIns && this.checkIns.length > 0) {
        for (const vivaCheckIn of this.checkIns) {
          try {
            const entityMapping = this.result.entityMap[vivaCheckIn['OKR ID']];
            
            if (!entityMapping) {
              // Skip check-ins for entities that weren't imported
              continue;
            }

            const checkInData = this.mapCheckIn(
              vivaCheckIn, 
              entityMapping.type, 
              entityMapping.vegaId
            );
            
            await storage.createCheckIn(checkInData);
            this.result.summary.checkInsCreated++;
          } catch (error) {
            // Don't fail import for check-in errors, just log
            console.error(`Failed to import check-in:`, error);
          }
        }
      }

      // Determine final status
      if (this.result.errors.length > 0) {
        this.result.status = 'partial';
      } else if (this.result.warnings.length > 0) {
        this.result.status = 'partial';
      } else {
        this.result.status = 'success';
      }

      return this.result;
    } catch (error) {
      this.result.status = 'failed';
      this.result.errors.push(`Import execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.result;
    }
  }

  getResult(): ImportResult {
    return this.result;
  }
}
