export type AbsenceType = 'falla' | 'justificada' | 'retardo';

export interface AcademicPeriod {
  id: string;
  name: string; // e.g. "Periodo 1 - 2026"
  year: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface Course {
  id: string;
  name: string; // e.g. "Grado 10°A"
  code: string; // e.g. "10A"
  level: string; // Secundaria, Media, Primaria
  directorName?: string;
  description?: string;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Inglés", "Matemáticas"
  code: string;
  courseIds: string[]; // Associated courses
  maxAbsences: number; // Max allowed absences in the period, e.g. 20
  weeklyHours: number;
}

export type DocumentType = 'TI' | 'CC' | 'RC' | 'CE' | 'PEP' | 'Otro';

export const DOCUMENT_TYPES: { code: DocumentType; label: string; name: string }[] = [
  { code: 'TI', label: 'T.I. - Tarjeta de Identidad', name: 'Tarjeta de Identidad (T.I.)' },
  { code: 'CC', label: 'C.C. - Cédula de Ciudadanía', name: 'Cédula de Ciudadanía (C.C.)' },
  { code: 'RC', label: 'R.C. - Registro Civil', name: 'Registro Civil (R.C.)' },
  { code: 'CE', label: 'C.E. - Cédula de Extranjería', name: 'Cédula de Extranjería (C.E.)' },
  { code: 'PEP', label: 'PEP - Permiso Especial', name: 'Permiso Especial (PEP/PPT)' },
  { code: 'Otro', label: 'Otro Documento', name: 'Otro Documento' },
];

export interface Student {
  id: string;
  name: string;
  document: string; // Número de documento
  documentType?: DocumentType | string; // TI, CC, RC, CE, PEP, etc.
  courseId: string;
  guardianName?: string;
  guardianPhone?: string;
  email?: string;
  status: 'activo' | 'inactivo';
  photoUrl?: string;
}

export interface AbsenceRecord {
  id: string;
  studentId: string;
  courseId: string;
  subjectId: string;
  periodId: string;
  date: string; // YYYY-MM-DD
  type: AbsenceType; // 'falla' (injustificada), 'justificada', 'retardo'
  hours: number; // Number of hours missed (usually 1 or 2)
  reason?: string; // Reason or justification
  registeredBy?: string;
  createdAt: string;
}

export interface InstitutionConfig {
  name: string;
  nit: string;
  address: string;
  phone: string;
  academicYear: number;
  alertThresholdPercent: number; // default 50%
}

export interface AdminUser {
  username: string;
  passwordHash: string;
  name: string;
  lastLogin?: string;
}

export interface StudentAbsenceSummary {
  student: Student;
  course: Course | undefined;
  subjectSummaries: {
    subject: Subject;
    totalAbsences: number; // Unjustified absences count
    justifiedCount: number;
    tardiesCount: number;
    maxAllowed: number;
    percentUsed: number;
    isOverThreshold: boolean; // > 50%
    isFailed: boolean; // >= 100%
  }[];
  totalGeneralAbsences: number;
  hasAnyAlert: boolean;
  records: AbsenceRecord[];
}
