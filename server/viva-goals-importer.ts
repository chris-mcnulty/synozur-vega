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
    if (viva['Phased Targets'] && viva['Phased Targets']['Phased Targets'].length > 0) {
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
    if (viva['Phased Targets'] && viva['Phased Targets']['Phased Targets'].length > 0) {
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
      phasedTargets,
      createdBy: this.options.userId,
      updatedBy: this.options.userId,
      lastCheckInAt: viva['Last Check-in'] ? new Date(viva['Last Check-in']) : undefined,
    };
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
    return {
      tenantId: this.options.tenantId,
      entityType,
      entityId,
      newValue: Math.round(viva['Current Value']),
      newProgress: Math.round(viva['Current Value']), // Assuming value equals progress
      newStatus: this.mapStatus(viva.Status),
      note: viva['Check In Note']?.['Check In Note'] || undefined,
      source: 'viva_goals_import',
      userId: this.options.userId,
      userEmail: viva['Check In Owner']?.Email || this.options.userEmail,
      asOfDate: new Date(viva['Activity Date']),
    };
  }

  getResult(): ImportResult {
    return this.result;
  }
}
