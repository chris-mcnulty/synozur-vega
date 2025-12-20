import PDFDocument from 'pdfkit';
import { Tenant, ReportInstance, ReviewSnapshot } from '@shared/schema';

interface ReportData {
  report: ReportInstance;
  snapshot?: ReviewSnapshot;
  tenant: Tenant;
}

interface OKRData {
  objectives: Array<{
    id: string;
    title: string;
    level: string;
    progress: number;
    status: string;
    keyResults: Array<{
      id: string;
      title: string;
      currentValue: number;
      targetValue: number;
      progress: number;
      status: string;
    }>;
  }>;
  bigRocks: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
  }>;
}

function getStatusColor(progress: number): string {
  if (progress >= 70) return '#22c55e';
  if (progress >= 40) return '#eab308';
  return '#ef4444';
}

function formatProgress(progress: number): string {
  return `${Math.min(100, Math.round(progress))}%`;
}

export function generateReportPDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        bufferPages: true 
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { report, snapshot, tenant } = data;
      const branding = tenant.branding || {};
      const primaryColor = branding.primaryColor || '#3b82f6';

      doc.fontSize(24)
        .fillColor(primaryColor)
        .text(tenant.name, { align: 'center' });
      
      if (branding.tagline) {
        doc.fontSize(10)
          .fillColor('#6b7280')
          .text(branding.tagline, { align: 'center' });
      }
      
      doc.moveDown(0.5);
      
      doc.fontSize(18)
        .fillColor('#111827')
        .text(report.title, { align: 'center' });
      
      doc.moveDown(0.5);
      
      const periodStart = new Date(report.periodStart);
      const periodEnd = new Date(report.periodEnd);
      doc.fontSize(10)
        .fillColor('#6b7280')
        .text(`Report Period: ${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()}`, { align: 'center' });
      
      doc.text(`Generated: ${new Date(report.generatedAt || new Date()).toLocaleDateString()}`, { align: 'center' });
      
      doc.moveDown(2);

      const content = report.reportData as any;
      
      if (content?.summary) {
        doc.fontSize(14)
          .fillColor(primaryColor)
          .text('Executive Summary', { underline: true });
        doc.moveDown(0.5);
        
        const summary = content.summary;
        doc.fontSize(10).fillColor('#374151');
        
        if (typeof summary === 'object') {
          if (summary.totalObjectives !== undefined) {
            doc.text(`Total Objectives: ${summary.totalObjectives}`);
          }
          if (summary.averageProgress !== undefined) {
            doc.text(`Average Progress: ${formatProgress(summary.averageProgress)}`);
          }
          if (summary.totalKeyResults !== undefined) {
            doc.text(`Total Key Results: ${summary.totalKeyResults}`);
          }
          if (summary.totalBigRocks !== undefined) {
            doc.text(`Total Initiatives: ${summary.totalBigRocks}`);
          }
        }
        doc.moveDown(1.5);
      }

      if (content?.objectives && Array.isArray(content.objectives)) {
        doc.fontSize(14)
          .fillColor(primaryColor)
          .text('Objectives & Key Results', { underline: true });
        doc.moveDown(0.5);
        
        content.objectives.forEach((obj: any, index: number) => {
          const statusColor = getStatusColor(obj.progress || 0);
          
          doc.fontSize(11)
            .fillColor('#111827')
            .text(`${index + 1}. ${obj.title}`, { continued: false });
          
          doc.fontSize(9)
            .fillColor('#6b7280')
            .text(`   Level: ${obj.level || 'Not specified'} | Progress: `, { continued: true })
            .fillColor(statusColor)
            .text(formatProgress(obj.progress || 0));
          
          if (obj.keyResults && Array.isArray(obj.keyResults)) {
            obj.keyResults.forEach((kr: any) => {
              const krStatusColor = getStatusColor(kr.progress || 0);
              doc.fontSize(9)
                .fillColor('#6b7280')
                .text(`      • ${kr.title}: `, { continued: true })
                .fillColor(krStatusColor)
                .text(`${kr.currentValue || 0}/${kr.targetValue || 100} (${formatProgress(kr.progress || 0)})`);
            });
          }
          
          doc.moveDown(0.5);
        });
        
        doc.moveDown(1);
      }

      if (content?.bigRocks && Array.isArray(content.bigRocks)) {
        doc.fontSize(14)
          .fillColor(primaryColor)
          .text('Initiatives (Big Rocks)', { underline: true });
        doc.moveDown(0.5);
        
        content.bigRocks.forEach((rock: any, index: number) => {
          const statusColor = getStatusColor(rock.progress || 0);
          
          doc.fontSize(10)
            .fillColor('#111827')
            .text(`${index + 1}. ${rock.title}`, { continued: false });
          
          doc.fontSize(9)
            .fillColor('#6b7280')
            .text(`   Status: ${rock.status || 'Not started'} | Progress: `, { continued: true })
            .fillColor(statusColor)
            .text(formatProgress(rock.progress || 0));
          
          doc.moveDown(0.3);
        });
        
        doc.moveDown(1);
      }

      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        doc.fontSize(8)
          .fillColor('#9ca3af')
          .text(
            branding.reportFooterText || `${tenant.name} - Confidential`,
            50,
            doc.page.height - 50,
            { align: 'left', width: doc.page.width - 150 }
          );
        
        doc.text(
          `Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 50,
          { align: 'right', width: doc.page.width - 100 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
