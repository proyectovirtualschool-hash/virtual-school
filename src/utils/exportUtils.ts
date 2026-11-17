import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StudentAbsenceSummary, Course, Subject, InstitutionConfig } from '../types';

// Helper to trigger browser download
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ----------------------------------------------------
// EXCEL EXPORTS (XLSX)
// ----------------------------------------------------

export function exportStudentReportExcel(summary: StudentAbsenceSummary, config: InstitutionConfig, periodName: string) {
  const wb = XLSX.utils.book_new();

  // Header info
  const infoData = [
    [config.name.toUpperCase()],
    [`SISTEMA DE CONTROL DE ASISTENCIA Y FALLAS`],
    [`BOLETÍN INDIVIDUAL DE INASISTENCIAS - ${periodName}`],
    [],
    ['Estudiante:', summary.student.name, 'Documento:', `${summary.student.documentType || 'TI'} ${summary.student.document}`],
    ['Curso:', summary.course?.name || 'N/A', 'Total Fallas Injustificadas:', summary.totalGeneralAbsences],
    ['Estado de Alerta:', summary.hasAnyAlert ? 'ALERTA POR INASISTENCIA (>50%)' : 'REGULAR'],
    ['Fecha de Generación:', new Date().toLocaleDateString('es-CO')],
    [],
    ['RESUMEN POR ASIGNATURA'],
    ['Materia', 'Fallas Injustificadas', 'Máximo Permitido', '% Utilizado', 'Justificadas', 'Tardanzas', 'Estado / Alerta'],
  ];

  summary.subjectSummaries.forEach((sub) => {
    const estado = sub.isFailed
      ? 'REPROBADO POR FALLAS (100%)'
      : sub.isOverThreshold
      ? '¡ALERTA CRÍTICA (>50%)!'
      : 'Normal';
    infoData.push([
      sub.subject.name,
      sub.totalAbsences,
      sub.maxAllowed,
      `${sub.percentUsed}%`,
      sub.justifiedCount,
      sub.tardiesCount,
      estado,
    ]);
  });

  infoData.push([]);
  infoData.push(['DETALLE CRONOLÓGICO DE INASISTENCIAS']);
  infoData.push(['Fecha', 'Materia', 'Tipo', 'Horas', 'Observación / Justificación']);

  summary.records.forEach((r) => {
    const subName = summary.subjectSummaries.find((s) => s.subject.id === r.subjectId)?.subject.name || 'Materia';
    infoData.push([
      r.date,
      subName,
      r.type === 'falla' ? 'Falla Injustificada' : r.type === 'justificada' ? 'Falla Justificada' : 'Retardo',
      r.hours,
      r.reason || 'Sin observación',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, ws, 'Boletín Estudiante');

  const safeName = summary.student.name.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Reporte_Fallas_${safeName}_${periodName.replace(/\s+/g, '_')}.xlsx`);
}

export function exportCourseMatrixExcel(
  course: Course,
  summaries: StudentAbsenceSummary[],
  subjects: Subject[],
  periodName: string
) {
  const wb = XLSX.utils.book_new();

  // Header
  const header = ['No.', 'Documento', 'Nombre del Estudiante'];
  subjects.forEach((s) => {
    header.push(`${s.name} (Max ${s.maxAbsences})`);
  });
  header.push('TOTAL FALLAS', 'ESTADO');

  const rows: any[][] = [
    [`SÁBANA CONSOLIDADA DE INASISTENCIAS - ${course.name}`],
    [`Periodo Académico: ${periodName}`],
    [`Generado: ${new Date().toLocaleDateString('es-CO')}`],
    [],
    header,
  ];

  summaries.forEach((sum, idx) => {
    const row: any[] = [idx + 1, sum.student.document, sum.student.name];
    subjects.forEach((s) => {
      const match = sum.subjectSummaries.find((sub) => sub.subject.id === s.id);
      if (match) {
        row.push(match.totalAbsences > 0 ? `${match.totalAbsences} (${match.percentUsed}%)` : '0');
      } else {
        row.push('-');
      }
    });
    row.push(sum.totalGeneralAbsences);
    row.push(sum.hasAnyAlert ? 'ALERTA >50%' : 'Normal');
    rows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sábana de Curso');
  XLSX.writeFile(wb, `Sabana_Asistencias_${course.code}_${periodName.replace(/\s+/g, '_')}.xlsx`);
}

export function exportRiskAlertsExcel(atRiskSummaries: StudentAbsenceSummary[], periodName: string) {
  const wb = XLSX.utils.book_new();

  const rows: any[][] = [
    [`REPORTE DE ALERTA TEMPRANA - ESTUDIANTES EN RIESGO DE PÉRDIDA POR INASISTENCIA`],
    [`Criterio: Supera el 50% de fallas permitidas en una o más materias`],
    [`Periodo: ${periodName}`],
    [`Fecha: ${new Date().toLocaleDateString('es-CO')}`],
    [],
    ['Documento', 'Estudiante', 'Curso', 'Materia Afectada', 'Fallas / Límite', '% Inasistencia', 'Acudiente', 'Teléfono'],
  ];

  atRiskSummaries.forEach((sum) => {
    sum.subjectSummaries
      .filter((s) => s.isOverThreshold)
      .forEach((sub) => {
        rows.push([
          sum.student.document,
          sum.student.name,
          sum.course?.name || 'N/A',
          sub.subject.name,
          `${sub.totalAbsences} / ${sub.maxAllowed}`,
          `${sub.percentUsed}%`,
          sum.student.guardianName || 'No registrado',
          sum.student.guardianPhone || 'No registrado',
        ]);
      });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Estudiantes en Riesgo');
  XLSX.writeFile(wb, `Alertas_Inasistencia_${periodName.replace(/\s+/g, '_')}.xlsx`);
}

// ----------------------------------------------------
// PDF EXPORTS (JSPDF + AUTOTABLE)
// ----------------------------------------------------

export function exportStudentReportPDF(summary: StudentAbsenceSummary, config: InstitutionConfig, periodName: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.name.toUpperCase(), 105, 11, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${config.nit} | ${config.address} | Tel: ${config.phone}`, 105, 18, { align: 'center' });
  doc.text(`CONTROL DE ASISTENCIA Y CONTROL DE FALLAS ACADÉMICAS`, 105, 24, { align: 'center' });

  // Document title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`BOLETÍN INDIVIDUAL DE INASISTENCIAS - ${periodName}`, 14, 38);

  // Student Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 42, 182, 28, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Estudiante:', 18, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(summary.student.name, 42, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Documento:', 125, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(`${summary.student.documentType || 'TI'} ${summary.student.document}`, 148, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Curso:', 18, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(summary.course?.name || 'N/A', 42, 56);

  doc.setFont('helvetica', 'bold');
  doc.text('Acudiente:', 125, 56);
  doc.setFont('helvetica', 'normal');
  doc.text(`${summary.student.guardianName || 'N/A'} (${summary.student.guardianPhone || 'S/N'})`, 150, 56);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Inasistencias:', 18, 63);
  doc.setFont('helvetica', 'normal');
  doc.text(`${summary.totalGeneralAbsences} horas`, 52, 63);

  doc.setFont('helvetica', 'bold');
  doc.text('Estado General:', 125, 63);
  if (summary.hasAnyAlert) {
    doc.setTextColor(220, 38, 38); // red
    doc.text('¡EN ALERTA DE REPROBACIÓN (>50%)!', 155, 63);
  } else {
    doc.setTextColor(22, 101, 52); // green
    doc.text('NORMAL / EN REGLA', 155, 63);
  }
  doc.setTextColor(30, 41, 59);

  // Table of Subjects
  const tableData = summary.subjectSummaries.map((sub) => {
    let statusText = 'Normal';
    if (sub.isFailed) statusText = 'REPROBADO (100%)';
    else if (sub.isOverThreshold) statusText = '¡ALERTA CRÍTICA (>50%)!';

    return [
      sub.subject.name,
      `${sub.totalAbsences} / ${sub.maxAllowed}`,
      `${sub.percentUsed}%`,
      sub.justifiedCount.toString(),
      sub.tardiesCount.toString(),
      statusText,
    ];
  });

  autoTable(doc, {
    startY: 74,
    head: [['Asignatura', 'Fallas / Límite', '% Usado', 'Justificadas', 'Tardanzas', 'Estado']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 28, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 31, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        if (data.cell.raw && data.cell.raw.toString().includes('ALERTA')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fillColor = [254, 242, 242];
        } else if (data.cell.raw && data.cell.raw.toString().includes('REPROBADO')) {
          data.cell.styles.textColor = [153, 27, 27];
          data.cell.styles.fillColor = [254, 226, 226];
        }
      }
    },
  });

  // Recent detailed records
  const finalY = (doc as any).lastAutoTable.finalY || 140;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Historial Detallado de Registros en el Periodo', 14, finalY + 8);

  const historyRows = summary.records.map((r) => {
    const subName = summary.subjectSummaries.find((s) => s.subject.id === r.subjectId)?.subject.name || 'Materia';
    const tipo = r.type === 'falla' ? 'Falla Injustificada' : r.type === 'justificada' ? 'Falla Justificada' : 'Retardo';
    return [r.date, subName, tipo, `${r.hours} h`, r.reason || 'Sin observación'];
  });

  autoTable(doc, {
    startY: finalY + 12,
    head: [['Fecha', 'Materia', 'Tipo', 'Horas', 'Observación / Motivo']],
    body: historyRows.length > 0 ? historyRows : [['--', '--', 'Sin registros de inasistencias en este periodo', '--', '--']],
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 45 },
      2: { cellWidth: 35 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 59 },
    },
  });

  // Signatures
  const bottomY = Math.max((doc as any).lastAutoTable.finalY + 20, 245);
  if (bottomY < 270) {
    doc.setDrawColor(148, 163, 184);
    doc.line(25, bottomY, 85, bottomY);
    doc.line(125, bottomY, 185, bottomY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Coordinación Académica / Rectoría', 55, bottomY + 5, { align: 'center' });
    doc.text('Firma de Notificación Acudiente', 155, bottomY + 5, { align: 'center' });
  }

  const safeName = summary.student.name.replace(/\s+/g, '_');
  doc.save(`Boletin_Fallas_${safeName}_${periodName.replace(/\s+/g, '_')}.pdf`);
}

export function exportCourseReportPDF(
  course: Course,
  summaries: StudentAbsenceSummary[],
  subjects: Subject[],
  config: InstitutionConfig,
  periodName: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(config.name.toUpperCase(), 148, 9, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`SÁBANA CONSOLIDADA DE INASISTENCIAS | CURSO: ${course.name} | PERIODO: ${periodName}`, 148, 16, { align: 'center' });

  // Build matrix columns
  const headCols = ['#', 'Documento', 'Estudiante'];
  subjects.forEach((s) => {
    headCols.push(`${s.name.substring(0, 10)} (Max ${s.maxAbsences})`);
  });
  headCols.push('Total', 'Estado');

  const rows = summaries.map((sum, i) => {
    const r: any[] = [i + 1, sum.student.document, sum.student.name];
    subjects.forEach((s) => {
      const match = sum.subjectSummaries.find((sub) => sub.subject.id === s.id);
      if (match) {
        r.push(match.totalAbsences > 0 ? `${match.totalAbsences}` : '0');
      } else {
        r.push('-');
      }
    });
    r.push(sum.totalGeneralAbsences);
    r.push(sum.hasAnyAlert ? 'ALERTA >50%' : 'Normal');
    return r;
  });

  autoTable(doc, {
    startY: 30,
    head: [headCols],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 2 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === headCols.length - 1) {
        if (data.cell.raw && data.cell.raw.toString().includes('ALERTA')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  doc.save(`Sabana_Asistencias_${course.code}_${periodName.replace(/\s+/g, '_')}.pdf`);
}
