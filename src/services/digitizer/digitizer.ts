import { Student } from '../../types';
import { canvasToDataUrl, cropCanvas, dataUrlToCanvas, estimateInkRatio, estimateSharpness, makeThumbnail } from './imageUtils';
import { analyzeLayout, enhanceDocument } from './opencv';
import { recognizePage, recognizeSingleLine } from './ocrEngine';
import {
  cleanOcrName,
  detectColumns,
  findHeaderLines,
  mergeRowWords,
  parseHeader,
  parseMark,
  parseTesseractTsv,
} from './sheetParser';
import {
  calculateMetrics,
  createOmittedRows,
  resolveMatches,
} from './reconcile';
import { trocrClient } from './trocr';
import {
  DigitizerOptions,
  DigitizerResult,
  DigitizerRow,
  DigitizerStatus,
} from './types';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emit(
  options: DigitizerOptions,
  step: Parameters<NonNullable<DigitizerOptions['onProgress']>>[0]['step'],
  message: string,
  current?: number,
  total?: number
): void {
  options.onProgress?.({ step, message, current, total });
}

export async function digitizePage(
  sourceDataUrl: string,
  fileName: string,
  pageNumber: number,
  pageCount: number,
  options: DigitizerOptions
): Promise<DigitizerResult> {
  const warnings: string[] = [];
  emit(options, 'preparing', 'Preparando la página...');

  const originalCanvas = await dataUrlToCanvas(sourceDataUrl, 2000);
  const sharpness = estimateSharpness(originalCanvas);
  if (sharpness < 45) {
    warnings.push('La imagen parece desenfocada. Revisa los campos marcados con baja confianza.');
  }

  emit(options, 'enhancing', 'Corrigiendo perspectiva, sombras y nitidez...');
  const enhanced = await enhanceDocument(sourceDataUrl);
  if (enhanced.usedFallback) {
    warnings.push('OpenCV no pudo procesar la imagen; se aplicó una mejora básica de contraste.');
  }
  const enhancedCanvas = await dataUrlToCanvas(enhanced.enhancedDataUrl, 2000);
  const pageWidth = enhancedCanvas.width;
  const pageHeight = enhancedCanvas.height;

  emit(options, 'reading-header', 'Leyendo encabezado y texto impreso...', 0, 1);
  const pageOcr = await recognizePage(enhanced.enhancedDataUrl, (message, progress) => {
    emit(options, 'reading-header', `Tesseract: ${message}`, Math.round(progress * 100), 100);
  });
  const parsedTsv = parseTesseractTsv(pageOcr.tsv, pageOcr.text);
  if (!parsedTsv.fullText.trim()) {
    warnings.push('No se detectó texto impreso legible. Los nombres manuscritos se leerán con el modelo local.');
  }

  const headerLines = findHeaderLines(parsedTsv.lines, pageHeight);
  const header = parseHeader(parsedTsv.fullText, headerLines, options.catalog.courses, options.catalog.subjects, {
    courseId: options.courseId,
    subjectId: options.subjectId,
    date: options.date,
    hours: options.hours,
  });
  if (!header.teacher) header.teacher = '';
  if (!header.rawText) warnings.push('Encabezado no reconocido; completa los datos manualmente antes de confirmar.');

  emit(options, 'detecting-rows', 'Detectando filas y columnas de la planilla...');
  const layout = await analyzeLayout(enhanced.enhancedDataUrl);
  const scaleX = layout.width > 0 ? pageWidth / layout.width : 1;
  const scaleY = layout.height > 0 ? pageHeight / layout.height : 1;

  const headerBottom = headerLines.length
    ? Math.max(...headerLines.map((line) => line.bbox.y + line.bbox.height))
    : 0;
  const headerLimit = Math.max(headerBottom, pageHeight * 0.12);

  let bands = layout.rowBands
    .map((band) => ({ y: Math.round(band.y * scaleY), height: Math.round(band.height * scaleY) }))
    .filter((band) => band.y >= headerLimit - 4);

  if (bands.length < 3) {
    bands = parsedTsv.lines
      .filter((line) => line.bbox.y >= headerLimit - 4)
      .map((line) => ({ y: line.bbox.y - 4, height: line.bbox.height + 8 }))
      .filter((band) => band.height >= 10 && band.height <= Math.max(90, pageHeight * 0.12));
  }

  if (bands.length === 0) {
    throw new Error('No se detectaron filas de estudiantes. Intenta con una foto más nítida y frontal.');
  }
  if (!layout.usedGrid) {
    warnings.push('No se detectaron líneas de tabla con certeza; las columnas se estimaron y debes revisarlas.');
  }

  const columns = detectColumns(headerLines, pageWidth);
  if (!columns.explicit) {
    warnings.push('No se reconoció el encabezado de columnas; se usó una división estimada nombre/marcas.');
  }

  const roster: Student[] = options.catalog.students.filter(
    (student) => student.status === 'activo' && (!header.courseId || student.courseId === header.courseId)
  );

  let useTrocr = options.useTrocr;
  if (useTrocr) {
    emit(options, 'reading-names', 'Cargando modelo TrOCR local...', 0, bands.length);
    try {
      await trocrClient.warmup();
    } catch (error: any) {
      useTrocr = false;
      warnings.push(
        `TrOCR no pudo cargarse (${error?.message || 'modelo no disponible'}). Se intentará leer con Tesseract.`
      );
    }
  }

  const rows: DigitizerRow[] = [];
  const seenBands = new Set<string>();

  for (let index = 0; index < bands.length; index++) {
    const band = bands[index];
    const bandKey = `${Math.round(band.y / 4)}-${Math.round(band.height / 4)}`;
    if (seenBands.has(bandKey)) continue;
    seenBands.add(bandKey);

    emit(options, 'reading-names', 'Leyendo nombres manuscritos...', index + 1, bands.length);
    const nameCanvas = cropCanvas(
      enhancedCanvas,
      columns.nameStart,
      band.y,
      Math.max(20, columns.nameEnd - columns.nameStart),
      band.height,
      2
    );
    const nameInk = estimateInkRatio(nameCanvas);
    const nameFromTesseract = mergeRowWords(parsedTsv.words, columns.nameStart, columns.nameEnd);
    let nameText = '';
    let nameEngine: DigitizerRow['nameEngine'] = 'tesseract';
    let confidence = nameFromTesseract.confidence / 100;

    if (useTrocr) {
      try {
        const trocrText = await trocrClient.recognize(canvasToDataUrl(nameCanvas, 0.95, 'image/png'));
        const cleaned = cleanOcrName(trocrText);
        if (cleaned) {
          nameText = cleaned;
          nameEngine = 'trocr';
          confidence = Math.min(0.9, 0.55 + Math.min(0.3, cleaned.length / 100));
        }
      } catch (error: any) {
        useTrocr = false;
        warnings.push(`TrOCR dejó de responder (${error?.message || 'error'}). Se usará Tesseract para el resto.`);
      }
    }

    if (!nameText) {
      const cleaned = cleanOcrName(nameFromTesseract.text);
      if (cleaned) {
        nameText = cleaned;
        nameEngine = 'tesseract';
      }
    }

    if (!nameText && nameInk < 0.004) {
      continue;
    }

    emit(options, 'reading-marks', 'Interpretando marcas...', index + 1, bands.length);
    const markCanvas = cropCanvas(
      enhancedCanvas,
      columns.markStart,
      band.y,
      Math.max(20, columns.markEnd - columns.markStart),
      band.height,
      2
    );
    const markInk = estimateInkRatio(markCanvas);
    const markFromTesseract = mergeRowWords(parsedTsv.words, columns.markStart, columns.markEnd);
    let markText = markFromTesseract.text;
    let markConfidence = markFromTesseract.confidence / 100;

    if (markInk >= 0.003) {
      try {
        const single = await recognizeSingleLine(
          canvasToDataUrl(markCanvas, 0.95, 'image/png'),
          'XxRrJjTtPpVvSsAaFf/'
        );
        if (single.text && single.confidence >= 35) {
          markText = single.text;
          markConfidence = single.confidence / 100;
        }
      } catch {
        // If single-line OCR fails we keep the full-page mark text.
      }
    }

    const mark = parseMark(markText);
    let status: DigitizerStatus = mark.status;
    if (!markText.trim() && markInk < 0.003) {
      status = 'sin_definir';
    }
    if (status === 'sin_definir' && markInk >= 0.02) {
      markText = markText || '?';
    }

    const row: DigitizerRow = {
      id: createId('row'),
      sheetRow: rows.length + 1,
      studentName: nameText,
      document: '',
      status,
      markDetected: markText.trim(),
      confidence: Math.max(confidence, markConfidence, mark.confidence),
      candidates: [],
      flags: [],
      observation: '',
      hours: header.hours || options.hours,
      boundingBox: {
        x: columns.nameStart,
        y: band.y,
        width: Math.max(1, columns.nameEnd - columns.nameStart),
        height: band.height,
      },
      nameEngine,
    };
    if (!columns.explicit) row.flags.push('estructura_estimada');
    if (status === 'sin_definir' && markInk >= 0.02) row.flags.push('baja_confianza');
    if (nameInk >= 0.004 && !nameText) row.flags.push('ilegible');
    rows.push(row);
  }

  emit(options, 'reconciling', 'Cotejando nombres con la matrícula oficial...');
  const reconciled = resolveMatches(rows, roster);
  const omitted = createOmittedRows(reconciled, roster, header.hours || options.hours);
  const allRows = [...reconciled, ...omitted];

  const thumbnail = await makeThumbnail(enhanced.enhancedDataUrl, 220);
  const metrics = calculateMetrics(allRows);

  emit(options, 'done', 'Lectura completada. Revisa y confirma los datos.');

  return {
    id: createId('dig'),
    fileName,
    pageNumber,
    pageCount,
    createdAt: new Date().toISOString(),
    originalImage: sourceDataUrl,
    enhancedImage: enhanced.enhancedDataUrl,
    thumbnail,
    engine: useTrocr ? 'TrOCR local + Tesseract + OpenCV' : 'Tesseract + OpenCV',
    header,
    rows: allRows,
    metrics,
    warnings: Array.from(new Set(warnings)),
  };
}
