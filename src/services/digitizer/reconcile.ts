import { Student } from '../../types';
import {
  DigitizerCandidate,
  DigitizerFlag,
  DigitizerMetrics,
  DigitizerRow,
  DigitizerStatus,
} from './types';
import { cleanDocument, nameSimilarity } from './textUtils';

const MATCH_THRESHOLD = 0.78;
const AMBIGUITY_GAP = 0.05;
const LOW_CONFIDENCE = 0.86;

export function buildCandidates(
  row: Pick<DigitizerRow, 'studentName' | 'document'>,
  roster: Student[],
  limit = 3
): DigitizerCandidate[] {
  const document = cleanDocument(row.document || '');
  const scored = roster.map((student) => {
    const studentDocument = cleanDocument(student.document);
    let score = 0;
    if (document && studentDocument) {
      if (document === studentDocument) score = 1;
      else if (document.length >= 5 && studentDocument.includes(document)) score = 0.9;
      else if (studentDocument.length >= 5 && document.includes(studentDocument)) score = 0.9;
    }
    const nameScore = nameSimilarity(row.studentName || '', student.name);
    score = Math.max(score, nameScore);
    return {
      studentId: student.id,
      name: student.name,
      document: student.document,
      courseId: student.courseId,
      score,
    };
  });

  return scored
    .filter((candidate) => candidate.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function uniqueFlags(flags: DigitizerFlag[]): DigitizerFlag[] {
  return Array.from(new Set(flags));
}

export function resolveRowMatch(row: DigitizerRow, roster: Student[]): DigitizerRow {
  const flags: DigitizerFlag[] = [];
  const candidates = buildCandidates(row, roster);
  let matchedStudentId: string | undefined;

  if (!row.studentName.trim()) {
    flags.push('ilegible');
  } else if (candidates.length > 0) {
    const [best, second] = candidates;
    const gap = second ? best.score - second.score : best.score;
    if (best.score >= MATCH_THRESHOLD && (best.score >= 0.92 || gap >= AMBIGUITY_GAP)) {
      matchedStudentId = best.studentId;
      flags.push('cotejado');
      if (best.score < LOW_CONFIDENCE) flags.push('baja_confianza');
    } else if (best.score >= 0.55) {
      flags.push('conflicto');
    } else {
      flags.push('no_inscrito');
    }
  } else {
    flags.push('no_inscrito');
  }

  return {
    ...row,
    candidates,
    matchedStudentId,
    flags: uniqueFlags([...row.flags.filter((flag) => flag === 'estructura_estimada' || flag === 'excluido'), ...flags]),
  };
}

export function markDuplicateRows(rows: DigitizerRow[]): DigitizerRow[] {
  const byStudent = new Map<string, DigitizerRow[]>();
  rows.forEach((row) => {
    if (!row.matchedStudentId || row.excluded) return;
    const list = byStudent.get(row.matchedStudentId) || [];
    list.push(row);
    byStudent.set(row.matchedStudentId, list);
  });
  const duplicateIds = new Set<string>();
  byStudent.forEach((list) => {
    if (list.length > 1) list.forEach((row) => duplicateIds.add(row.id));
  });
  return rows.map((row) => {
    const flags: DigitizerFlag[] = row.flags.filter((flag) => flag !== 'duplicado');
    if (duplicateIds.has(row.id)) flags.push('duplicado');
    return { ...row, flags: uniqueFlags(flags) };
  });
}

export function resolveMatches(rows: DigitizerRow[], roster: Student[]): DigitizerRow[] {
  const resolved = rows.map((row) => resolveRowMatch(row, roster));
  return markDuplicateRows(resolved);
}

export function createOmittedRows(
  rows: DigitizerRow[],
  roster: Student[],
  defaultHours: number
): DigitizerRow[] {
  const matchedIds = new Set(rows.map((row) => row.matchedStudentId).filter(Boolean));
  const omitted = roster.filter((student) => !matchedIds.has(student.id));
  const nextIndex = rows.length + 1;
  return omitted.map((student, index) => ({
    id: `row-omitted-${student.id}-${index}`,
    sheetRow: nextIndex + index,
    studentName: student.name,
    document: student.document,
    status: 'sin_definir' as DigitizerStatus,
    confidence: 0,
    candidates: [
      {
        studentId: student.id,
        name: student.name,
        document: student.document,
        courseId: student.courseId,
        score: 1,
      },
    ],
    matchedStudentId: student.id,
    flags: ['omitido'] as DigitizerFlag[],
    observation: '',
    hours: defaultHours,
    rosterOnly: true,
    nameEngine: 'roster' as const,
  }));
}

export function isBlockingRow(row: DigitizerRow): boolean {
  if (row.excluded) return false;
  if (row.status === 'sin_definir') return true;
  return row.flags.some((flag) =>
    ['conflicto', 'no_inscrito', 'ilegible', 'duplicado', 'omitido'].includes(flag)
  );
}

export function canConfirm(rows: DigitizerRow[]): boolean {
  const activeRows = rows.filter((row) => !row.excluded);
  if (activeRows.length === 0) return false;
  return activeRows.every((row) => !isBlockingRow(row));
}

export function calculateMetrics(rows: DigitizerRow[]): DigitizerMetrics {
  const active = rows.filter((row) => !row.excluded);
  return {
    totalRows: active.length,
    matched: active.filter((row) => !!row.matchedStudentId).length,
    pending: active.filter((row) => row.status === 'sin_definir').length,
    omitted: active.filter((row) => row.flags.includes('omitido')).length,
    duplicates: active.filter((row) => row.flags.includes('duplicado')).length,
    unregistered: active.filter((row) => row.flags.includes('no_inscrito')).length,
    illegible: active.filter((row) => row.flags.includes('ilegible')).length,
    present: active.filter((row) => row.status === 'presente').length,
    absences: active.filter((row) => row.status === 'falla').length,
    tardies: active.filter((row) => row.status === 'retardo').length,
    justified: active.filter((row) => row.status === 'justificada').length,
  };
}

export function statusLabel(status: DigitizerStatus): string {
  switch (status) {
    case 'presente':
      return 'Asistió';
    case 'falla':
      return 'Falla';
    case 'retardo':
      return 'Retardo';
    case 'justificada':
      return 'Justificada';
    default:
      return 'Sin definir';
  }
}

export function flagLabel(flag: DigitizerFlag): string {
  switch (flag) {
    case 'cotejado':
      return 'Cotejado';
    case 'conflicto':
      return 'Conflicto';
    case 'no_inscrito':
      return 'No inscrito';
    case 'ilegible':
      return 'Ilegible';
    case 'duplicado':
      return 'Duplicado';
    case 'omitido':
      return 'Omitido';
    case 'baja_confianza':
      return 'Baja confianza';
    case 'estructura_estimada':
      return 'Columnas estimadas';
    case 'excluido':
      return 'Excluido';
    default:
      return flag;
  }
}
