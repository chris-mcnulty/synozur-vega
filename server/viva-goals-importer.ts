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
      // For key results: store target info to calculate check-in progress correctly
      targetValue?: number;
      initialValue?: number;
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
   * Also handles: "Quarter 1 FY25", "Quarter1 2025", "1Q 2025"
   */
  parseTimePeriod(periodName: string): { quarter: number | null; year: number } {
    // First, try to lookup in TimePeriods export if available
    if (this.timePeriods.length > 0) {
      const matchingPeriod = this.timePeriods.find(tp => tp['Time Period Name'] === periodName);
      if (matchingPeriod && matchingPeriod['Start Date']) {
        // Parse the start date to extract year and derive quarter
        const startDate = new Date(matchingPeriod['Start Date']);
        const year = startDate.getFullYear();
        const month = startDate.getMonth(); // 0-based
        // Derive quarter from month: Jan-Mar = Q1, Apr-Jun = Q2, Jul-Sep = Q3, Oct-Dec = Q4
        const quarter = Math.floor(month / 3) + 1;
        console.log(`[DEBUG] Parsed "${periodName}" from TimePeriods export: Q${quarter} ${year}`);
        return { quarter, year };
      }
    }
    
    // Pattern 1: "Q1 2025" or "Q1  2025" (with variable whitespace)
    const quarterMatch = periodName.match(/Q(\d)\s+(\d{4})/i);
    if (quarterMatch) {
      return {
        quarter: parseInt(quarterMatch[1]),
        year: parseInt(quarterMatch[2]),
      };
    }

    // Pattern 2: "2025 Q1" (year first)
    const yearFirstMatch = periodName.match(/(\d{4})\s+Q(\d)/i);
    if (yearFirstMatch) {
      return {
        quarter: parseInt(yearFirstMatch[2]),
        year: parseInt(yearFirstMatch[1]),
      };
    }
    
    // Pattern 3: "Quarter 1 FY25" or "Quarter 1 2025" or "Quarter1 FY25"
    const quarterWordMatch = periodName.match(/Quarter\s*(\d)\s+(?:FY)?(\d{2,4})/i);
    if (quarterWordMatch) {
      let year = parseInt(quarterWordMatch[2]);
      // Handle 2-digit year: 25 → 2025
      if (year < 100) {
        year = 2000 + year;
      }
      return {
        quarter: parseInt(quarterWordMatch[1]),
        year,
      };
    }
    
    // Pattern 4: "1Q 2025" or "1Q25"
    const numQMatch = periodName.match(/(\d)Q\s*(\d{2,4})/i);
    if (numQMatch) {
      let year = parseInt(numQMatch[2]);
      if (year < 100) {
        year = 2000 + year;
      }
      return {
        quarter: parseInt(numQMatch[1]),
        year,
      };
    }

    // Pattern 5: "FY25 Q1" or "FY2025 Q1"
    const fyMatch = periodName.match(/FY\s*(\d{2,4})\s*Q(\d)/i);
    if (fyMatch) {
      let year = parseInt(fyMatch[1]);
      if (year < 100) {
        year = 2000 + year;
      }
      return {
        quarter: parseInt(fyMatch[2]),
        year,
      };
    }

    // Pattern 6: "Annual 2025" or "FY 2025" (with no quarter)
    const annualMatch = periodName.match(/(?:Annual|FY)\s*(\d{4})/i);
    if (annualMatch) {
      return {
        quarter: null, // Annual objectives don't have a quarter
        year: parseInt(annualMatch[1]),
      };
    }

    // Pattern 7: Just a year "2025"
    const yearOnlyMatch = periodName.match(/^(\d{4})$/);
    if (yearOnlyMatch) {
      return {
        quarter: null,
        year: parseInt(yearOnlyMatch[1]),
      };
    }

    // Pattern 8: "January 2025" or month names - extract year and derive quarter
    const monthYearMatch = periodName.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (monthYearMatch) {
      const months: Record<string, number> = {
        january: 1, february: 1, march: 1,
        april: 2, may: 2, june: 2,
        july: 3, august: 3, september: 3,
        october: 4, november: 4, december: 4,
      };
      return {
        quarter: months[monthYearMatch[1].toLowerCase()],
        year: parseInt(monthYearMatch[2]),
      };
    }
    
    // Pattern 9: Extract any 4-digit year and any single digit as quarter
    const fallbackYear = periodName.match(/(\d{4})/);
    const fallbackQuarter = periodName.match(/[Qq](\d)|Quarter\s*(\d)|(\d)[Qq]/i);
    if (fallbackYear) {
      const qNum = fallbackQuarter ? parseInt(fallbackQuarter[1] || fallbackQuarter[2] || fallbackQuarter[3]) : null;
      console.log(`[DEBUG] Fallback parse of "${periodName}": Q${qNum} ${fallbackYear[1]}`);
      return {
        quarter: qNum && qNum >= 1 && qNum <= 4 ? qNum : null,
        year: parseInt(fallbackYear[1]),
      };
    }

    console.log(`[DEBUG] Could not parse time period: "${periodName}"`);
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
   * Viva Goals uses various phrases like "Keep below", "At most", "Reach", "Maintain at"
   */
  mapMetricType(targetType?: string): 'increase' | 'decrease' | 'maintain' | 'complete' {
    if (!targetType) return 'increase';
    
    const lowerType = targetType.toLowerCase();
    
    // Decrease patterns: "Keep below", "At most", "Reduce to", "Decrease to", "Less than"
    if (lowerType.includes('below') || 
        lowerType.includes('at most') || 
        lowerType.includes('decrease') ||
        lowerType.includes('reduce') ||
        lowerType.includes('less than') ||
        lowerType.includes('under')) {
      return 'decrease';
    }
    
    // Maintain patterns: "Maintain at", "Keep at", "Stay at"
    if (lowerType.includes('maintain') || 
        lowerType.includes('keep at') || 
        lowerType.includes('stay at') ||
        lowerType.includes('hold at')) {
      return 'maintain';
    }
    
    // Complete patterns: "Complete", "Finish", "Done"
    if (lowerType.includes('complete') || 
        lowerType.includes('finish') ||
        lowerType.includes('done')) {
      return 'complete';
    }
    
    // Increase patterns (default): "Reach", "Increase to", "Grow to", "At least", "More than"
    if (lowerType.includes('increase') ||
        lowerType.includes('reach') ||
        lowerType.includes('grow') ||
        lowerType.includes('at least') ||
        lowerType.includes('more than') ||
        lowerType.includes('above')) {
      return 'increase';
    }
    
    // Default to increase if no pattern matches
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
      progress: viva.Progress,
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
   * Parse a numeric value that might be a string with commas
   * "3,637,839" → 3637839, "22" → 22, 100 → 100
   */
  parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      // Remove commas and other formatting, then parse
      const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Convert Viva Goals "Kpi" to Vega "Key Result"
   * 
   * IMPORTANT: For absolute numeric metrics (like "website traffic"), we preserve raw values
   * and let the UI calculate progress. Progress field stores the pre-calculated percentage
   * for display purposes. The key distinction is:
   * - unit = '%' or undefined: percentage-based KR, currentValue is 0-100
   * - unit = 'Number' or specific unit: absolute KR, currentValue is raw value
   */
  mapKpiToKeyResult(viva: VivaObjective, objectiveId: string): Partial<KeyResult> {
    const owner = viva.Owner && viva.Owner.length > 0 ? viva.Owner[0] : null;
    const outcome = viva.Outcome;

    // Determine metric type and values
    let metricType: 'increase' | 'decrease' | 'maintain' | 'complete' = 'increase';
    let currentValue = 0;
    let targetValue = 100;
    let initialValue = 0;
    let unit: string | undefined = undefined;

    // Debug: Log the raw outcome data for troubleshooting
    console.log(`[DEBUG] Parsing KPI "${viva.Title}":`);
    console.log(`  - Outcome Type: ${outcome['Outcome Type']}`);
    console.log(`  - Target Type: ${outcome['Target Type']}`);
    console.log(`  - Raw Start: ${outcome.Start} (type: ${typeof outcome.Start})`);
    console.log(`  - Raw Target: ${outcome.Target} (type: ${typeof outcome.Target})`);
    console.log(`  - Metric Unit: ${outcome['Metric Unit']}`);
    console.log(`  - Progress: ${viva.Progress}`);

    if (outcome['Outcome Type'] === 'Metric') {
      metricType = this.mapMetricType(outcome['Target Type']);
      
      // Parse numeric values properly (handle string values with commas)
      initialValue = this.parseNumericValue(outcome.Start);
      targetValue = this.parseNumericValue(outcome.Target) || 100;
      
      console.log(`  - Parsed Start: ${initialValue}, Parsed Target: ${targetValue}`);
      console.log(`  - Determined metricType: ${metricType}`);
      
      // Set unit FIRST - IMPORTANT: respect the actual metric unit from Viva
      const vivaUnit = outcome['Metric Unit'];
      if (vivaUnit === '%' || vivaUnit === 'Percentage') {
        // Explicit percentage unit
        unit = '%';
      } else if (vivaUnit && vivaUnit !== '') {
        // Specific unit like "webinars", "views", "$", "Dollar", etc.
        unit = vivaUnit;
      } else {
        // No unit specified - check if it looks like a percentage or absolute
        // If target is 100 with no unit AND start is 0, it's likely a percentage
        // Otherwise it's an absolute number
        if (targetValue === 100 && initialValue === 0) {
          unit = '%';
        } else {
          unit = 'Number';
        }
      }
      
      // Determine if Progress is an actual value or a percentage
      // Key insight: In Viva Goals, for absolute metrics:
      // - If Progress > 100, it's definitely the actual current value (e.g., 16108 visits)
      // - If Progress <= 100 and target > 100, it could be either - we need heuristics
      // - For percentage metrics, Progress is always 0-100
      
      if (unit === '%') {
        // Percentage-based: progress value IS the current percentage (0-100 scale)
        currentValue = viva.Progress;
      } else {
        // Absolute metrics: Progress could be actual value OR percentage
        // Heuristic: If Progress > 100 OR if Progress is in same order of magnitude as target,
        // then Progress IS the actual current value
        const progress = viva.Progress || 0;
        
        // Check if progress looks like an actual value vs percentage
        // If progress > 100, it's definitely the actual value
        // If progress is within reasonable range of target (same order of magnitude), it's the actual value
        const isActualValue = progress > 100 || 
          (targetValue > 100 && progress > 10 && progress >= targetValue * 0.01);
        
        if (isActualValue) {
          // Progress IS the actual current value
          currentValue = progress;
          console.log(`  - Progress ${progress} interpreted as ACTUAL VALUE`);
        } else {
          // Progress is a percentage (0-100)
          const progressFraction = progress / 100;
          
          if (metricType === 'increase') {
            currentValue = initialValue + (targetValue - initialValue) * progressFraction;
          } else if (metricType === 'decrease') {
            currentValue = initialValue - (initialValue - targetValue) * progressFraction;
          } else if (metricType === 'maintain') {
            currentValue = targetValue;
          } else {
            currentValue = progress;
          }
          console.log(`  - Progress ${progress} interpreted as PERCENTAGE`);
        }
      }
      
      console.log(`  - Final unit: ${unit}, currentValue: ${currentValue}`);
    } else {
      // Percentage-based outcome (not Metric type)
      currentValue = viva.Progress;
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
      progress: viva.Progress,
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
      completionPercentage: viva.Progress, // Preserve decimal values
      quarter: timePeriod.quarter || 1, // Default to Q1 if not specified
      year: timePeriod.year,
      startDate: new Date(viva['Start Date']),
      dueDate: new Date(viva['End Date']),
      createdBy: this.options.userId,
      updatedBy: this.options.userId,
    };
  }

  /**
   * Convert Viva Goals check-in to Vega check-in
   * 
   * For key results with absolute values (e.g., "website traffic = 11,250"):
   * - newValue stores the RAW current value from check-in (e.g., 1,812,150)
   * - newProgress stores the CALCULATED percentage (e.g., 100 if over target)
   * 
   * The UI should use progress for display, but show raw values in the tooltip/detail
   */
  mapCheckIn(
    viva: VivaCheckIn, 
    entityType: 'objective' | 'key_result' | 'big_rock', 
    entityId: string,
    entityInfo?: { targetValue?: number; initialValue?: number; unit?: string }
  ): Partial<CheckIn> {
    // For imported check-ins, we don't have historical previous values
    // Use 0 as default for previousProgress/previousValue
    
    // Calculate progress as percentage for key results with absolute targets
    const rawValue = viva['Current Value'];
    let newProgress = rawValue;
    
    if (entityType === 'key_result' && entityInfo) {
      const target = entityInfo.targetValue ?? 100;
      const initial = entityInfo.initialValue ?? 0;
      
      // Calculate progress: ((current - initial) / (target - initial)) * 100
      // Handle edge cases: if target equals initial, avoid division by zero
      if (target !== initial) {
        // For "increase" type metrics
        const calculatedProgress = ((rawValue - initial) / (target - initial)) * 100;
        // Cap at 100% for display purposes, but allow over 100% to track exceeding targets
        newProgress = Math.max(0, calculatedProgress);
      } else {
        // If target equals initial and current equals target, it's 100%
        newProgress = rawValue >= target ? 100 : 0;
      }
    }
    
    return {
      tenantId: this.options.tenantId,
      entityType,
      entityId,
      previousValue: 0, // Default for imports
      newValue: rawValue, // Store the RAW value from the check-in
      previousProgress: 0, // Default for imports
      newProgress, // Calculated progress percentage (for display)
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
   * Determine objective level based on Viva Goals data
   */
  determineObjectiveLevel(viva: VivaObjective): 'organization' | 'division' | 'team' | 'individual' {
    // Check if it has a team assignment
    if (viva.Teams && viva.Teams.length > 0) {
      return 'team';
    }
    
    // If it has a parent but no team, it might be division or individual
    if (viva['Parent IDs'] && viva['Parent IDs'].length > 0) {
      // For now, treat parent objectives without teams as division level
      return 'division';
    }
    
    // No parent, no team = organization level
    return 'organization';
  }

  /**
   * Execute the import - create all entities in the database
   */
  async executeImport(storage: any): Promise<ImportResult> {
    try {
      const objectiveMap = new Map<number, string>(); // vivaId -> vegaId
      const teamMap = new Map<number, string>(); // vivaTeamId -> vegaTeamId
      
      // Debug: Log all objectives to understand types and parents
      console.log('\n=== VIVA GOALS IMPORT DEBUG ===');
      console.log(`Total objectives in export: ${this.objectives.length}`);
      const typeCount: Record<string, number> = {};
      for (const obj of this.objectives) {
        typeCount[obj.Type] = (typeCount[obj.Type] || 0) + 1;
      }
      console.log('Objective types:', typeCount);
      
      // Debug: Find specific objectives user mentioned
      const reachAndSustain = this.objectives.find(o => o.Title.toLowerCase().includes('reach and sustain'));
      const podcast = this.objectives.find(o => o.Title.toLowerCase().includes('podcast'));
      
      if (reachAndSustain) {
        console.log(`\n[DEBUG] "Reach and sustain..." found:`);
        console.log(`  - Viva ID: ${reachAndSustain.ID}`);
        console.log(`  - Type: ${reachAndSustain.Type}`);
        console.log(`  - Parent IDs: ${JSON.stringify(reachAndSustain['Parent IDs'])}`);
      }
      if (podcast) {
        console.log(`\n[DEBUG] "Podcast" found:`);
        console.log(`  - Viva ID: ${podcast.ID}`);
        console.log(`  - Type: ${podcast.Type}`);
        console.log(`  - Parent IDs: ${JSON.stringify(podcast['Parent IDs'])}`);
      }
      
      // Phase 0: Import or map teams
      if (this.options.importTeams && this.teams.length > 0) {
        for (const vivaTeam of this.teams) {
          try {
            // Check if team already exists by name
            const existingTeam = await storage.getTeamByName(
              this.options.tenantId, 
              vivaTeam['Team Name']
            );
            
            if (existingTeam) {
              // Map existing team
              teamMap.set(vivaTeam.ID, existingTeam.id);
            } else {
              // Create new team
              const teamData = {
                tenantId: this.options.tenantId,
                name: vivaTeam['Team Name'],
                description: vivaTeam.Description || undefined,
                leaderEmail: vivaTeam['Team Owners']?.[0]?.Email || undefined,
                createdBy: this.options.userId,
                updatedBy: this.options.userId,
              };
              
              const created = await storage.createTeam(teamData);
              teamMap.set(vivaTeam.ID, created.id);
              this.result.summary.teamsCreated++;
            }
          } catch (error) {
            this.result.warnings.push(`Failed to import team "${vivaTeam['Team Name']}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      // Also map teams from objectives (some teams may only appear in objective references)
      for (const viva of this.objectives) {
        if (viva.Teams && viva.Teams.length > 0) {
          for (const vivaTeamRef of viva.Teams) {
            if (!teamMap.has(vivaTeamRef.ID)) {
              try {
                // Check if team exists by name
                const existingTeam = await storage.getTeamByName(
                  this.options.tenantId,
                  vivaTeamRef.Name
                );
                
                if (existingTeam) {
                  teamMap.set(vivaTeamRef.ID, existingTeam.id);
                } else if (this.options.importTeams) {
                  // Create team from reference
                  const teamData = {
                    tenantId: this.options.tenantId,
                    name: vivaTeamRef.Name,
                    createdBy: this.options.userId,
                    updatedBy: this.options.userId,
                  };
                  
                  const created = await storage.createTeam(teamData);
                  teamMap.set(vivaTeamRef.ID, created.id);
                  this.result.summary.teamsCreated++;
                }
              } catch (error) {
                // Silently continue - team mapping is best effort
              }
            }
          }
        }
      }
      
      // Get all objectives (Viva Goals uses various Type values)
      // Include: 'Big rock', 'BigRock', 'Objective', 'Goal', and any other non-KPI/non-Project types
      const objectiveTypes = new Set(['Big rock', 'BigRock', 'Objective', 'Goal', 'Objective (Team)', 'Objective (Org)']);
      const allBigRocks = this.objectives.filter(obj => 
        objectiveTypes.has(obj.Type) || 
        (obj.Type !== 'Kpi' && obj.Type !== 'Project')  // Fallback: include anything that's not a KPI or Project
      );
      
      // Log type distribution for debugging
      const typeDistribution = new Map<string, number>();
      for (const obj of this.objectives) {
        typeDistribution.set(obj.Type, (typeDistribution.get(obj.Type) || 0) + 1);
      }
      console.log(`\n[DEBUG] Viva Goals Type distribution in export:`);
      Array.from(typeDistribution.entries()).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} items`);
      });
      console.log(`[DEBUG] Objectives for Phase 1+2: ${allBigRocks.length}`);
      
      // Phase 1: Create organization-level objectives (no parents)
      // Sort alphabetically by title for consistent ordering
      const orgLevelObjectives = allBigRocks
        .filter(obj => !obj['Parent IDs']?.length)
        .sort((a, b) => a.Title.localeCompare(b.Title));
      
      for (const viva of orgLevelObjectives) {
        try {
          const objectiveData = this.mapBigRockToObjective(viva);
          
          // Set teamId if objective has a team assignment
          if (viva.Teams && viva.Teams.length > 0) {
            const vivaTeamId = viva.Teams[0].ID;
            const vegaTeamId = teamMap.get(vivaTeamId);
            if (vegaTeamId) {
              objectiveData.teamId = vegaTeamId;
            }
          }
          
          // Check for duplicates
          const existing = await storage.getObjectivesByTenantId(
            objectiveData.tenantId!,
            objectiveData.quarter,
            objectiveData.year
          );
          
          const duplicate = existing.find((obj: any) => obj.title === objectiveData.title);
          
          if (duplicate) {
            if (this.options.duplicateStrategy === 'skip') {
              this.result.warnings.push(`Skipped duplicate objective: "${viva.Title}"`);
              this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
              // Still map it so child entities can reference it
              objectiveMap.set(viva.ID, duplicate.id);
              this.result.entityMap[viva.ID] = {
                type: 'objective',
                vegaId: duplicate.id,
              };
              continue;
            } else if (this.options.duplicateStrategy === 'merge') {
              // Update existing objective
              await storage.updateObjective(duplicate.id, objectiveData);
              objectiveMap.set(viva.ID, duplicate.id);
              this.result.entityMap[viva.ID] = {
                type: 'objective',
                vegaId: duplicate.id,
              };
              continue;
            }
          }
          
          const created = await storage.createObjective(objectiveData);
          
          objectiveMap.set(viva.ID, created.id);
          this.result.entityMap[viva.ID] = {
            type: 'objective',
            vegaId: created.id,
          };
          this.result.summary.objectivesCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import organization objective "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 2: Create child objectives (team/division level with parents)
      // Sort by hierarchy depth to ensure parents are processed before children
      const childObjectives = allBigRocks.filter(obj => obj['Parent IDs']?.length > 0);
      
      // Build a depth map - objectives whose parents are already in objectiveMap have depth 0
      // Others have depth based on how many hops to reach an already-mapped parent
      const getDepth = (obj: VivaObjective, visited: Set<number> = new Set()): number => {
        if (visited.has(obj.ID)) return 999; // Prevent cycles
        visited.add(obj.ID);
        
        const parentId = obj['Parent IDs']?.[0];
        if (!parentId) return 0;
        if (objectiveMap.has(parentId)) return 0;
        
        // Find parent in childObjectives
        const parent = childObjectives.find(o => o.ID === parentId);
        if (!parent) return 0; // Parent not in this batch, treat as root
        
        return 1 + getDepth(parent, visited);
      };
      
      // Sort by depth (ascending) so parents are processed first, then alphabetically within same depth
      const sortedChildObjectives = [...childObjectives].sort((a, b) => {
        const depthDiff = getDepth(a) - getDepth(b);
        if (depthDiff !== 0) return depthDiff;
        return a.Title.localeCompare(b.Title);
      });
      
      // Debug: Log what parent IDs we're looking for
      console.log(`\n[DEBUG] Phase 2 - Processing ${sortedChildObjectives.length} child objectives (sorted by hierarchy depth)`);
      console.log(`[DEBUG] ObjectiveMap has ${objectiveMap.size} entries from Phase 1`);
      
      for (const viva of sortedChildObjectives) {
        try {
          const objectiveData = this.mapBigRockToObjective(viva);
          
          // Determine the level
          objectiveData.level = this.determineObjectiveLevel(viva);
          
          // Link to parent objective
          const parentVivaId = viva['Parent IDs']?.[0];
          const parentVegaId = parentVivaId ? objectiveMap.get(parentVivaId) : null;
          
          // Debug: Trace specific objectives
          if (viva.Title.toLowerCase().includes('podcast') || viva.Title.toLowerCase().includes('reach and sustain')) {
            console.log(`\n[DEBUG] Processing child objective: "${viva.Title}"`);
            console.log(`  - Viva ID: ${viva.ID}`);
            console.log(`  - Parent Viva ID: ${parentVivaId}`);
            console.log(`  - Parent Vega ID from map: ${parentVegaId || 'NOT FOUND'}`);
            // Find parent in original data
            const parentInExport = this.objectives.find(o => o.ID === parentVivaId);
            console.log(`  - Parent in export: ${parentInExport?.Title || 'NOT IN EXPORT'} (Type: ${parentInExport?.Type})`);
          }
          
          if (parentVegaId) {
            objectiveData.parentId = parentVegaId;
          } else {
            this.result.warnings.push(`Child objective "${viva.Title}" parent not found, importing as top-level`);
          }
          
          // Set teamId if objective has a team assignment
          if (viva.Teams && viva.Teams.length > 0) {
            const vivaTeamId = viva.Teams[0].ID;
            const vegaTeamId = teamMap.get(vivaTeamId);
            if (vegaTeamId) {
              objectiveData.teamId = vegaTeamId;
            }
          }
          
          // Check for duplicates
          const existing = await storage.getObjectivesByTenantId(
            objectiveData.tenantId!,
            objectiveData.quarter,
            objectiveData.year
          );
          
          const duplicate = existing.find((obj: any) => obj.title === objectiveData.title);
          
          if (duplicate) {
            if (this.options.duplicateStrategy === 'skip') {
              this.result.warnings.push(`Skipped duplicate child objective: "${viva.Title}"`);
              this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
              // Still map it so child entities can reference it
              objectiveMap.set(viva.ID, duplicate.id);
              this.result.entityMap[viva.ID] = {
                type: 'objective',
                vegaId: duplicate.id,
              };
              continue;
            } else if (this.options.duplicateStrategy === 'merge') {
              // Update existing objective - CRITICAL: include parentId to preserve hierarchy
              // objectiveData already has parentId set from the mapping above
              await storage.updateObjective(duplicate.id, objectiveData);
              objectiveMap.set(viva.ID, duplicate.id);
              this.result.entityMap[viva.ID] = {
                type: 'objective',
                vegaId: duplicate.id,
              };
              this.result.summary.objectivesCreated++; // Count merged as created for accuracy
              continue;
            }
          }
          
          const created = await storage.createObjective(objectiveData);
          
          objectiveMap.set(viva.ID, created.id);
          this.result.entityMap[viva.ID] = {
            type: 'objective',
            vegaId: created.id,
          };
          this.result.summary.objectivesCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import child objective "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'objective', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 3: Create Key Results (Viva "KPIs") under objectives
      const kpis = this.objectives.filter(obj => obj.Type === 'Kpi');
      
      // Pre-scan to find missing parent objectives and create placeholders
      const missingParentIds = new Set<number>();
      for (const kpi of kpis) {
        const parentVivaId = kpi['Parent IDs']?.[0];
        if (parentVivaId && !objectiveMap.has(parentVivaId)) {
          missingParentIds.add(parentVivaId);
        }
      }
      
      // Create placeholder objectives for missing parents
      if (missingParentIds.size > 0) {
        for (const missingId of Array.from(missingParentIds)) {
          try {
            // Find any KPI that references this missing parent to get time period info
            const sampleKpi = kpis.find(k => k['Parent IDs']?.[0] === missingId);
            if (sampleKpi) {
              const timePeriod = this.parseTimePeriod(sampleKpi['Time Period'].Name);
              
              const placeholderObjective: Partial<Objective> = {
                tenantId: this.options.tenantId,
                title: `[Imported] Missing Parent Objective (Viva ID: ${missingId})`,
                description: `Placeholder for parent objective not included in Viva Goals export. Contains orphaned KPIs.`,
                level: 'organization',
                progress: 0,
                progressMode: 'rollup',
                status: 'not_started',
                quarter: timePeriod.quarter || undefined,
                year: timePeriod.year,
                createdBy: this.options.userId,
                updatedBy: this.options.userId,
              };
              
              const created = await storage.createObjective(placeholderObjective);
              objectiveMap.set(missingId, created.id);
              this.result.summary.objectivesCreated++;
              this.result.warnings.push(`Created placeholder objective for missing Viva parent ID ${missingId} (${missingParentIds.size} orphaned KPIs)`);
            }
          } catch (error) {
            this.result.warnings.push(`Failed to create placeholder for missing parent ${missingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
      
      // === COMPREHENSIVE DEBUG: Trace ALL KPIs and their parents ===
      console.log(`\n[DEBUG] ========== KPI PARENT ANALYSIS ==========`);
      console.log(`[DEBUG] Total KPIs to process: ${kpis.length}`);
      console.log(`[DEBUG] ObjectiveMap size: ${objectiveMap.size}`);
      
      // Group KPIs by whether their parent is in objectiveMap
      const kpisWithValidParent: string[] = [];
      const kpisWithMissingParent: {title: string, parentId: number, parentTitle: string, parentType: string}[] = [];
      
      for (const kpi of kpis) {
        const parentId = kpi['Parent IDs']?.[0];
        if (parentId && objectiveMap.has(parentId)) {
          kpisWithValidParent.push(kpi.Title);
        } else if (parentId) {
          const parentObj = this.objectives.find(o => o.ID === parentId);
          kpisWithMissingParent.push({
            title: kpi.Title,
            parentId: parentId,
            parentTitle: parentObj?.Title || 'NOT IN EXPORT',
            parentType: parentObj?.Type || 'UNKNOWN',
          });
        } else {
          kpisWithMissingParent.push({
            title: kpi.Title,
            parentId: 0,
            parentTitle: 'NO PARENT ID',
            parentType: 'N/A',
          });
        }
      }
      
      console.log(`[DEBUG] KPIs with valid parent: ${kpisWithValidParent.length}`);
      console.log(`[DEBUG] KPIs with MISSING parent: ${kpisWithMissingParent.length}`);
      
      if (kpisWithMissingParent.length > 0) {
        console.log(`\n[DEBUG] === KPIs WITH MISSING PARENTS ===`);
        for (const kpi of kpisWithMissingParent) {
          console.log(`  - "${kpi.title}" -> Parent ID: ${kpi.parentId}, Title: "${kpi.parentTitle}", Type: ${kpi.parentType}`);
        }
        
        // Check if any missing parents are child objectives that should have been in Phase 2
        const missingParentTypes = new Map<string, number>();
        for (const kpi of kpisWithMissingParent) {
          const type = kpi.parentType;
          missingParentTypes.set(type, (missingParentTypes.get(type) || 0) + 1);
        }
        console.log(`\n[DEBUG] Missing parent types breakdown:`);
        Array.from(missingParentTypes.entries()).forEach(([type, count]) => {
          console.log(`  - ${type}: ${count} KPIs`);
        });
      }
      
      // Debug: Print all objectives in objectiveMap
      console.log(`\n[DEBUG] === ALL OBJECTIVES IN MAP ===`);
      Array.from(objectiveMap.entries()).forEach(([vivaId, vegaId]) => {
        const obj = this.objectives.find(o => o.ID === vivaId);
        console.log(`  - Viva ${vivaId} -> Vega ${vegaId}: "${obj?.Title || 'UNKNOWN'}"`);
      });
      
      for (const viva of kpis) {
        try {
          // Find parent objective
          const parentVivaId = viva['Parent IDs']?.[0];
          const parentVegaId = parentVivaId ? objectiveMap.get(parentVivaId) : null;
          
          // Debug: Trace podcast specifically
          if (viva.Title.toLowerCase().includes('podcast')) {
            console.log(`\n[DEBUG] Processing "Podcast" KPI:`);
            console.log(`  - Parent Viva ID: ${parentVivaId}`);
            console.log(`  - Parent Vega ID from map: ${parentVegaId || 'NOT FOUND'}`);
            const parentObj = this.objectives.find(o => o.ID === parentVivaId);
            console.log(`  - Original parent title: ${parentObj?.Title || 'UNKNOWN'}`);
          }
          
          if (!parentVegaId) {
            const parentVivaIdNum = viva['Parent IDs']?.[0];
            if (!parentVivaIdNum || parentVivaIdNum === 0) {
              this.result.warnings.push(`KPI "${viva.Title}" has no parent objective in Viva Goals export (orphan KPI), skipping`);
            } else {
              this.result.warnings.push(`KPI "${viva.Title}" parent objective (Viva ID: ${parentVivaIdNum}) was not imported, skipping`);
            }
            this.result.skippedItems.push({ type: 'key_result', title: viva.Title, vivaId: viva.ID });
            continue;
          }

          const keyResultData = this.mapKpiToKeyResult(viva, parentVegaId);
          
          // Check for duplicate key results (same title under same objective)
          const existingKRs = await storage.getKeyResultsByObjectiveId(parentVegaId);
          const duplicateKR = existingKRs.find((kr: any) => kr.title === viva.Title);
          
          let created;
          if (duplicateKR) {
            if (this.options.duplicateStrategy === 'skip') {
              this.result.warnings.push(`Skipped duplicate key result: "${viva.Title}"`);
              this.result.entityMap[viva.ID] = {
                type: 'key_result',
                vegaId: duplicateKR.id,
                targetValue: viva.Outcome?.Target ?? 100,
                initialValue: viva.Outcome?.Start ?? 0,
              };
              continue;
            } else if (this.options.duplicateStrategy === 'merge') {
              // Update existing KR
              await storage.updateKeyResult(duplicateKR.id, keyResultData);
              created = duplicateKR;
            } else {
              created = await storage.createKeyResult(keyResultData);
            }
          } else {
            created = await storage.createKeyResult(keyResultData);
          }
          
          // Store target/initial values to calculate check-in progress correctly for absolute values
          this.result.entityMap[viva.ID] = {
            type: 'key_result',
            vegaId: created.id,
            targetValue: viva.Outcome?.Target ?? 100,
            initialValue: viva.Outcome?.Start ?? 0,
          };
          this.result.summary.keyResultsCreated++;
        } catch (error) {
          this.result.warnings.push(`Failed to import key result "${viva.Title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          this.result.skippedItems.push({ type: 'key_result', title: viva.Title, vivaId: viva.ID });
        }
      }

      // Phase 4: Create Big Rocks (Viva "Projects")
      const projects = this.objectives.filter(obj => obj.Type === 'Project');
      
      for (const viva of projects) {
        try {
          const bigRockData = this.mapProjectToBigRock(viva);
          
          // Try to link to parent objective if available
          const parentVivaId = viva['Parent IDs']?.[0];
          const parentVegaId = parentVivaId ? objectiveMap.get(parentVivaId) : null;
          
          if (parentVegaId) {
            bigRockData.objectiveId = parentVegaId;
          } else if (parentVivaId) {
            // Parent was in Viva but not mapped - warn about it
            this.result.warnings.push(`Big Rock "${viva.Title}" parent (Viva ID: ${parentVivaId}) not found in import, creating unlinked`);
          }

          // Check for duplicate big rocks (same title, same quarter/year)
          const existingBigRocks = await storage.getBigRocksByTenantId(this.options.tenantId, bigRockData.quarter, bigRockData.year);
          const duplicateBR = existingBigRocks.find((br: any) => br.title === viva.Title);
          
          let created;
          if (duplicateBR) {
            if (this.options.duplicateStrategy === 'skip') {
              this.result.warnings.push(`Skipped duplicate big rock: "${viva.Title}"`);
              this.result.entityMap[viva.ID] = {
                type: 'big_rock',
                vegaId: duplicateBR.id,
              };
              continue;
            } else if (this.options.duplicateStrategy === 'merge') {
              // Update existing Big Rock - CRITICAL: include objectiveId to preserve linkage
              await storage.updateBigRock(duplicateBR.id, bigRockData);
              created = duplicateBR;
            } else {
              created = await storage.createBigRock(bigRockData);
            }
          } else {
            created = await storage.createBigRock(bigRockData);
          }
          
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

      // Phase 5: Import check-ins (if enabled)
      if (this.options.importCheckIns && this.checkIns.length > 0) {
        for (const vivaCheckIn of this.checkIns) {
          try {
            const entityMapping = this.result.entityMap[vivaCheckIn['OKR ID']];
            
            if (!entityMapping) {
              // Skip check-ins for entities that weren't imported
              continue;
            }

            // Pass entity info for progress calculation (especially for key results with absolute targets)
            const checkInData = this.mapCheckIn(
              vivaCheckIn, 
              entityMapping.type, 
              entityMapping.vegaId,
              entityMapping.type === 'key_result' ? {
                targetValue: entityMapping.targetValue,
                initialValue: entityMapping.initialValue,
              } : undefined
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
