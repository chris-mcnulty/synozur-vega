/**
 * Response formatting utilities for M365 Copilot Agent integration.
 * These helpers transform API responses into more conversational, Copilot-friendly formats.
 */

interface ObjectiveSummary {
  id: string;
  title: string;
  level: string;
  progress: number;
  status: string;
  ownerName?: string;
  teamName?: string;
  keyResultCount?: number;
}

interface KeyResultSummary {
  id: string;
  title: string;
  progress: number;
  currentValue?: number;
  targetValue?: number;
  metricType?: string;
  ownerName?: string;
}

interface BigRockSummary {
  id: string;
  title: string;
  status: string;
  progress: number;
  ownerName?: string;
  teamName?: string;
}

interface MeetingSummary {
  id: string;
  title: string;
  cadence: string;
  scheduledDate: string;
  status: string;
  attendeeCount?: number;
}

/**
 * Format objectives list for Copilot consumption
 */
export function formatObjectivesForCopilot(objectives: any[]): {
  summary: string;
  objectives: ObjectiveSummary[];
  metrics: {
    total: number;
    onTrack: number;
    atRisk: number;
    completed: number;
    averageProgress: number;
  };
} {
  const metrics = {
    total: objectives.length,
    onTrack: objectives.filter(o => o.status === 'on_track' || (o.progress >= 70)).length,
    atRisk: objectives.filter(o => o.status === 'at_risk' || (o.progress < 40 && o.progress > 0)).length,
    completed: objectives.filter(o => o.status === 'completed' || o.progress >= 100).length,
    averageProgress: objectives.length > 0 
      ? Math.round(objectives.reduce((sum, o) => sum + Math.min(o.progress || 0, 100), 0) / objectives.length)
      : 0
  };

  const formattedObjectives: ObjectiveSummary[] = objectives.map(o => ({
    id: o.id,
    title: o.title,
    level: o.level,
    progress: Math.round(o.progress || 0),
    status: o.status || 'not_started',
    ownerName: o.ownerName,
    teamName: o.teamName,
    keyResultCount: o.keyResults?.length
  }));

  const summary = `Found ${metrics.total} objectives with an average progress of ${metrics.averageProgress}%. ` +
    `${metrics.onTrack} are on track, ${metrics.atRisk} are at risk, and ${metrics.completed} are completed.`;

  return {
    summary,
    objectives: formattedObjectives,
    metrics
  };
}

/**
 * Format key results list for Copilot consumption
 */
export function formatKeyResultsForCopilot(keyResults: any[]): {
  summary: string;
  keyResults: KeyResultSummary[];
  metrics: {
    total: number;
    averageProgress: number;
    completed: number;
  };
} {
  const metrics = {
    total: keyResults.length,
    averageProgress: keyResults.length > 0
      ? Math.round(keyResults.reduce((sum, kr) => sum + Math.min(kr.progress || 0, 100), 0) / keyResults.length)
      : 0,
    completed: keyResults.filter(kr => kr.progress >= 100).length
  };

  const formattedKeyResults: KeyResultSummary[] = keyResults.map(kr => ({
    id: kr.id,
    title: kr.title,
    progress: Math.round(kr.progress || 0),
    currentValue: kr.currentValue,
    targetValue: kr.targetValue,
    metricType: kr.metricType,
    ownerName: kr.ownerName
  }));

  const summary = `Found ${metrics.total} key results with an average progress of ${metrics.averageProgress}%. ` +
    `${metrics.completed} have been completed.`;

  return {
    summary,
    keyResults: formattedKeyResults,
    metrics
  };
}

/**
 * Format big rocks list for Copilot consumption
 */
export function formatBigRocksForCopilot(bigRocks: any[]): {
  summary: string;
  bigRocks: BigRockSummary[];
  metrics: {
    total: number;
    inProgress: number;
    completed: number;
    blocked: number;
  };
} {
  const metrics = {
    total: bigRocks.length,
    inProgress: bigRocks.filter(br => br.status === 'in_progress').length,
    completed: bigRocks.filter(br => br.status === 'completed').length,
    blocked: bigRocks.filter(br => br.status === 'blocked').length
  };

  const formattedBigRocks: BigRockSummary[] = bigRocks.map(br => ({
    id: br.id,
    title: br.title,
    status: br.status || 'not_started',
    progress: Math.round(br.progress || 0),
    ownerName: br.ownerName,
    teamName: br.teamName
  }));

  const summary = `Found ${metrics.total} big rocks (quarterly priorities). ` +
    `${metrics.inProgress} are in progress, ${metrics.completed} are completed, and ${metrics.blocked} are blocked.`;

  return {
    summary,
    bigRocks: formattedBigRocks,
    metrics
  };
}

/**
 * Format meetings list for Copilot consumption
 */
export function formatMeetingsForCopilot(meetings: any[]): {
  summary: string;
  meetings: MeetingSummary[];
  metrics: {
    total: number;
    scheduled: number;
    completed: number;
    upcoming: number;
  };
} {
  const now = new Date();
  const metrics = {
    total: meetings.length,
    scheduled: meetings.filter(m => m.status === 'scheduled').length,
    completed: meetings.filter(m => m.status === 'completed').length,
    upcoming: meetings.filter(m => new Date(m.scheduledDate) > now).length
  };

  const formattedMeetings: MeetingSummary[] = meetings.map(m => ({
    id: m.id,
    title: m.title,
    cadence: m.cadence,
    scheduledDate: m.scheduledDate,
    status: m.status || 'scheduled',
    attendeeCount: m.attendeeIds?.length
  }));

  const summary = `Found ${metrics.total} Focus Rhythm meetings. ` +
    `${metrics.upcoming} are upcoming, ${metrics.scheduled} are scheduled, and ${metrics.completed} have been completed.`;

  return {
    summary,
    meetings: formattedMeetings,
    metrics
  };
}

/**
 * Format foundations for Copilot consumption
 */
export function formatFoundationsForCopilot(foundation: any): {
  summary: string;
  mission: string;
  vision: string;
  values: { title: string; description: string }[];
  annualGoals: string[];
} {
  const values = (foundation.values || []).map((v: any) => ({
    title: v.title || v,
    description: v.description || ''
  }));

  const annualGoals = foundation.annualGoals || [];

  const summary = `Company foundations include a mission statement, vision, ${values.length} core values, and ${annualGoals.length} annual goals.`;

  return {
    summary,
    mission: foundation.mission || 'Not set',
    vision: foundation.vision || 'Not set',
    values,
    annualGoals
  };
}

/**
 * Format strategies for Copilot consumption
 */
export function formatStrategiesForCopilot(strategies: any[]): {
  summary: string;
  strategies: {
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    ownerName?: string;
  }[];
  metrics: {
    total: number;
    highPriority: number;
    active: number;
  };
} {
  const metrics = {
    total: strategies.length,
    highPriority: strategies.filter(s => s.priority === 'high').length,
    active: strategies.filter(s => s.status === 'active' || !s.status).length
  };

  const formattedStrategies = strategies.map(s => ({
    id: s.id,
    title: s.title,
    description: s.description || '',
    priority: s.priority || 'medium',
    status: s.status || 'active',
    ownerName: s.ownerName
  }));

  const summary = `Found ${metrics.total} strategic initiatives. ` +
    `${metrics.highPriority} are high priority and ${metrics.active} are currently active.`;

  return {
    summary,
    strategies: formattedStrategies,
    metrics
  };
}

/**
 * Format teams for Copilot consumption
 */
export function formatTeamsForCopilot(teams: any[]): {
  summary: string;
  teams: {
    id: string;
    name: string;
    description: string;
    leaderName?: string;
    memberCount?: number;
  }[];
} {
  const formattedTeams = teams.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description || '',
    leaderName: t.leaderName,
    memberCount: t.memberIds?.length
  }));

  const totalMembers = teams.reduce((sum, t) => sum + (t.memberIds?.length || 0), 0);
  const summary = `Found ${teams.length} teams with a total of ${totalMembers} members.`;

  return {
    summary,
    teams: formattedTeams
  };
}

/**
 * Generate a natural language progress report
 */
export function generateProgressReport(data: {
  objectives?: any[];
  keyResults?: any[];
  bigRocks?: any[];
  quarter?: number;
  year?: number;
}): string {
  const lines: string[] = [];
  
  if (data.quarter && data.year) {
    lines.push(`## Q${data.quarter} ${data.year} Progress Report\n`);
  }

  if (data.objectives && data.objectives.length > 0) {
    const objMetrics = formatObjectivesForCopilot(data.objectives).metrics;
    lines.push(`### Objectives`);
    lines.push(`- **Total:** ${objMetrics.total}`);
    lines.push(`- **Average Progress:** ${objMetrics.averageProgress}%`);
    lines.push(`- **On Track:** ${objMetrics.onTrack}`);
    lines.push(`- **At Risk:** ${objMetrics.atRisk}`);
    lines.push(`- **Completed:** ${objMetrics.completed}\n`);
  }

  if (data.keyResults && data.keyResults.length > 0) {
    const krMetrics = formatKeyResultsForCopilot(data.keyResults).metrics;
    lines.push(`### Key Results`);
    lines.push(`- **Total:** ${krMetrics.total}`);
    lines.push(`- **Average Progress:** ${krMetrics.averageProgress}%`);
    lines.push(`- **Completed:** ${krMetrics.completed}\n`);
  }

  if (data.bigRocks && data.bigRocks.length > 0) {
    const brMetrics = formatBigRocksForCopilot(data.bigRocks).metrics;
    lines.push(`### Big Rocks (Quarterly Priorities)`);
    lines.push(`- **Total:** ${brMetrics.total}`);
    lines.push(`- **In Progress:** ${brMetrics.inProgress}`);
    lines.push(`- **Completed:** ${brMetrics.completed}`);
    lines.push(`- **Blocked:** ${brMetrics.blocked}\n`);
  }

  return lines.join('\n');
}
