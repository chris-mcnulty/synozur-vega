import PDFDocument from 'pdfkit';
import { Tenant, ReportInstance, ReviewSnapshot } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';

interface ReportData {
  report: ReportInstance;
  snapshot?: ReviewSnapshot;
  tenant: Tenant;
}

const FONT_PATH = path.join(process.cwd(), 'client/public/fonts');
const AVENIR_REGULAR = path.join(FONT_PATH, 'AvenirNextLTPro-Regular.ttf');
const AVENIR_MEDIUM = path.join(FONT_PATH, 'AvenirNextLTPro-Medium.ttf');
const AVENIR_DEMI = path.join(FONT_PATH, 'AvenirNextLTPro-Demi.ttf');
const AVENIR_BOLD = path.join(FONT_PATH, 'AvenirNextLTPro-Bold.ttf');

function getStatusColor(progress: number): string {
  if (progress >= 70) return '#22c55e';
  if (progress >= 40) return '#eab308';
  return '#ef4444';
}

function getStatusLabel(progress: number): string {
  if (progress >= 70) return 'On Track';
  if (progress >= 40) return 'At Risk';
  return 'Behind';
}

function formatProgress(progress: number): string {
  return `${Math.min(100, Math.round(progress))}%`;
}

async function fetchLogoAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function generateReportPDF(data: ReportData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        bufferPages: true,
        info: {
          Title: data.report.title,
          Author: 'Vega Company OS',
          Subject: 'OKR Progress Report',
          Creator: 'Vega by The Synozur Alliance',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Register custom fonts
      if (fs.existsSync(AVENIR_REGULAR)) {
        doc.registerFont('Avenir', AVENIR_REGULAR);
      }
      if (fs.existsSync(AVENIR_MEDIUM)) {
        doc.registerFont('Avenir-Medium', AVENIR_MEDIUM);
      }
      if (fs.existsSync(AVENIR_DEMI)) {
        doc.registerFont('Avenir-Demi', AVENIR_DEMI);
      }
      if (fs.existsSync(AVENIR_BOLD)) {
        doc.registerFont('Avenir-Bold', AVENIR_BOLD);
      }

      const useCustomFont = fs.existsSync(AVENIR_REGULAR);
      const fontRegular = useCustomFont ? 'Avenir' : 'Helvetica';
      const fontMedium = useCustomFont ? 'Avenir-Medium' : 'Helvetica';
      const fontDemi = useCustomFont ? 'Avenir-Demi' : 'Helvetica-Bold';
      const fontBold = useCustomFont ? 'Avenir-Bold' : 'Helvetica-Bold';

      const { report, snapshot, tenant } = data;
      const branding = tenant.branding || {};
      const primaryColor = branding.primaryColor || '#810FFB';
      const content = report.reportData as any;
      const pageWidth = doc.page.width - 100;

      // === COVER PAGE ===
      
      // Header bar with primary color
      doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);

      // Fetch and display tenant logo
      let logoY = 35;
      if (tenant.logoUrl) {
        try {
          const logoBuffer = await fetchLogoAsBuffer(tenant.logoUrl);
          if (logoBuffer) {
            doc.image(logoBuffer, 50, 30, { height: 50 });
            logoY = 90;
          }
        } catch (e) {
          // Continue without logo
        }
      }

      // Vega branding in header
      doc.font(fontRegular).fontSize(9).fillColor('#ffffff')
        .text('Powered by Vega  |  vega.synozur.com', 50, 95, { align: 'right', width: pageWidth });

      // Report title section
      doc.moveDown(4);
      doc.font(fontBold).fontSize(28).fillColor(primaryColor)
        .text(tenant.name, 50, 160, { align: 'center', width: pageWidth });
      
      if (branding.tagline) {
        doc.font(fontRegular).fontSize(12).fillColor('#6b7280')
          .text(branding.tagline, { align: 'center' });
      }
      
      doc.moveDown(1.5);
      
      doc.font(fontDemi).fontSize(22).fillColor('#111827')
        .text(report.title, { align: 'center' });
      
      doc.moveDown(0.5);
      
      const periodStart = new Date(report.periodStart);
      const periodEnd = new Date(report.periodEnd);
      doc.font(fontRegular).fontSize(12).fillColor('#6b7280')
        .text(`Report Period: ${periodStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, { align: 'center' });
      
      doc.fontSize(10)
        .text(`Generated: ${new Date(report.generatedAt || new Date()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, { align: 'center' });

      // === EXECUTIVE SUMMARY METRICS ===
      doc.moveDown(3);
      
      // Summary metrics box
      if (content?.summary) {
        const summary = content.summary;
        const boxY = doc.y;
        
        doc.rect(50, boxY, pageWidth, 100).lineWidth(1).stroke('#e5e7eb');
        
        doc.font(fontDemi).fontSize(14).fillColor(primaryColor)
          .text('Executive Summary', 60, boxY + 10);
        
        doc.font(fontRegular).fontSize(11).fillColor('#374151');
        
        const col1X = 60;
        const col2X = 200;
        const col3X = 340;
        const metricsY = boxY + 35;
        
        doc.font(fontMedium).text('Objectives', col1X, metricsY);
        doc.font(fontBold).fontSize(18).fillColor(primaryColor)
          .text(`${summary.completedObjectives || 0}/${summary.totalObjectives || 0}`, col1X, metricsY + 18);
        doc.font(fontRegular).fontSize(9).fillColor('#6b7280')
          .text('completed', col1X, metricsY + 40);
        
        doc.font(fontMedium).fontSize(11).fillColor('#374151')
          .text('Key Results', col2X, metricsY);
        doc.font(fontBold).fontSize(18).fillColor(primaryColor)
          .text(`${summary.completedKeyResults || 0}/${summary.totalKeyResults || 0}`, col2X, metricsY + 18);
        doc.font(fontRegular).fontSize(9).fillColor('#6b7280')
          .text('completed', col2X, metricsY + 40);
        
        doc.font(fontMedium).fontSize(11).fillColor('#374151')
          .text('Average Progress', col3X, metricsY);
        const avgProgress = summary.averageProgress || 0;
        doc.font(fontBold).fontSize(18).fillColor(getStatusColor(avgProgress))
          .text(formatProgress(avgProgress), col3X, metricsY + 18);
        doc.font(fontRegular).fontSize(9).fillColor(getStatusColor(avgProgress))
          .text(getStatusLabel(avgProgress), col3X, metricsY + 40);

        doc.y = boxY + 110;
      }

      // === AI NARRATIVE SUMMARY ===
      if (content?.aiSummary) {
        const ai = content.aiSummary;
        doc.moveDown(1);
        
        doc.font(fontDemi).fontSize(14).fillColor(primaryColor)
          .text('AI Executive Insights', 50);
        doc.moveDown(0.5);
        
        // Headline box
        const headlineY = doc.y;
        doc.rect(50, headlineY, pageWidth, 50).fill(primaryColor);
        doc.font(fontMedium).fontSize(12).fillColor('#ffffff')
          .text(ai.headline || 'Period summary available', 60, headlineY + 15, { width: pageWidth - 20 });
        
        doc.y = headlineY + 60;
        
        // Key Themes
        if (ai.keyThemes && ai.keyThemes.length > 0) {
          doc.font(fontMedium).fontSize(11).fillColor('#374151')
            .text('Key Themes:', 50);
          doc.moveDown(0.3);
          
          ai.keyThemes.forEach((theme: string, idx: number) => {
            doc.font(fontRegular).fontSize(10).fillColor('#4b5563')
              .text(`${idx + 1}. ${theme}`, 60);
          });
          doc.moveDown(0.5);
        }
        
        // Strategic Guidance
        if (ai.guidance) {
          doc.font(fontMedium).fontSize(11).fillColor('#374151')
            .text('Strategic Guidance:', 50);
          doc.moveDown(0.3);
          doc.font(fontRegular).fontSize(10).fillColor('#4b5563')
            .text(ai.guidance, 60, doc.y, { width: pageWidth - 20 });
        }
        
        doc.moveDown(1.5);
      }

      // === OBJECTIVES & KEY RESULTS ===
      if (content?.objectives && Array.isArray(content.objectives) && content.objectives.length > 0) {
        // Check if we need a new page
        if (doc.y > 600) {
          doc.addPage();
        }
        
        doc.font(fontDemi).fontSize(14).fillColor(primaryColor)
          .text('Objectives & Key Results', 50);
        doc.moveDown(0.5);
        
        // Separator line
        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(1).stroke('#e5e7eb');
        doc.moveDown(0.5);
        
        content.objectives.slice(0, 15).forEach((obj: any, index: number) => {
          // Check for page break
          if (doc.y > 700) {
            doc.addPage();
          }
          
          const statusColor = getStatusColor(obj.progress || 0);
          const objY = doc.y;
          
          // Objective title with progress indicator
          doc.font(fontMedium).fontSize(11).fillColor('#111827')
            .text(`${index + 1}. ${obj.title}`, 50, objY, { continued: false, width: pageWidth - 80 });
          
          // Progress badge
          doc.font(fontBold).fontSize(10).fillColor(statusColor)
            .text(formatProgress(obj.progress || 0), 50 + pageWidth - 50, objY, { align: 'right', width: 50 });
          
          // Meta info
          doc.font(fontRegular).fontSize(9).fillColor('#6b7280')
            .text(`Level: ${obj.level || 'Team'}  |  Owner: ${obj.ownerEmail?.split('@')[0] || 'Unassigned'}  |  Status: ${getStatusLabel(obj.progress || 0)}`, 60);
          
          // Key Results
          if (obj.keyResults && Array.isArray(obj.keyResults) && obj.keyResults.length > 0) {
            doc.moveDown(0.3);
            obj.keyResults.forEach((kr: any) => {
              const krStatusColor = getStatusColor(kr.progress || 0);
              doc.font(fontRegular).fontSize(9).fillColor('#4b5563')
                .text(`    • ${kr.title}`, 60, doc.y, { continued: true, width: pageWidth - 100 });
              doc.font(fontMedium).fillColor(krStatusColor)
                .text(`  ${kr.currentValue || 0}/${kr.targetValue || 100} (${formatProgress(kr.progress || 0)})`, { continued: false });
            });
          }
          
          doc.moveDown(0.8);
        });
        
        if (content.objectives.length > 15) {
          doc.font(fontRegular).fontSize(10).fillColor('#6b7280')
            .text(`+ ${content.objectives.length - 15} additional objectives not shown`, 50, doc.y, { align: 'center', width: pageWidth });
        }
      }

      // === INITIATIVES (BIG ROCKS) ===
      if (content?.bigRocks && Array.isArray(content.bigRocks) && content.bigRocks.length > 0) {
        if (doc.y > 600) {
          doc.addPage();
        }
        
        doc.moveDown(1);
        doc.font(fontDemi).fontSize(14).fillColor(primaryColor)
          .text('Initiatives (Big Rocks)', 50);
        doc.moveDown(0.5);
        
        doc.moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).lineWidth(1).stroke('#e5e7eb');
        doc.moveDown(0.5);
        
        const statusCounts = {
          completed: content.bigRocks.filter((r: any) => r.status === 'completed').length,
          in_progress: content.bigRocks.filter((r: any) => r.status === 'in_progress').length,
          not_started: content.bigRocks.filter((r: any) => r.status === 'not_started' || !r.status).length,
          blocked: content.bigRocks.filter((r: any) => r.status === 'blocked').length,
        };
        
        doc.font(fontRegular).fontSize(10).fillColor('#374151')
          .text(`Completed: ${statusCounts.completed}  |  In Progress: ${statusCounts.in_progress}  |  Not Started: ${statusCounts.not_started}  |  Blocked: ${statusCounts.blocked}`, 50);
        doc.moveDown(0.5);
        
        content.bigRocks.slice(0, 12).forEach((rock: any, index: number) => {
          if (doc.y > 720) {
            doc.addPage();
          }
          
          const statusColor = rock.status === 'completed' ? '#22c55e' : 
                              rock.status === 'in_progress' ? '#3b82f6' : 
                              rock.status === 'blocked' ? '#ef4444' : '#9ca3af';
          
          doc.font(fontMedium).fontSize(10).fillColor('#111827')
            .text(`${index + 1}. ${rock.title}`, 50, doc.y, { continued: false, width: pageWidth - 80 });
          
          doc.font(fontRegular).fontSize(9).fillColor(statusColor)
            .text(`${(rock.status || 'not_started').replace('_', ' ').toUpperCase()}`, 50 + pageWidth - 80, doc.y - 12, { align: 'right', width: 80 });
          
          if (rock.completionPercentage !== undefined && rock.completionPercentage !== null) {
            doc.font(fontRegular).fontSize(9).fillColor('#6b7280')
              .text(`Progress: ${rock.completionPercentage}%`, 60);
          }
          
          doc.moveDown(0.5);
        });
      }

      // === ADD FOOTERS TO ALL PAGES ===
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        // Footer separator line
        doc.moveTo(50, doc.page.height - 60)
          .lineTo(doc.page.width - 50, doc.page.height - 60)
          .lineWidth(0.5)
          .stroke('#e5e7eb');
        
        // Left: Vega branding
        doc.font(fontRegular).fontSize(8).fillColor('#9ca3af')
          .text('Powered by Vega  |  vega.synozur.com', 50, doc.page.height - 50, { align: 'left', width: 200 });
        
        // Center: Copyright
        doc.font(fontRegular).fontSize(7).fillColor('#9ca3af')
          .text('Published by The Synozur Alliance LLC  www.synozur.com  © 2026 All Rights Reserved', 
            50, doc.page.height - 50, { align: 'center', width: doc.page.width - 100 });
        
        // Right: Page number
        doc.font(fontRegular).fontSize(8).fillColor('#9ca3af')
          .text(`Page ${i + 1} of ${pageCount}`, doc.page.width - 100, doc.page.height - 50, { align: 'right', width: 50 });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
