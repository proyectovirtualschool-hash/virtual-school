import { AbsenceType, Course, Student, Subject } from '../../types';

export type DigitizerStatus = 'presente' | AbsenceType | 'sin_definir';

export type DigitizerFlag =
  | 'cotejado'
  | 'conflicto'
  | 'no_inscrito'
  | 'ilegible'
  | 'duplicado'
  | 'omitido'
  | 'baja_confianza'
  | 'estructura_estimada'
  | 'excluido';

export interface DigitizerCandidate {
  studentId: string;
  name: string;
  document: string;
  courseId: string;
  score: number;
}

export interface DigitizerBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DigitizerRow {
  id: string;
  sheetRow: number;
  studentName: string;
  document?: string;
  status: DigitizerStatus;
  markDetected?: string;
  confidence: number;
  candidates: DigitizerCandidate[];
  matchedStudentId?: string;
  flags: DigitizerFlag[];
  observation?: string;
  hours: number;
  excluded?: boolean;
  rosterOnly?: boolean;
  boundingBox?: DigitizerBoundingBox;
  nameEngine?: 'trocr' | 'tesseract' | 'manual' | 'roster';
}

export interface DigitizerHeader {
  date: string;
  courseId: string;
  subjectId: string;
  hours: number;
  teacher: string;
  title: string;
  notes: string;
  confidence: number;
  rawText: string;
}

export interface DigitizerMetrics {
  totalRows: number;
  matched: number;
  pending: number;
  omitted: number;
  duplicates: number;
  unregistered: number;
  illegible: number;
  present: number;
  absences: number;
  tardies: number;
  justified: number;
}

export interface DigitizerResult {
  id: string;
  fileName: string;
  pageNumber: number;
  pageCount: number;
  createdAt: string;
  originalImage: string;
  enhancedImage: string;
  thumbnail: string;
  engine: string;
  header: DigitizerHeader;
  rows: DigitizerRow[];
  metrics: DigitizerMetrics;
  warnings: string[];
}

export interface DigitizerProgress {
  step: 'preparing' | 'enhancing' | 'reading-header' | 'detecting-rows' | 'reading-names' | 'reading-marks' | 'reconciling' | 'done';
  message: string;
  current?: number;
  total?: number;
}

export interface DigitizerCatalog {
  students: Student[];
  courses: Course[];
  subjects: Subject[];
}

export interface DigitizerOptions {
  catalog: DigitizerCatalog;
  courseId: string;
  subjectId: string;
  date: string;
  hours: number;
  useTrocr: boolean;
  onProgress?: (progress: DigitizerProgress) => void;
}

export interface DigitizationSnapshotRow {
  studentId?: string;
  studentName: string;
  document?: string;
  status: DigitizerStatus;
  hours: number;
  reason?: string;
  flags: DigitizerFlag[];
}

export interface DigitizationHistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  pageNumber: number;
  pageCount: number;
  courseId: string;
  courseName: string;
  subjectId: string;
  subjectName: string;
  periodId: string;
  date: string;
  hours: number;
  teacher: string;
  engine: string;
  status: 'confirmada' | 'cancelada';
  metrics: DigitizerMetrics;
  rows: DigitizationSnapshotRow[];
  thumbnail: string;
  warnings: string[];
}

export interface DigitizedSaveResult {
  inserted: number;
  skipped: number;
  conflicts: number;
  insertedIds: string[];
  skippedRows: { studentId: string; reason: string }[];
}
