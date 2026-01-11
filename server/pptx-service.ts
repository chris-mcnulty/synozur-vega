import PptxGenJS from 'pptxgenjs';
import { Tenant, ReportInstance, ReviewSnapshot } from '@shared/schema';

export interface SlideOptions {
  executiveScorecard: boolean;
  teamPerformance: boolean;
  objectivesDeepDive: boolean;
  keyResultsTrend: boolean;
  atRiskItems: boolean;
  bigRocksKanban: boolean;
  periodComparison: boolean;
  checkInHighlights: boolean;
}

export const DEFAULT_SLIDE_OPTIONS: SlideOptions = {
  executiveScorecard: true,
  teamPerformance: true,
  objectivesDeepDive: true,
  keyResultsTrend: true,
  atRiskItems: true,
  bigRocksKanban: true,
  periodComparison: false,
  checkInHighlights: true,
};

interface ReportData {
  report: ReportInstance;
  snapshot?: ReviewSnapshot;
  tenant: Tenant;
  slideOptions?: Partial<SlideOptions>;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function getStatusColor(progress: number): string {
  if (progress >= 70) return '22C55E';
  if (progress >= 40) return 'EAB308';
  return 'EF4444';
}

function getStatusLabel(progress: number): string {
  if (progress >= 70) return 'On Track';
  if (progress >= 40) return 'At Risk';
  return 'Behind';
}

function formatProgress(progress: number): string {
  return `${Math.min(100, Math.round(progress))}%`;
}

export async function generateReportPPTX(data: ReportData): Promise<Buffer> {
  const { report, snapshot, tenant } = data;
  const options: SlideOptions = { ...DEFAULT_SLIDE_OPTIONS, ...data.slideOptions };
  const branding = tenant.branding || {};
  const primaryColor = (branding.primaryColor || '#810FFB').replace('#', '');
  const secondaryColor = (branding.secondaryColor || '#64748b').replace('#', '');
  
  const pptx = new PptxGenJS();
  
  pptx.author = tenant.name;
  pptx.title = report.title;
  pptx.subject = `OKR Report - ${report.title}`;
  pptx.company = tenant.name;
  pptx.layout = 'LAYOUT_16x9';
  
  pptx.defineSlideMaster({
    title: 'VEGA_MASTER',
    background: { color: 'FFFFFF' },
    objects: [],
  });
  
  const defaultFont = 'Avenir Next LT Pro';

  const content = report.reportData as any;
  const objectives = content?.objectives || [];
  const keyResults = content?.keyResults || [];
  const bigRocks = content?.bigRocks || [];
  const teams = content?.teams || [];
  const checkIns = content?.checkIns || [];

  await addTitleSlide(pptx, tenant, report, branding, primaryColor, defaultFont);

  if (options.executiveScorecard && content?.summary) {
    addExecutiveScorecardSlide(pptx, content.summary, primaryColor);
  }

  if (options.teamPerformance && objectives.length > 0) {
    addTeamPerformanceSlide(pptx, objectives, teams, primaryColor);
  }

  if (options.objectivesDeepDive && objectives.length > 0) {
    addObjectivesDeepDiveSlides(pptx, objectives, keyResults, primaryColor);
  }

  if (options.keyResultsTrend && keyResults.length > 0) {
    addKeyResultsTrendSlide(pptx, keyResults, checkIns, primaryColor);
  }

  if (options.atRiskItems) {
    const atRiskObjectives = objectives.filter((o: any) => (o.progress || 0) < 40);
    const atRiskKRs = keyResults.filter((kr: any) => (kr.progress || 0) < 40);
    if (atRiskObjectives.length > 0 || atRiskKRs.length > 0) {
      addAtRiskSlide(pptx, atRiskObjectives, atRiskKRs, primaryColor);
    }
  }

  if (options.bigRocksKanban && bigRocks.length > 0) {
    addBigRocksKanbanSlide(pptx, bigRocks, primaryColor);
  }

  if (options.periodComparison && snapshot) {
    addPeriodComparisonSlide(pptx, content.summary, snapshot, primaryColor);
  }

  if (options.checkInHighlights && checkIns.length > 0) {
    addCheckInHighlightsSlide(pptx, checkIns, keyResults, primaryColor);
  }

  addClosingSlide(pptx, tenant, branding, secondaryColor, defaultFont);

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}

async function addTitleSlide(
  pptx: PptxGenJS,
  tenant: Tenant,
  report: ReportInstance,
  branding: any,
  primaryColor: string,
  fontFace: string
) {
  const titleSlide = pptx.addSlide();
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: primaryColor }
  });
  
  let logoData: string | null = null;
  if (tenant.logoUrl) {
    logoData = await fetchImageAsBase64(tenant.logoUrl);
  }
  
  if (logoData) {
    titleSlide.addImage({
      data: logoData,
      x: 4.5, y: 0.5, w: 1.5, h: 0.6,
      sizing: { type: 'contain', w: 1.5, h: 0.6 }
    });
  }
  
  titleSlide.addText(tenant.name, {
    x: 0.5, y: 1.8, w: 9.5, h: 0.8,
    fontSize: 36, color: 'FFFFFF', bold: true,
    align: 'center', fontFace
  });
  
  if (branding.tagline) {
    titleSlide.addText(branding.tagline, {
      x: 0.5, y: 2.5, w: 9.5, h: 0.4,
      fontSize: 16, color: 'FFFFFF', italic: true,
      align: 'center', fontFace
    });
  }
  
  titleSlide.addText(report.title, {
    x: 0.5, y: 3.3, w: 9.5, h: 0.6,
    fontSize: 28, color: 'FFFFFF',
    align: 'center', fontFace
  });
  
  const periodStart = new Date(report.periodStart).toLocaleDateString();
  const periodEnd = new Date(report.periodEnd).toLocaleDateString();
  titleSlide.addText(`${periodStart} - ${periodEnd}`, {
    x: 0.5, y: 4.1, w: 9.5, h: 0.4,
    fontSize: 14, color: 'FFFFFF',
    align: 'center', fontFace
  });
  
  titleSlide.addText(`Generated: ${new Date(report.generatedAt || new Date()).toLocaleDateString()}`, {
    x: 0.5, y: 4.5, w: 9.5, h: 0.3,
    fontSize: 11, color: 'FFFFFF',
    align: 'center', fontFace
  });
  
  titleSlide.addShape(pptx.ShapeType.line, {
    x: 2, y: 4.95, w: 6.5, h: 0,
    line: { color: 'FFFFFF', width: 0.5, transparency: 50 }
  });
  
  titleSlide.addText('Powered by Vega  |  vega.synozur.com  |  synozur.com', {
    x: 0.5, y: 5.05, w: 9.5, h: 0.25,
    fontSize: 9, color: 'FFFFFF',
    align: 'center', fontFace, italic: true
  });
}

function addExecutiveScorecardSlide(pptx: PptxGenJS, summary: any, primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Executive Scorecard', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const metrics = [
    { label: 'Objectives', value: summary.totalObjectives || 0, completed: summary.completedObjectives || 0 },
    { label: 'Key Results', value: summary.totalKeyResults || 0, completed: summary.completedKeyResults || 0 },
    { label: 'Initiatives', value: summary.totalBigRocks || 0, completed: summary.completedBigRocks || 0 },
    { label: 'Avg Progress', value: `${summary.averageProgress || 0}%`, isProgress: true, progress: summary.averageProgress || 0 },
  ];
  
  metrics.forEach((metric, index) => {
    const xPos = 0.4 + (index * 2.4);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 0.9, w: 2.2, h: 1.4,
      fill: { color: 'F8FAFC' },
      line: { color: 'E2E8F0', width: 1 }
    });
    
    slide.addText(metric.label, {
      x: xPos, y: 1.0, w: 2.2, h: 0.35,
      fontSize: 11, color: '64748B',
      align: 'center'
    });
    
    if (metric.isProgress) {
      slide.addText(String(metric.value), {
        x: xPos, y: 1.4, w: 2.2, h: 0.5,
        fontSize: 28, color: getStatusColor(metric.progress!), bold: true,
        align: 'center'
      });
      slide.addText(getStatusLabel(metric.progress!), {
        x: xPos, y: 1.95, w: 2.2, h: 0.25,
        fontSize: 10, color: getStatusColor(metric.progress!),
        align: 'center'
      });
    } else {
      slide.addText(`${metric.completed}/${metric.value}`, {
        x: xPos, y: 1.4, w: 2.2, h: 0.5,
        fontSize: 28, color: '1E293B', bold: true,
        align: 'center'
      });
      const pct = metric.value > 0 ? Math.round((metric.completed / metric.value) * 100) : 0;
      slide.addText(`${pct}% complete`, {
        x: xPos, y: 1.95, w: 2.2, h: 0.25,
        fontSize: 10, color: getStatusColor(pct),
        align: 'center'
      });
    }
  });

  let onTrack = summary.onTrackCount || 0;
  let atRisk = summary.atRiskCount || 0;
  let behind = summary.behindCount || 0;
  
  if (onTrack === 0 && atRisk === 0 && behind === 0 && summary.totalObjectives > 0) {
    const avgProg = summary.averageProgress || 0;
    if (avgProg >= 70) onTrack = summary.totalObjectives;
    else if (avgProg >= 40) atRisk = summary.totalObjectives;
    else behind = summary.totalObjectives;
  }
  
  const total = onTrack + atRisk + behind;
  
  if (total > 0) {
    slide.addText('Status Distribution', {
      x: 0.4, y: 2.5, w: 4, h: 0.35,
      fontSize: 14, color: '374151', bold: true
    });
    
    slide.addChart(pptx.ChartType.doughnut, [
      {
        name: 'Status',
        labels: ['On Track', 'At Risk', 'Behind'],
        values: [onTrack, atRisk, behind],
      }
    ], {
      x: 0.4, y: 2.9, w: 3.5, h: 2.2,
      chartColors: ['22C55E', 'EAB308', 'EF4444'],
      showLegend: true,
      legendPos: 'r',
      showValue: true,
      showPercent: true,
      holeSize: 50,
    });
    
    const levelData = summary.progressByLevel || [];
    if (levelData.length > 0) {
      slide.addText('Progress by Level', {
        x: 5, y: 2.5, w: 4.5, h: 0.35,
        fontSize: 14, color: '374151', bold: true
      });
      
      slide.addChart(pptx.ChartType.bar, [
        {
          name: 'Progress',
          labels: levelData.map((l: any) => l.level || 'Unknown'),
          values: levelData.map((l: any) => l.avgProgress || 0),
        }
      ], {
        x: 5, y: 2.9, w: 4.5, h: 2.2,
        chartColors: [primaryColor],
        showValue: true,
        barDir: 'bar',
        valAxisMaxVal: 100,
        dataLabelPosition: 'outEnd',
        dataLabelFontSize: 9,
        catAxisTitle: '',
        valAxisTitle: 'Progress %',
      });
    }
  }
}

function addTeamPerformanceSlide(pptx: PptxGenJS, objectives: any[], teams: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Team Performance Comparison', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const teamMap = new Map<string, { name: string; objectives: number; totalProgress: number }>();
  
  teams.forEach((team: any) => {
    teamMap.set(team.id, { name: team.name, objectives: 0, totalProgress: 0 });
  });
  
  teamMap.set('org', { name: 'Organization', objectives: 0, totalProgress: 0 });
  
  objectives.forEach((obj: any) => {
    const teamId = obj.teamId || 'org';
    const team = teamMap.get(teamId) || teamMap.get('org')!;
    team.objectives++;
    team.totalProgress += (obj.progress || 0);
  });
  
  const teamData = Array.from(teamMap.entries())
    .filter(([_, data]) => data.objectives > 0)
    .map(([id, data]) => ({
      id,
      name: data.name,
      objectives: data.objectives,
      avgProgress: Math.round(data.totalProgress / data.objectives),
    }))
    .sort((a, b) => b.avgProgress - a.avgProgress);
  
  if (teamData.length > 0) {
    slide.addChart(pptx.ChartType.bar, [
      {
        name: 'Avg Progress',
        labels: teamData.slice(0, 8).map(t => t.name),
        values: teamData.slice(0, 8).map(t => t.avgProgress),
      }
    ], {
      x: 0.4, y: 0.85, w: 5.5, h: 3.5,
      chartColors: [primaryColor],
      showValue: true,
      barDir: 'bar',
      valAxisMaxVal: 100,
      dataLabelPosition: 'outEnd',
      dataLabelFontSize: 10,
    });
    
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Team', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
        { text: 'Objectives', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Progress', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Status', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    teamData.slice(0, 8).forEach((team) => {
      tableData.push([
        { text: team.name, options: { align: 'left' } },
        { text: String(team.objectives), options: { align: 'center' } },
        { text: `${team.avgProgress}%`, options: { align: 'center', color: getStatusColor(team.avgProgress), bold: true } },
        { text: getStatusLabel(team.avgProgress), options: { align: 'center', color: getStatusColor(team.avgProgress) } },
      ]);
    });
    
    slide.addTable(tableData, {
      x: 6.1, y: 0.85, w: 3.7, h: 0.35,
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      colW: [1.5, 0.7, 0.7, 0.8],
    });
    
    if (teamData.length > 0) {
      const topTeam = teamData[0];
      const bottomTeam = teamData[teamData.length - 1];
      
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.4, y: 4.5, w: 4.5, h: 0.7,
        fill: { color: 'DCFCE7' },
        line: { color: '22C55E', width: 1 }
      });
      slide.addText(`Top Performer: ${topTeam.name} (${topTeam.avgProgress}%)`, {
        x: 0.5, y: 4.6, w: 4.3, h: 0.5,
        fontSize: 12, color: '166534'
      });
      
      if (bottomTeam.avgProgress < 70 && bottomTeam.id !== topTeam.id) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 5.2, y: 4.5, w: 4.5, h: 0.7,
          fill: { color: 'FEF2F2' },
          line: { color: 'EF4444', width: 1 }
        });
        slide.addText(`Needs Attention: ${bottomTeam.name} (${bottomTeam.avgProgress}%)`, {
          x: 5.3, y: 4.6, w: 4.3, h: 0.5,
          fontSize: 12, color: '991B1B'
        });
      }
    }
  }
}

function addObjectivesDeepDiveSlides(pptx: PptxGenJS, objectives: any[], keyResults: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Objectives Overview', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const sortedObjectives = [...objectives].sort((a, b) => (b.progress || 0) - (a.progress || 0));
  
  const tableData: PptxGenJS.TableRow[] = [
    [
      { text: 'Objective', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
      { text: 'Owner', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
      { text: 'Progress', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      { text: 'Status', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
    ]
  ];
  
  sortedObjectives.slice(0, 12).forEach((obj: any) => {
    const progress = obj.progress || 0;
    const krCount = keyResults.filter((kr: any) => kr.objectiveId === obj.id).length;
    tableData.push([
      { text: obj.title?.substring(0, 45) + (obj.title?.length > 45 ? '...' : '') || 'Untitled', options: { align: 'left' } },
      { text: obj.ownerEmail?.split('@')[0] || '-', options: { align: 'left', fontSize: 9 } },
      { text: formatProgress(progress), options: { align: 'center', color: getStatusColor(progress), bold: true } },
      { text: getStatusLabel(progress), options: { align: 'center', color: getStatusColor(progress), fontSize: 9 } },
    ]);
  });
  
  slide.addTable(tableData, {
    x: 0.4, y: 0.8, w: 9.5, h: 0.35,
    fontSize: 10,
    border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
    colW: [5.5, 1.8, 1.1, 1.1],
  });
  
  if (sortedObjectives.length > 12) {
    slide.addText(`+ ${sortedObjectives.length - 12} more objectives`, {
      x: 0.4, y: 4.9, w: 9.5, h: 0.25,
      fontSize: 10, color: '6B7280', italic: true,
      align: 'center'
    });
  }
}

function addKeyResultsTrendSlide(pptx: PptxGenJS, keyResults: any[], checkIns: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Key Results Progress', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const sortedKRs = [...keyResults].sort((a, b) => (b.progress || 0) - (a.progress || 0));
  const topKRs = sortedKRs.slice(0, 10);
  
  if (topKRs.length > 0) {
    slide.addChart(pptx.ChartType.bar, [
      {
        name: 'Progress',
        labels: topKRs.map((kr: any) => (kr.title?.substring(0, 25) + (kr.title?.length > 25 ? '...' : '')) || 'Untitled'),
        values: topKRs.map((kr: any) => kr.progress || 0),
      }
    ], {
      x: 0.4, y: 0.8, w: 5.5, h: 3.8,
      chartColors: topKRs.map((kr: any) => getStatusColor(kr.progress || 0)),
      showValue: true,
      barDir: 'bar',
      valAxisMaxVal: 100,
      dataLabelPosition: 'outEnd',
      dataLabelFontSize: 9,
    });
    
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Key Result', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
        { text: 'Current', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Target', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: '%', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    topKRs.forEach((kr: any) => {
      const progress = kr.progress || 0;
      tableData.push([
        { text: kr.title?.substring(0, 20) + (kr.title?.length > 20 ? '...' : '') || 'Untitled', options: { align: 'left', fontSize: 8 } },
        { text: String(kr.currentValue ?? 0), options: { align: 'center' } },
        { text: String(kr.targetValue ?? 100), options: { align: 'center' } },
        { text: `${progress}%`, options: { align: 'center', color: getStatusColor(progress), bold: true } },
      ]);
    });
    
    slide.addTable(tableData, {
      x: 6.1, y: 0.8, w: 3.7, h: 0.3,
      fontSize: 9,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      colW: [1.7, 0.6, 0.6, 0.8],
    });
  }
  
  if (keyResults.length > 10) {
    slide.addText(`Showing top 10 of ${keyResults.length} key results`, {
      x: 0.4, y: 4.85, w: 9.5, h: 0.25,
      fontSize: 10, color: '6B7280', italic: true,
      align: 'center'
    });
  }
}

function addAtRiskSlide(pptx: PptxGenJS, atRiskObjectives: any[], atRiskKRs: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Items Requiring Attention', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: 'EF4444', bold: true
  });
  
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.4, y: 0.75, w: 9.5, h: 0.5,
    fill: { color: 'FEF2F2' },
    line: { color: 'FECACA', width: 1 }
  });
  slide.addText(`${atRiskObjectives.length} Objectives and ${atRiskKRs.length} Key Results below 40% progress`, {
    x: 0.5, y: 0.85, w: 9.3, h: 0.3,
    fontSize: 12, color: '991B1B'
  });
  
  if (atRiskObjectives.length > 0) {
    slide.addText('At-Risk Objectives', {
      x: 0.4, y: 1.4, w: 4.5, h: 0.35,
      fontSize: 14, color: '374151', bold: true
    });
    
    const objTableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Objective', options: { bold: true, fill: { color: 'EF4444' }, color: 'FFFFFF', align: 'left' } },
        { text: '%', options: { bold: true, fill: { color: 'EF4444' }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    atRiskObjectives.slice(0, 6).forEach((obj: any) => {
      objTableData.push([
        { text: obj.title?.substring(0, 35) + (obj.title?.length > 35 ? '...' : '') || 'Untitled', options: { align: 'left' } },
        { text: `${obj.progress || 0}%`, options: { align: 'center', color: 'EF4444', bold: true } },
      ]);
    });
    
    slide.addTable(objTableData, {
      x: 0.4, y: 1.8, w: 4.5, h: 0.3,
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'FECACA' },
      colW: [3.8, 0.7],
    });
  }
  
  if (atRiskKRs.length > 0) {
    slide.addText('At-Risk Key Results', {
      x: 5.2, y: 1.4, w: 4.5, h: 0.35,
      fontSize: 14, color: '374151', bold: true
    });
    
    const krTableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Key Result', options: { bold: true, fill: { color: 'EF4444' }, color: 'FFFFFF', align: 'left' } },
        { text: '%', options: { bold: true, fill: { color: 'EF4444' }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    atRiskKRs.slice(0, 6).forEach((kr: any) => {
      krTableData.push([
        { text: kr.title?.substring(0, 35) + (kr.title?.length > 35 ? '...' : '') || 'Untitled', options: { align: 'left' } },
        { text: `${kr.progress || 0}%`, options: { align: 'center', color: 'EF4444', bold: true } },
      ]);
    });
    
    slide.addTable(krTableData, {
      x: 5.2, y: 1.8, w: 4.5, h: 0.3,
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'FECACA' },
      colW: [3.8, 0.7],
    });
  }
}

function addBigRocksKanbanSlide(pptx: PptxGenJS, bigRocks: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Initiatives (Big Rocks)', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const statusGroups = {
    'not_started': { label: 'Not Started', color: '94A3B8', items: [] as any[] },
    'in_progress': { label: 'In Progress', color: '3B82F6', items: [] as any[] },
    'completed': { label: 'Completed', color: '22C55E', items: [] as any[] },
    'blocked': { label: 'Blocked', color: 'EF4444', items: [] as any[] },
  };
  
  bigRocks.forEach((rock: any) => {
    const status = rock.status || 'not_started';
    if (statusGroups[status as keyof typeof statusGroups]) {
      statusGroups[status as keyof typeof statusGroups].items.push(rock);
    } else {
      statusGroups.not_started.items.push(rock);
    }
  });
  
  const columns = Object.values(statusGroups);
  const columnWidth = 2.35;
  
  columns.forEach((column, index) => {
    const xPos = 0.4 + (index * 2.45);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos, y: 0.8, w: columnWidth, h: 0.4,
      fill: { color: column.color },
    });
    slide.addText(`${column.label} (${column.items.length})`, {
      x: xPos, y: 0.85, w: columnWidth, h: 0.3,
      fontSize: 11, color: 'FFFFFF', bold: true,
      align: 'center'
    });
    
    column.items.slice(0, 5).forEach((rock, rockIndex) => {
      const yPos = 1.35 + (rockIndex * 0.65);
      
      slide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: yPos, w: columnWidth, h: 0.55,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 1 }
      });
      
      slide.addText(rock.title?.substring(0, 25) + (rock.title?.length > 25 ? '...' : '') || 'Untitled', {
        x: xPos + 0.1, y: yPos + 0.1, w: columnWidth - 0.2, h: 0.35,
        fontSize: 9, color: '374151'
      });
    });
    
    if (column.items.length > 5) {
      slide.addText(`+${column.items.length - 5} more`, {
        x: xPos, y: 4.65, w: columnWidth, h: 0.25,
        fontSize: 9, color: '6B7280', italic: true,
        align: 'center'
      });
    }
  });
  
  slide.addChart(pptx.ChartType.doughnut, [
    {
      name: 'Status',
      labels: columns.map(c => c.label),
      values: columns.map(c => c.items.length),
    }
  ], {
    x: 7.5, y: 3.7, w: 2, h: 1.5,
    chartColors: columns.map(c => c.color),
    showLegend: false,
    holeSize: 50,
  });
}

function addPeriodComparisonSlide(pptx: PptxGenJS, currentSummary: any, snapshot: ReviewSnapshot, primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Period Comparison', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const snapshotDate = new Date(snapshot.snapshotDate).toLocaleDateString();
  slide.addText(`Comparing current state vs. snapshot from ${snapshotDate}`, {
    x: 0.4, y: 0.7, w: 9.5, h: 0.3,
    fontSize: 12, color: '6B7280'
  });
  
  const comparisons = [
    {
      label: 'Overall Progress',
      before: snapshot.overallProgress || 0,
      after: currentSummary?.averageProgress || 0,
    },
    {
      label: 'Objectives Completed',
      before: snapshot.objectivesCompleted || 0,
      after: currentSummary?.completedObjectives || 0,
    },
    {
      label: 'Key Results Completed',
      before: snapshot.keyResultsCompleted || 0,
      after: currentSummary?.completedKeyResults || 0,
    },
  ];
  
  slide.addChart(pptx.ChartType.bar, [
    {
      name: 'Snapshot',
      labels: comparisons.map(c => c.label),
      values: comparisons.map(c => c.before),
    },
    {
      name: 'Current',
      labels: comparisons.map(c => c.label),
      values: comparisons.map(c => c.after),
    }
  ], {
    x: 0.4, y: 1.2, w: 6, h: 3,
    chartColors: ['94A3B8', primaryColor],
    showLegend: true,
    legendPos: 't',
    barDir: 'bar',
    barGrouping: 'clustered',
    dataLabelPosition: 'outEnd',
  });
  
  comparisons.forEach((comp, index) => {
    const delta = comp.after - comp.before;
    const deltaColor = delta >= 0 ? '22C55E' : 'EF4444';
    const deltaSign = delta >= 0 ? '+' : '';
    
    const yPos = 1.4 + (index * 0.8);
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 6.8, y: yPos, w: 2.8, h: 0.7,
      fill: { color: delta >= 0 ? 'DCFCE7' : 'FEF2F2' },
      line: { color: deltaColor, width: 1 }
    });
    slide.addText(`${comp.label}`, {
      x: 6.9, y: yPos + 0.1, w: 2.6, h: 0.25,
      fontSize: 10, color: '374151'
    });
    slide.addText(`${deltaSign}${delta}${comp.label.includes('Progress') ? '%' : ''}`, {
      x: 6.9, y: yPos + 0.35, w: 2.6, h: 0.3,
      fontSize: 16, color: deltaColor, bold: true
    });
  });
}

function addCheckInHighlightsSlide(pptx: PptxGenJS, checkIns: any[], keyResults: any[], primaryColor: string) {
  const slide = pptx.addSlide();
  
  slide.addText('Recent Check-in Highlights', {
    x: 0.4, y: 0.2, w: 9.5, h: 0.5,
    fontSize: 24, color: primaryColor, bold: true
  });
  
  const recentCheckIns = [...checkIns]
    .filter((ci: any) => ci.notes && ci.notes.trim().length > 10)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  
  if (recentCheckIns.length === 0) {
    slide.addText('No check-in notes available for this period.', {
      x: 0.4, y: 2, w: 9.5, h: 0.5,
      fontSize: 14, color: '6B7280', italic: true,
      align: 'center'
    });
    return;
  }
  
  recentCheckIns.forEach((checkIn: any, index) => {
    const yPos = 0.85 + (index * 0.85);
    const kr = keyResults.find((k: any) => k.id === checkIn.keyResultId);
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.4, y: yPos, w: 9.5, h: 0.75,
      fill: { color: 'F8FAFC' },
      line: { color: 'E2E8F0', width: 1 }
    });
    
    const dateStr = new Date(checkIn.createdAt).toLocaleDateString();
    slide.addText(`${kr?.title?.substring(0, 40) || 'Key Result'} • ${dateStr}`, {
      x: 0.5, y: yPos + 0.08, w: 9.3, h: 0.25,
      fontSize: 10, color: primaryColor, bold: true
    });
    
    slide.addText(checkIn.notes?.substring(0, 150) + (checkIn.notes?.length > 150 ? '...' : '') || '', {
      x: 0.5, y: yPos + 0.38, w: 9.3, h: 0.32,
      fontSize: 10, color: '374151'
    });
  });
}

function addClosingSlide(pptx: PptxGenJS, tenant: Tenant, branding: any, secondaryColor: string, fontFace: string) {
  const closingSlide = pptx.addSlide();
  closingSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: secondaryColor }
  });
  
  closingSlide.addText('Thank You', {
    x: 0.5, y: 1.8, w: 9.5, h: 0.8,
    fontSize: 36, color: 'FFFFFF', bold: true,
    align: 'center', fontFace
  });
  
  closingSlide.addText(branding.reportFooterText || `${tenant.name} - Confidential`, {
    x: 0.5, y: 2.7, w: 9.5, h: 0.4,
    fontSize: 14, color: 'FFFFFF',
    align: 'center', fontFace
  });
  
  closingSlide.addShape(pptx.ShapeType.line, {
    x: 2.5, y: 4.3, w: 5.5, h: 0,
    line: { color: 'FFFFFF', width: 0.5, transparency: 50 }
  });
  
  closingSlide.addText('Generated with Vega', {
    x: 0.5, y: 4.45, w: 9.5, h: 0.3,
    fontSize: 11, color: 'FFFFFF', bold: true,
    align: 'center', fontFace
  });
  
  closingSlide.addText('vega.synozur.com', {
    x: 0.5, y: 4.75, w: 9.5, h: 0.25,
    fontSize: 10, color: 'FFFFFF',
    align: 'center', fontFace
  });
  
  closingSlide.addText('synozur.com', {
    x: 0.5, y: 5.0, w: 9.5, h: 0.25,
    fontSize: 10, color: 'FFFFFF',
    align: 'center', fontFace
  });
}
