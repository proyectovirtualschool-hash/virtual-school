import { storage } from '../storage';
import { calculateMetrics } from './reconcile';
import {
  DigitizationHistoryEntry,
  DigitizationSnapshotRow,
  DigitizedSaveResult,
  DigitizerResult,
} from './types';

export interface PersistDigitizationOptions {
  periodId: string;
  registeredBy?: string;
  status?: 'confirmada' | 'cancelada';
}

export interface PersistDigitizationResult {
  entry: DigitizationHistoryEntry;
  saveResult: DigitizedSaveResult;
}

export function persistDigitizedResult(
  result: DigitizerResult,
  options: PersistDigitizationOptions
): PersistDigitizationResult {
  const activeRows = result.rows.filter((row) => !row.excluded);
  const invalid = activeRows.filter((row) => !row.matchedStudentId || row.status === 'sin_definir');
  if (invalid.length > 0) {
    throw new Error(
      `No se puede guardar: ${invalid.length} fila(s) sin cotejar o sin estado definido.`
    );
  }

  const saveResult = storage.saveDigitizedAttendance({
    periodId: options.periodId,
    date: result.header.date,
    courseId: result.header.courseId,
    subjectId: result.header.subjectId,
    registeredBy: options.registeredBy || result.header.teacher || 'Digitalizador automático',
    rows: activeRows.map((row) => ({
      studentId: row.matchedStudentId,
      status: row.status,
      hours: row.hours,
      reason: row.observation?.trim() || undefined,
    })),
  });

  const snapshot: DigitizationSnapshotRow[] = activeRows.map((row) => ({
    studentId: row.matchedStudentId,
    studentName: row.studentName,
    document: row.document,
    status: row.status,
    hours: row.hours,
    reason: row.observation?.trim() || undefined,
    flags: row.flags,
  }));

  const courses = storage.getCourses();
  const subjects = storage.getSubjects();
  const entry: DigitizationHistoryEntry = {
    id: result.id,
    createdAt: new Date().toISOString(),
    fileName: result.fileName,
    pageNumber: result.pageNumber,
    pageCount: result.pageCount,
    courseId: result.header.courseId,
    courseName: courses.find((course) => course.id === result.header.courseId)?.name || 'Curso',
    subjectId: result.header.subjectId,
    subjectName: subjects.find((subject) => subject.id === result.header.subjectId)?.name || 'Materia',
    periodId: options.periodId,
    date: result.header.date,
    hours: result.header.hours,
    teacher: result.header.teacher,
    engine: result.engine,
    status: options.status || 'confirmada',
    metrics: calculateMetrics(result.rows),
    rows: snapshot,
    thumbnail: result.thumbnail,
    warnings: result.warnings,
  };
  storage.saveDigitization(entry);

  return { entry, saveResult };
}
