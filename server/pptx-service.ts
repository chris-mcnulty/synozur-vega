import PptxGenJS from 'pptxgenjs';
import { Tenant, ReportInstance, ReviewSnapshot } from '@shared/schema';

interface ReportData {
  report: ReportInstance;
  snapshot?: ReviewSnapshot;
  tenant: Tenant;
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

function formatProgress(progress: number): string {
  return `${Math.min(100, Math.round(progress))}%`;
}

export async function generateReportPPTX(data: ReportData): Promise<Buffer> {
  const { report, tenant } = data;
  const branding = tenant.branding || {};
  const primaryColor = (branding.primaryColor || '#3b82f6').replace('#', '');
  const secondaryColor = (branding.secondaryColor || '#64748b').replace('#', '');
  
  const pptx = new PptxGenJS();
  
  pptx.author = tenant.name;
  pptx.title = report.title;
  pptx.subject = `OKR Report - ${report.title}`;
  pptx.company = tenant.name;

  const content = report.reportData as any;

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
      x: 4, y: 0.5, w: 2, h: 0.8,
      sizing: { type: 'contain', w: 2, h: 0.8 }
    });
  }
  
  titleSlide.addText(tenant.name, {
    x: 0.5, y: 1.5, w: 9, h: 1,
    fontSize: 36, color: 'FFFFFF', bold: true,
    align: 'center'
  });
  
  if (branding.tagline) {
    titleSlide.addText(branding.tagline, {
      x: 0.5, y: 2.3, w: 9, h: 0.5,
      fontSize: 16, color: 'FFFFFF', italic: true,
      align: 'center'
    });
  }
  
  titleSlide.addText(report.title, {
    x: 0.5, y: 3.2, w: 9, h: 0.8,
    fontSize: 28, color: 'FFFFFF',
    align: 'center'
  });
  
  const periodStart = new Date(report.periodStart).toLocaleDateString();
  const periodEnd = new Date(report.periodEnd).toLocaleDateString();
  titleSlide.addText(`${periodStart} - ${periodEnd}`, {
    x: 0.5, y: 4.2, w: 9, h: 0.5,
    fontSize: 14, color: 'FFFFFF',
    align: 'center'
  });
  
  titleSlide.addText(`Generated: ${new Date(report.generatedAt || new Date()).toLocaleDateString()}`, {
    x: 0.5, y: 4.8, w: 9, h: 0.4,
    fontSize: 12, color: 'FFFFFF',
    align: 'center'
  });

  if (content?.summary) {
    const summarySlide = pptx.addSlide();
    
    summarySlide.addText('Executive Summary', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 28, color: primaryColor, bold: true
    });
    
    const summary = content.summary;
    const metrics = [
      { label: 'Total Objectives', value: summary.totalObjectives || 0, completed: summary.completedObjectives || 0 },
      { label: 'Key Results', value: summary.totalKeyResults || 0, completed: summary.completedKeyResults || 0 },
      { label: 'Initiatives', value: summary.totalBigRocks || 0, completed: summary.completedBigRocks || 0 },
      { label: 'Avg. Progress', value: `${summary.averageProgress || 0}%`, isProgress: true, progress: summary.averageProgress || 0 },
    ];
    
    metrics.forEach((metric, index) => {
      const xPos = 0.5 + (index * 2.3);
      
      summarySlide.addShape(pptx.ShapeType.roundRect, {
        x: xPos, y: 1.2, w: 2.1, h: 1.8,
        fill: { color: 'F3F4F6' },
        line: { color: 'E5E7EB', width: 1 }
      });
      
      summarySlide.addText(metric.label, {
        x: xPos, y: 1.35, w: 2.1, h: 0.4,
        fontSize: 11, color: '6B7280',
        align: 'center'
      });
      
      if (metric.isProgress) {
        summarySlide.addText(String(metric.value), {
          x: xPos, y: 1.85, w: 2.1, h: 0.6,
          fontSize: 28, color: getStatusColor(metric.progress!), bold: true,
          align: 'center'
        });
      } else {
        summarySlide.addText(`${metric.completed}/${metric.value}`, {
          x: xPos, y: 1.85, w: 2.1, h: 0.6,
          fontSize: 28, color: '111827', bold: true,
          align: 'center'
        });
        
        const pct = metric.value > 0 ? Math.round((metric.completed / metric.value) * 100) : 0;
        summarySlide.addText(`${pct}% complete`, {
          x: xPos, y: 2.55, w: 2.1, h: 0.3,
          fontSize: 10, color: getStatusColor(pct),
          align: 'center'
        });
      }
    });
    
    summarySlide.addText('Status Distribution', {
      x: 0.5, y: 3.5, w: 9, h: 0.5,
      fontSize: 16, color: '374151', bold: true
    });
    
    const statusData = [
      { label: 'On Track (≥70%)', color: '22C55E' },
      { label: 'At Risk (40-69%)', color: 'EAB308' },
      { label: 'Behind (<40%)', color: 'EF4444' },
    ];
    
    statusData.forEach((status, index) => {
      const xPos = 0.5 + (index * 3);
      summarySlide.addShape(pptx.ShapeType.rect, {
        x: xPos, y: 4.1, w: 0.3, h: 0.3,
        fill: { color: status.color }
      });
      summarySlide.addText(status.label, {
        x: xPos + 0.4, y: 4.1, w: 2.5, h: 0.3,
        fontSize: 12, color: '374151'
      });
    });
  }

  if (content?.objectives && Array.isArray(content.objectives) && content.objectives.length > 0) {
    const objSlide = pptx.addSlide();
    
    objSlide.addText('Objectives Overview', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 28, color: primaryColor, bold: true
    });
    
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Objective', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
        { text: 'Level', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Progress', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    content.objectives.slice(0, 10).forEach((obj: any) => {
      const progress = obj.progress || 0;
      tableData.push([
        { text: obj.title || 'Untitled', options: { align: 'left' } },
        { text: obj.level || '-', options: { align: 'center' } },
        { text: formatProgress(progress), options: { align: 'center', color: getStatusColor(progress), bold: true } },
      ]);
    });
    
    objSlide.addTable(tableData, {
      x: 0.5, y: 1.1, w: 9, h: 0.5,
      fontSize: 11,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      colW: [5.5, 1.5, 2],
    });
    
    if (content.objectives.length > 10) {
      objSlide.addText(`+ ${content.objectives.length - 10} more objectives`, {
        x: 0.5, y: 4.8, w: 9, h: 0.3,
        fontSize: 10, color: '6B7280', italic: true,
        align: 'center'
      });
    }
  }

  if (content?.keyResults && Array.isArray(content.keyResults) && content.keyResults.length > 0) {
    const krSlide = pptx.addSlide();
    
    krSlide.addText('Key Results', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 28, color: primaryColor, bold: true
    });
    
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Key Result', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
        { text: 'Current', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Target', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Progress', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    content.keyResults.slice(0, 10).forEach((kr: any) => {
      const progress = kr.progress || 0;
      tableData.push([
        { text: kr.title || 'Untitled', options: { align: 'left' } },
        { text: String(kr.currentValue ?? 0), options: { align: 'center' } },
        { text: String(kr.targetValue ?? 100), options: { align: 'center' } },
        { text: formatProgress(progress), options: { align: 'center', color: getStatusColor(progress), bold: true } },
      ]);
    });
    
    krSlide.addTable(tableData, {
      x: 0.5, y: 1.1, w: 9, h: 0.5,
      fontSize: 10,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      colW: [5, 1.2, 1.2, 1.6],
    });
    
    if (content.keyResults.length > 10) {
      krSlide.addText(`+ ${content.keyResults.length - 10} more key results`, {
        x: 0.5, y: 4.8, w: 9, h: 0.3,
        fontSize: 10, color: '6B7280', italic: true,
        align: 'center'
      });
    }
  }

  if (content?.bigRocks && Array.isArray(content.bigRocks) && content.bigRocks.length > 0) {
    const rocksSlide = pptx.addSlide();
    
    rocksSlide.addText('Initiatives (Big Rocks)', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 28, color: primaryColor, bold: true
    });
    
    const tableData: PptxGenJS.TableRow[] = [
      [
        { text: 'Initiative', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'left' } },
        { text: 'Status', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
        { text: 'Progress', options: { bold: true, fill: { color: primaryColor }, color: 'FFFFFF', align: 'center' } },
      ]
    ];
    
    content.bigRocks.slice(0, 10).forEach((rock: any) => {
      const progress = rock.progress || 0;
      tableData.push([
        { text: rock.title || 'Untitled', options: { align: 'left' } },
        { text: rock.status || 'Not started', options: { align: 'center' } },
        { text: formatProgress(progress), options: { align: 'center', color: getStatusColor(progress), bold: true } },
      ]);
    });
    
    rocksSlide.addTable(tableData, {
      x: 0.5, y: 1.1, w: 9, h: 0.5,
      fontSize: 11,
      border: { type: 'solid', pt: 0.5, color: 'E5E7EB' },
      colW: [5.5, 1.5, 2],
    });
    
    if (content.bigRocks.length > 10) {
      rocksSlide.addText(`+ ${content.bigRocks.length - 10} more initiatives`, {
        x: 0.5, y: 4.8, w: 9, h: 0.3,
        fontSize: 10, color: '6B7280', italic: true,
        align: 'center'
      });
    }
  }

  const closingSlide = pptx.addSlide();
  closingSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: secondaryColor }
  });
  
  closingSlide.addText('Thank You', {
    x: 0.5, y: 2, w: 9, h: 1,
    fontSize: 36, color: 'FFFFFF', bold: true,
    align: 'center'
  });
  
  closingSlide.addText(branding.reportFooterText || `${tenant.name} - Confidential`, {
    x: 0.5, y: 3.2, w: 9, h: 0.5,
    fontSize: 14, color: 'FFFFFF',
    align: 'center'
  });

  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
