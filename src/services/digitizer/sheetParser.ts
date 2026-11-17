import { Course, Subject } from '../../types';
import {
  DigitizerBoundingBox,
  DigitizerHeader,
  DigitizerStatus,
} from './types';
import {
  nameSimilarity,
  normalizeText,
  parseDateValue,
  parseHours,
  pickBestDate,
  takeLabeledValue,
  toTitleCase,
} from './textUtils';

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: DigitizerBoundingBox;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: DigitizerBoundingBox;
  words: OcrWord[];
}

export interface ParsedTsv {
  words: OcrWord[];
  lines: OcrLine[];
  fullText: string;
}

export interface ColumnLayout {
  nameStart: number;
  nameEnd: number;
  markStart: number;
  markEnd: number;
  explicit: boolean;
}

const NAME_LABELS = ['nombre', 'nombres', 'estudiante', 'estudiantes', 'apellidos', 'alumno'];
const MARK_LABELS = ['falla', 'fallas', 'falta', 'faltas', 'inasistencia', 'retardo', 'retardos', 'tardanza', 'justificada', 'justificadas', 'excusa', 'asistencia', 'observacion', 'observaciones'];

export function parseTesseractTsv(tsv: string, fullText = ''): ParsedTsv {
  const words: OcrWord[] = [];
  if (tsv) {
    const rows = tsv.split(/\r?\n/);
    for (const row of rows.slice(1)) {
      const columns = row.split('\t');
      if (columns.length < 12) continue;
      const level = Number(columns[0]);
      if (level !== 5) continue;
      const text = (columns[11] || '').trim();
      if (!text) continue;
      const confidence = Number(columns[10]);
      if (!Number.isFinite(confidence) || confidence < 0) continue;
      const left = Number(columns[6]);
      const top = Number(columns[7]);
      const width = Number(columns[8]);
      const height = Number(columns[9]);
      if (![left, top, width, height].every(Number.isFinite)) continue;
      words.push({
        text,
        confidence,
        bbox: { x: left, y: top, width, height },
      });
    }
  }

  const grouped = new Map<string, OcrWord[]>();
  if (tsv) {
    const rows = tsv.split(/\r?\n/);
    for (const row of rows.slice(1)) {
      const columns = row.split('\t');
      if (columns.length < 12) continue;
      const level = Number(columns[0]);
      if (level !== 5) continue;
      const text = (columns[11] || '').trim();
      if (!text) continue;
      const confidence = Number(columns[10]);
      if (!Number.isFinite(confidence) || confidence < 0) continue;
      const left = Number(columns[6]);
      const top = Number(columns[7]);
      const width = Number(columns[8]);
      const height = Number(columns[9]);
      const key = `${columns[1]}-${columns[2]}-${columns[3]}-${columns[4]}`;
      const list = grouped.get(key) || [];
      list.push({ text, confidence, bbox: { x: left, y: top, width, height } });
      grouped.set(key, list);
    }
  }

  const lines: OcrLine[] = [];
  grouped.forEach((lineWords) => {
    const sorted = [...lineWords].sort((a, b) => a.bbox.x - b.bbox.x);
    const left = Math.min(...sorted.map((word) => word.bbox.x));
    const top = Math.min(...sorted.map((word) => word.bbox.y));
    const right = Math.max(...sorted.map((word) => word.bbox.x + word.bbox.width));
    const bottom = Math.max(...sorted.map((word) => word.bbox.y + word.bbox.height));
    const confidence = sorted.reduce((sum, word) => sum + word.confidence, 0) / sorted.length;
    lines.push({
      text: sorted.map((word) => word.text).join(' '),
      confidence,
      bbox: { x: left, y: top, width: right - left, height: bottom - top },
      words: sorted,
    });
  });
  lines.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);

  const derivedText = fullText || lines.map((line) => line.text).join('\n');
  return { words, lines, fullText: derivedText };
}

export function isHeaderLine(line: OcrLine): boolean {
  const text = normalizeText(line.text);
  return /(nombre|estudiante|apellido|documento|falla|falta|retardo|justificada|asistencia|observacion|curso|grado|materia|area|asignatura|fecha|docente|profesor|periodo)/.test(text);
}

export function findHeaderLines(lines: OcrLine[], pageHeight: number): OcrLine[] {
  const topLimit = pageHeight > 0 ? pageHeight * 0.45 : Number.POSITIVE_INFINITY;
  const candidates = lines.filter((line) => line.bbox.y <= topLimit);
  const headerCandidates = candidates.filter(isHeaderLine);
  if (headerCandidates.length) return headerCandidates;
  return candidates.slice(0, Math.max(1, Math.min(8, candidates.length)));
}

export function detectColumns(lines: OcrLine[], pageWidth: number): ColumnLayout {
  const headerLines = lines.filter(isHeaderLine);
  let nameStart: number | null = null;
  let nameEnd: number | null = null;
  let markStart: number | null = null;
  let markEnd: number | null = null;

  for (const line of headerLines) {
    for (const word of line.words) {
      const normalized = normalizeText(word.text);
      if (!normalized) continue;
      if (NAME_LABELS.some((label) => normalized.includes(label))) {
        nameStart = nameStart === null ? word.bbox.x : Math.min(nameStart, word.bbox.x);
        nameEnd = nameEnd === null ? word.bbox.x + word.bbox.width : Math.max(nameEnd, word.bbox.x + word.bbox.width);
      }
      if (MARK_LABELS.some((label) => normalized.includes(label))) {
        markStart = markStart === null ? word.bbox.x : Math.min(markStart, word.bbox.x);
        markEnd = markEnd === null ? word.bbox.x + word.bbox.width : Math.max(markEnd, word.bbox.x + word.bbox.width);
      }
    }
  }

  if (nameStart !== null && nameEnd !== null && markStart !== null && markStart > nameEnd) {
    return {
      nameStart: Math.max(0, nameStart - 12),
      nameEnd: Math.max(nameEnd + 12, Math.min(markStart, nameEnd + pageWidth * 0.08)),
      markStart,
      markEnd: Math.min(pageWidth, (markEnd ?? pageWidth) + 12),
      explicit: true,
    };
  }

  if (nameStart !== null && nameEnd !== null) {
    const estimatedMarkStart = Math.min(pageWidth - 8, Math.max(nameEnd + pageWidth * 0.12, pageWidth * 0.55));
    return {
      nameStart: Math.max(0, nameStart - 12),
      nameEnd: Math.max(nameEnd + 12, pageWidth * 0.55),
      markStart: estimatedMarkStart,
      markEnd: pageWidth,
      explicit: false,
    };
  }

  return {
    nameStart: 0,
    nameEnd: Math.round(pageWidth * 0.62),
    markStart: Math.round(pageWidth * 0.62),
    markEnd: pageWidth,
    explicit: false,
  };
}

export function parseMark(raw: string): { status: DigitizerStatus; markDetected: string; confidence: number } {
  const markDetected = (raw || '').trim();
  if (/^[✓✔]$/.test(markDetected)) {
    return { status: 'presente', markDetected, confidence: 0.9 };
  }
  if (/^[×✗]$/.test(markDetected)) {
    return { status: 'falla', markDetected, confidence: 0.9 };
  }
  const normalized = normalizeText(markDetected);
  if (!normalized) {
    return { status: 'sin_definir', markDetected: '', confidence: 0 };
  }

  if (/(justificad|excusa|permiso|incapacidad)/.test(normalized)) {
    return { status: 'justificada', markDetected, confidence: 0.9 };
  }
  if (/(retardo|tardanza|tarde|^r$|^t$)/.test(normalized)) {
    return { status: 'retardo', markDetected, confidence: 0.85 };
  }
  if (/(ausente|falta|inasistencia|^x$|^f$)/.test(normalized) || /^[x×✗]$/.test(markDetected)) {
    return { status: 'falla', markDetected, confidence: 0.92 };
  }
  if (/(presente|asistio|asistencia|^p$|^a$|^v$|check|^ok$)/.test(normalized) || /^[✓✔]$/.test(markDetected)) {
    return { status: 'presente', markDetected, confidence: 0.85 };
  }
  if (markDetected.length <= 2 && /^[xXrRjJpPtTvV✓✔×✗]+$/.test(markDetected)) {
    const char = markDetected[0].toLowerCase();
    if (char === 'x' || char === '×' || char === '✗') return { status: 'falla', markDetected, confidence: 0.7 };
    if (char === 'r' || char === 't') return { status: 'retardo', markDetected, confidence: 0.65 };
    if (char === 'j') return { status: 'justificada', markDetected, confidence: 0.65 };
    if (char === 'p' || char === 'v' || char === '✓' || char === '✔') return { status: 'presente', markDetected, confidence: 0.6 };
  }

  return { status: 'sin_definir', markDetected, confidence: 0.2 };
}

export function cleanOcrName(raw: string): string {
  let text = (raw || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[|_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  text = text.replace(/^[\d\s.,#°º-]+/, '');
  text = text.replace(/^(nombres?|apellidos?|estudiante|alumno)\s*[:.-]?\s*/i, '');
  text = text.replace(/\s*(presente|ausente|falta|retardo|justificada|firma|documento)\s*$/i, '');
  text = text.replace(/\s*[xX✓✔]\s*$/, '');
  text = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'.-]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();

  const letters = (text.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g) || []).length;
  const digits = (text.match(/\d/g) || []).length;
  if (letters < 3 || digits > letters) return '';
  if (text.length > 80) text = text.slice(0, 80).trim();
  return toTitleCase(text);
}

export function matchCatalogName<T extends { id: string; name: string; code?: string }>(
  raw: string,
  catalog: T[]
): { item: T; score: number } | null {
  const candidate = (raw || '').trim();
  if (!candidate) return null;
  let best: { item: T; score: number } | null = null;
  for (const item of catalog) {
    const score = Math.max(
      nameSimilarity(candidate, item.name),
      item.code ? nameSimilarity(candidate, item.code) : 0
    );
    if (!best || score > best.score) best = { item, score };
  }
  if (!best || best.score < 0.55) return null;
  return best;
}

export function parseHeader(
  text: string,
  lines: OcrLine[],
  courses: Course[],
  subjects: Subject[],
  defaults: { courseId: string; subjectId: string; date: string; hours: number }
): DigitizerHeader {
  const rawText = text || '';
  const date =
    pickBestDate(rawText, new Date().getFullYear()) ||
    parseDateValue(takeLabeledValue(rawText, ['fecha']), new Date().getFullYear()) ||
    defaults.date;

  const courseValue =
    takeLabeledValue(rawText, ['curso', 'grado', 'grupo']) ||
    lines.find((line) => /(curso|grado|grupo)/i.test(line.text))?.text ||
    '';
  const subjectValue =
    takeLabeledValue(rawText, ['materia', 'asignatura', 'area', 'área']) ||
    lines.find((line) => /(materia|asignatura|area|área)/i.test(line.text))?.text ||
    '';

  const courseMatch = matchCatalogName(courseValue, courses);
  const subjectMatch = matchCatalogName(subjectValue, subjects);
  const hoursValue =
    parseHours(takeLabeledValue(rawText, ['horas', 'hora', 'intensidad'])) ??
    parseHours(rawText) ??
    defaults.hours;
  const teacher =
    takeLabeledValue(rawText, ['docente', 'profesor', 'profesora', 'educador']) ||
    '';
  const titleLine = lines.find((line) => /(planilla|registro|control|asistencia)/i.test(line.text));

  const found = [courseMatch, subjectMatch, pickBestDate(rawText), teacher, titleLine].filter(Boolean).length;
  const confidence = Math.min(1, found / 5);

  return {
    date,
    courseId: courseMatch?.item.id || defaults.courseId,
    subjectId: subjectMatch?.item.id || defaults.subjectId,
    hours: hoursValue,
    teacher: teacher.trim(),
    title: (titleLine?.text || '').trim(),
    notes: '',
    confidence,
    rawText,
  };
}

export function mergeRowWords(words: OcrWord[], minX: number, maxX: number): { text: string; confidence: number } {
  const inside = words
    .filter((word) => {
      const center = word.bbox.x + word.bbox.width / 2;
      return center >= minX && center <= maxX;
    })
    .sort((a, b) => a.bbox.x - b.bbox.x);
  if (!inside.length) return { text: '', confidence: 0 };
  const text = inside.map((word) => word.text).join(' ');
  const confidence = inside.reduce((sum, word) => sum + word.confidence, 0) / inside.length;
  return { text, confidence };
}
