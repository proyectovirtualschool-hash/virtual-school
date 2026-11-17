import { AcademicPeriod, Course, Subject, Student, AbsenceRecord, InstitutionConfig, AdminUser, StudentAbsenceSummary } from '../types';
import {
  DigitizationHistoryEntry,
  DigitizedSaveResult,
  DigitizerStatus,
} from './digitizer/types';

const STORAGE_KEYS = {
  PERIODS: 'scf_periods_v1',
  COURSES: 'scf_courses_v1',
  SUBJECTS: 'scf_subjects_v1',
  STUDENTS: 'scf_students_v1',
  ABSENCES: 'scf_absences_v1',
  CONFIG: 'scf_config_v1',
  ADMIN_USER: 'scf_admin_user_v1',
  AUTH_SESSION: 'scf_auth_session_v1',
  STUDENT_SESSION: 'scf_student_session_v1',
  DIGITIZATIONS: 'scf_digitizations_v1',
};

// Legacy hash simulation for backward compatibility
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `scf_hash_${Math.abs(hash)}_${password.length * 37}`;
}

// Secure hash using SHA-256 (Web Crypto API)
async function hashPasswordSecureAsync(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password || '');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `scf_sha256_${hashHex}`;
  } catch {
    // Fallback if crypto.subtle not available
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `scf_sha256_fb_${Math.abs(hash)}_${password.length * 37}`;
  }
}

export function hashPasswordSecure(password: string): string {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password || '');
    // Use sync approach via subtle in browser is async, but we need sync for compatibility
    // Fallback to a deterministic sync SHA-256-like hash
    let h1 = 0x6a09e667, h2 = 0xbb67ae85, h3 = 0x3c6ef372, h4 = 0xa54ff53a;
    for (let i = 0; i < password.length; i++) {
      const c = password.charCodeAt(i);
      h1 = ((h1 << 5) - h1 + c) >>> 0;
      h2 = ((h2 << 7) - h2 + c * 131542391) >>> 0;
      h3 = ((h3 << 11) - h3 + c * 1009) >>> 0;
      h4 = ((h4 << 13) - h4 + c * 9176) >>> 0;
    }
    const hex = ((h1.toString(16) + h2.toString(16) + h3.toString(16) + h4.toString(16))).padEnd(64, '0');
    return `scf_sha256_${hex.substring(0, 64)}`;
  } catch {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `scf_sha256_fb_${Math.abs(hash)}_${password.length * 37}`;
  }
}

const DEFAULT_CONFIG: InstitutionConfig = {
  name: 'Colegio San Pedro Claver',
  nit: '890.123.456-7',
  address: 'Calle 45 # 18-32, Sede Central',
  phone: '(601) 345-6789',
  academicYear: 2026,
  alertThresholdPercent: 50,
};

const DEFAULT_PERIODS: AcademicPeriod[] = [
  {
    id: 'per-2026-1',
    name: 'Periodo 1 - 2026',
    year: 2026,
    startDate: '2026-01-20',
    endDate: '2026-04-10',
    isActive: true,
  },
  {
    id: 'per-2026-2',
    name: 'Periodo 2 - 2026',
    year: 2026,
    startDate: '2026-04-13',
    endDate: '2026-06-26',
    isActive: false,
  },
  {
    id: 'per-2026-3',
    name: 'Periodo 3 - 2026',
    year: 2026,
    startDate: '2026-07-13',
    endDate: '2026-09-25',
    isActive: false,
  },
  {
    id: 'per-2026-4',
    name: 'Periodo 4 - 2026',
    year: 2026,
    startDate: '2026-09-28',
    endDate: '2026-11-27',
    isActive: false,
  },
];

const DEFAULT_COURSES: Course[] = [
  {
    id: 'c-10a',
    name: 'Grado 10°A',
    code: '10-A',
    level: 'Educación Media',
    directorName: 'Prof. Carlos Mendoza',
    description: 'Jornada Mañana - Salón 204',
  },
  {
    id: 'c-11b',
    name: 'Grado 11°B',
    code: '11-B',
    level: 'Educación Media',
    directorName: 'Prof. Martha Ospina',
    description: 'Jornada Mañana - Salón 301',
  },
  {
    id: 'c-9a',
    name: 'Grado 9°A',
    code: '9-A',
    level: 'Básica Secundaria',
    directorName: 'Prof. Roberto Gómez',
    description: 'Jornada Tarde - Salón 105',
  },
];

const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'sub-ing',
    name: 'Inglés Extranjero',
    code: 'ING-10',
    courseIds: ['c-10a', 'c-11b', 'c-9a'],
    maxAbsences: 20, // Máximo 20 fallas permitidas
    weeklyHours: 4,
  },
  {
    id: 'sub-mat',
    name: 'Matemáticas y Álgebra',
    code: 'MAT-10',
    courseIds: ['c-10a', 'c-11b', 'c-9a'],
    maxAbsences: 24,
    weeklyHours: 5,
  },
  {
    id: 'sub-leng',
    name: 'Lengua Castellana',
    code: 'LEN-10',
    courseIds: ['c-10a', 'c-11b', 'c-9a'],
    maxAbsences: 20,
    weeklyHours: 4,
  },
  {
    id: 'sub-cien',
    name: 'Ciencias Naturales / Física',
    code: 'FIS-10',
    courseIds: ['c-10a', 'c-11b'],
    maxAbsences: 16,
    weeklyHours: 3,
  },
  {
    id: 'sub-soc',
    name: 'Ciencias Sociales e Historia',
    code: 'SOC-10',
    courseIds: ['c-10a', 'c-11b', 'c-9a'],
    maxAbsences: 16,
    weeklyHours: 3,
  },
  {
    id: 'sub-edufis',
    name: 'Educación Física',
    code: 'EFI-10',
    courseIds: ['c-10a', 'c-11b', 'c-9a'],
    maxAbsences: 10,
    weeklyHours: 2,
  },
];

const DEFAULT_STUDENTS: Student[] = [
  {
    id: 'est-1',
    name: 'ESTUDIANTE 001',
    document: '0000000001',
    documentType: 'TI',
    courseId: 'c-10a',
    status: 'activo',
  },
  {
    id: 'est-2',
    name: 'ESTUDIANTE 002',
    document: '0000000002',
    documentType: 'TI',
    courseId: 'c-10a',
    status: 'activo',
  },
  {
    id: 'est-3',
    name: 'ESTUDIANTE 003',
    document: '0000000003',
    documentType: 'TI',
    courseId: 'c-10a',
    status: 'activo',
  },
  {
    id: 'est-4',
    name: 'ESTUDIANTE 004',
    document: '0000000004',
    documentType: 'TI',
    courseId: 'c-10a',
    status: 'activo',
  },
  {
    id: 'est-5',
    name: 'ESTUDIANTE 005',
    document: '0000000005',
    documentType: 'TI',
    courseId: 'c-10a',
    status: 'activo',
  },
  {
    id: 'est-6',
    name: 'ESTUDIANTE 006',
    document: '0000000006',
    documentType: 'TI',
    courseId: 'c-11b',
    status: 'activo',
  },
  {
    id: 'est-7',
    name: 'ESTUDIANTE 007',
    document: '0000000007',
    documentType: 'TI',
    courseId: 'c-11b',
    status: 'activo',
  },
  {
    id: 'est-8',
    name: 'ESTUDIANTE 008',
    document: '0000000008',
    documentType: 'TI',
    courseId: 'c-9a',
    status: 'activo',
  },
];

  // Seed absence records for testing (anonymized)
  const DEFAULT_ABSENCES: AbsenceRecord[] = [
    { id: 'abs-1', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-02-02', type: 'falla', hours: 2, createdAt: '2026-02-02T10:00:00Z' },
    { id: 'abs-2', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-02-09', type: 'falla', hours: 2, createdAt: '2026-02-09T10:00:00Z' },
    { id: 'abs-3', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-02-16', type: 'falla', hours: 2, createdAt: '2026-02-16T10:00:00Z' },
    { id: 'abs-4', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-02-23', type: 'falla', hours: 2, createdAt: '2026-02-23T10:00:00Z' },
    { id: 'abs-5', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-03-02', type: 'falla', hours: 2, createdAt: '2026-03-02T10:00:00Z' },
    { id: 'abs-6', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-03-09', type: 'falla', hours: 2, createdAt: '2026-03-09T10:00:00Z' },
    { id: 'abs-7', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-ing', periodId: 'per-2026-1', date: '2026-03-16', type: 'falla', hours: 2, createdAt: '2026-03-16T10:00:00Z' },
    { id: 'abs-8', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-mat', periodId: 'per-2026-1', date: '2026-02-10', type: 'justificada', hours: 2, reason: 'Justificación médica', createdAt: '2026-02-10T10:00:00Z' },
    { id: 'abs-9', studentId: 'est-1', courseId: 'c-10a', subjectId: 'sub-leng', periodId: 'per-2026-1', date: '2026-03-04', type: 'retardo', hours: 1, reason: 'Retardo', createdAt: '2026-03-04T10:00:00Z' },
    { id: 'abs-10', studentId: 'est-2', courseId: 'c-10a', subjectId: 'sub-mat', periodId: 'per-2026-1', date: '2026-02-11', type: 'falla', hours: 2, createdAt: '2026-02-11T10:00:00Z' },
    { id: 'abs-11', studentId: 'est-2', courseId: 'c-10a', subjectId: 'sub-mat', periodId: 'per-2026-1', date: '2026-03-03', type: 'falla', hours: 1, createdAt: '2026-03-03T10:00:00Z' },
    { id: 'abs-12', studentId: 'est-4', courseId: 'c-10a', subjectId: 'sub-cien', periodId: 'per-2026-1', date: '2026-02-05', type: 'falla', hours: 2, createdAt: '2026-02-05T10:00:00Z' },
    { id: 'abs-13', studentId: 'est-4', courseId: 'c-10a', subjectId: 'sub-cien', periodId: 'per-2026-1', date: '2026-02-12', type: 'falla', hours: 2, createdAt: '2026-02-12T10:00:00Z' },
    { id: 'abs-14', studentId: 'est-4', courseId: 'c-10a', subjectId: 'sub-cien', periodId: 'per-2026-1', date: '2026-02-19', type: 'falla', hours: 2, createdAt: '2026-02-19T10:00:00Z' },
    { id: 'abs-15', studentId: 'est-4', courseId: 'c-10a', subjectId: 'sub-cien', periodId: 'per-2026-1', date: '2026-02-26', type: 'falla', hours: 2, createdAt: '2026-02-26T10:00:00Z' },
    { id: 'abs-16', studentId: 'est-4', courseId: 'c-10a', subjectId: 'sub-cien', periodId: 'per-2026-1', date: '2026-03-05', type: 'falla', hours: 2, createdAt: '2026-03-05T10:00:00Z' },
  ];

class StorageService {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (!item) return defaultValue;
      return JSON.parse(item);
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  // Initialize data if not existing
  public init(): void {
    if (!localStorage.getItem(STORAGE_KEYS.PERIODS)) {
      this.set(STORAGE_KEYS.PERIODS, DEFAULT_PERIODS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.COURSES)) {
      this.set(STORAGE_KEYS.COURSES, DEFAULT_COURSES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SUBJECTS)) {
      this.set(STORAGE_KEYS.SUBJECTS, DEFAULT_SUBJECTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      this.set(STORAGE_KEYS.STUDENTS, DEFAULT_STUDENTS);
    } else {
      const stored = this.get<Student[]>(STORAGE_KEYS.STUDENTS, []);
      let changed = false;
      const updated = stored.map((st) => {
        if (!st.documentType) {
          changed = true;
          return { ...st, documentType: 'TI' };
        }
        return st;
      });
      if (changed) {
        this.set(STORAGE_KEYS.STUDENTS, updated);
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.ABSENCES)) {
      this.set(STORAGE_KEYS.ABSENCES, DEFAULT_ABSENCES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
      this.set(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USER)) {
      // Default: admin / admin123
      const defaultAdmin: AdminUser = {
        username: 'admin',
        passwordHash: hashPasswordSecure('admin123'),
        name: 'Administrador del Sistema',
      };
      this.set(STORAGE_KEYS.ADMIN_USER, defaultAdmin);
    } else {
      // Ensure document types are normalized
      const students = this.get<Student[]>(STORAGE_KEYS.STUDENTS, []);
      let changed = false;
      const updated = students.map((st) => {
        if (!st.documentType) {
          changed = true;
          return { ...st, documentType: 'TI' };
        }
        return st;
      });
      if (changed) {
        this.set(STORAGE_KEYS.STUDENTS, updated);
      }
    }
  }

  // --- Auth & Admin ---
  public getAdminUser(): AdminUser {
    return this.get<AdminUser>(STORAGE_KEYS.ADMIN_USER, {
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      name: 'Administrador',
    });
  }

  public updateAdminCredentials(newUsername: string, newPassword?: string, newName?: string): boolean {
    const current = this.getAdminUser();
    current.username = newUsername.trim() || current.username;
    if (newName) current.name = newName.trim();
    if (newPassword && newPassword.trim().length > 0) {
      current.passwordHash = hashPasswordSecure(newPassword.trim());
    }
    this.set(STORAGE_KEYS.ADMIN_USER, current);
    return true;
  }

  public verifyAdminLogin(username: string, passwordAttempt: string): boolean {
    const admin = this.getAdminUser();
    if (admin.username.toLowerCase() === username.trim().toLowerCase()) {
      const attempt = passwordAttempt.trim();
      const storedHash = admin.passwordHash || '';
      // Try new secure hash first
      const secureAttempt = hashPasswordSecure(attempt);
      if (storedHash === secureAttempt) {
        return true;
      }
      // Try legacy hash for backward compatibility
      if (storedHash.startsWith('scf_hash_')) {
        if (storedHash === hashPassword(attempt)) {
          // Migrate to secure hash
          try {
            const updatedAdmin: AdminUser = {
              ...admin,
              passwordHash: hashPasswordSecure(attempt),
            };
            this.set(STORAGE_KEYS.ADMIN_USER, updatedAdmin);
          } catch (e) {
            // ignore migration errors
          }
          return true;
        }
      }
      // Also try if stored is legacy format without prefix detection
      if (storedHash === hashPassword(attempt)) {
        try {
          const updatedAdmin: AdminUser = {
            ...admin,
            passwordHash: hashPasswordSecure(attempt),
          };
          this.set(STORAGE_KEYS.ADMIN_USER, updatedAdmin);
        } catch (e) {
          // ignore
        }
        return true;
      }
      return false;
    }
    return false;
  }

  public setAdminSession(isLoggedIn: boolean): void {
    if (isLoggedIn) {
      this.set(STORAGE_KEYS.AUTH_SESSION, {
        authenticated: true,
        loggedAt: new Date().toISOString(),
      });
    } else {
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    }
  }

  public isAdminSessionActive(): boolean {
    const session = this.get<{ authenticated: boolean }>(STORAGE_KEYS.AUTH_SESSION, { authenticated: false });
    return !!session.authenticated;
  }

  // --- Student Session ---
  public setStudentSession(studentId: string): void {
    this.set(STORAGE_KEYS.STUDENT_SESSION, {
      studentId,
      loggedAt: new Date().toISOString(),
    });
  }

  public getStudentSession(): { studentId: string; loggedAt: string } | null {
    const session = this.get<{ studentId: string; loggedAt: string } | null>(STORAGE_KEYS.STUDENT_SESSION, null);
    if (!session || !session.studentId) return null;
    return session;
  }

  public isStudentSessionActive(): boolean {
    return !!this.getStudentSession();
  }

  public clearStudentSession(): void {
    localStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  }

  // --- Config ---
  public getConfig(): InstitutionConfig {
    const config = this.get<InstitutionConfig>(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    if (!config.name || config.name === 'Colegio Integrado San Gabriel') {
      config.name = 'Colegio San Pedro Claver';
      this.set(STORAGE_KEYS.CONFIG, config);
    }
    return config;
  }

  public updateConfig(config: Partial<InstitutionConfig>): InstitutionConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    this.set(STORAGE_KEYS.CONFIG, updated);
    return updated;
  }

  // --- Academic Periods ---
  public getPeriods(): AcademicPeriod[] {
    return this.get<AcademicPeriod[]>(STORAGE_KEYS.PERIODS, DEFAULT_PERIODS);
  }

  public getActivePeriod(): AcademicPeriod {
    const periods = this.getPeriods();
    return periods.find((p) => p.isActive) || periods[0] || DEFAULT_PERIODS[0];
  }

  public setActivePeriod(periodId: string): void {
    const periods = this.getPeriods().map((p) => ({
      ...p,
      isActive: p.id === periodId,
    }));
    this.set(STORAGE_KEYS.PERIODS, periods);
  }

  public addPeriod(period: Omit<AcademicPeriod, 'id'>): AcademicPeriod {
    if (!period.name || !period.name.trim()) {
      throw new Error('El nombre del periodo es obligatorio');
    }
    if (!period.startDate || !period.endDate) {
      throw new Error('Las fechas de inicio y fin son obligatorias');
    }
    if (period.startDate > period.endDate) {
      throw new Error('La fecha de inicio no puede ser mayor a la fecha de fin');
    }

    const periods = this.getPeriods();
    const newPeriod: AcademicPeriod = {
      ...period,
      name: period.name.trim(),
      id: `per-${Date.now()}`,
    };
    if (newPeriod.isActive) {
      periods.forEach((p) => (p.isActive = false));
    }
    periods.push(newPeriod);
    this.set(STORAGE_KEYS.PERIODS, periods);
    return newPeriod;
  }

  public updatePeriod(period: AcademicPeriod): void {
    if (!period.name || !period.name.trim()) {
      throw new Error('El nombre del periodo es obligatorio');
    }
    if (!period.startDate || !period.endDate) {
      throw new Error('Las fechas de inicio y fin son obligatorias');
    }
    if (period.startDate > period.endDate) {
      throw new Error('La fecha de inicio no puede ser mayor a la fecha de fin');
    }

    const periods = this.getPeriods().map((p) => (p.id === period.id ? { ...period, name: period.name.trim() } : period.isActive ? { ...p, isActive: false } : p));
    // If updating to active, ensure others are inactive
    if (period.isActive) {
      const updated = this.getPeriods().map((p) => ({ ...p, isActive: p.id === period.id }));
      this.set(STORAGE_KEYS.PERIODS, updated);
      return;
    }
    this.set(STORAGE_KEYS.PERIODS, periods.map((p) => (p.id === period.id ? { ...period, name: period.name.trim() } : p)));
  }

  // --- Courses ---
  public getCourses(): Course[] {
    return this.get<Course[]>(STORAGE_KEYS.COURSES, DEFAULT_COURSES);
  }

  public saveCourse(course: Omit<Course, 'id'> & { id?: string }): Course {
    if (!course.name || !course.name.trim()) {
      throw new Error('El nombre del curso es obligatorio');
    }
    if (!course.code || !course.code.trim()) {
      throw new Error('El código del curso es obligatorio');
    }

    const courses = this.getCourses();
    const codeNorm = course.code.trim().toLowerCase();
    // Check duplicates
    const duplicate = courses.find((c) => c.code && c.code.trim().toLowerCase() === codeNorm && c.id !== course.id);
    if (duplicate) {
      throw new Error('Ya existe un curso con ese código');
    }

    if (course.id) {
      const idx = courses.findIndex((c) => c.id === course.id);
      if (idx >= 0) {
        courses[idx] = { ...(course as Course), name: course.name.trim(), code: course.code.trim() };
        this.set(STORAGE_KEYS.COURSES, courses);
        return courses[idx];
      }
    }
    const newCourse: Course = {
      ...course,
      name: course.name.trim(),
      code: course.code.trim(),
      id: `c-${Date.now()}`,
    };
    courses.push(newCourse);
    this.set(STORAGE_KEYS.COURSES, courses);
    return newCourse;
  }

  public deleteCourse(id: string, opts?: { force?: boolean, reassignToCourseId?: string }): { ok: boolean, reason?: string, affectedStudents?: number } {
    const students = this.getStudents();
    const activeInCourse = students.filter((st) => st.courseId === id && st.status === 'activo');

    if (activeInCourse.length > 0) {
      if (opts?.reassignToCourseId && opts.reassignToCourseId !== id) {
        // Reassign active students
        const updatedStudents = students.map((st) => {
          if (st.courseId === id && st.status === 'activo') {
            return { ...st, courseId: opts.reassignToCourseId as string };
          }
          return st;
        });
        this.set(STORAGE_KEYS.STUDENTS, updatedStudents);
      } else if (opts?.force) {
        // Mark active students as inactive (keep courseId for traceability)
        const updatedStudents = students.map((st) => {
          if (st.courseId === id && st.status === 'activo') {
            return { ...st, status: 'inactivo' as const };
          }
          return st;
        });
        this.set(STORAGE_KEYS.STUDENTS, updatedStudents);
      } else {
        return { ok: false, reason: 'has_active_students', affectedStudents: activeInCourse.length };
      }
    }

    const courses = this.getCourses().filter((c) => c.id !== id);
    this.set(STORAGE_KEYS.COURSES, courses);

    // Unlink this course from any subjects
    const subjects = this.getSubjects().map((s) => ({
      ...s,
      courseIds: (s.courseIds || []).filter((cId) => cId !== id),
    }));
    this.set(STORAGE_KEYS.SUBJECTS, subjects);

    return { ok: true, affectedStudents: activeInCourse.length };
  }

  // --- Subjects ---
  public getSubjects(): Subject[] {
    return this.get<Subject[]>(STORAGE_KEYS.SUBJECTS, DEFAULT_SUBJECTS);
  }

  public getSubjectsByCourse(courseId: string): Subject[] {
    return this.getSubjects().filter((s) => s.courseIds.includes(courseId));
  }

  public saveSubject(subject: Omit<Subject, 'id'> & { id?: string }): Subject {
    if (!subject.name || !subject.name.trim()) {
      throw new Error('El nombre de la materia es obligatorio');
    }
    if (!subject.code || !subject.code.trim()) {
      throw new Error('El código de la materia es obligatorio');
    }
    if (!subject.courseIds || !Array.isArray(subject.courseIds) || subject.courseIds.length === 0) {
      throw new Error('Debe asignar al menos un curso a la materia');
    }
    if (typeof subject.maxAbsences === 'number' && subject.maxAbsences < 0) {
      throw new Error('El máximo de fallas no puede ser negativo');
    }
    if (typeof subject.weeklyHours === 'number' && subject.weeklyHours < 0) {
      throw new Error('Las horas semanales no pueden ser negativas');
    }

    const subjects = this.getSubjects();
    if (subject.id) {
      const idx = subjects.findIndex((s) => s.id === subject.id);
      if (idx >= 0) {
        subjects[idx] = { ...(subject as Subject), name: subject.name.trim(), code: subject.code.trim() };
        this.set(STORAGE_KEYS.SUBJECTS, subjects);
        return subjects[idx];
      }
    }
    const newSubject: Subject = {
      ...subject,
      name: subject.name.trim(),
      code: subject.code.trim(),
      id: `sub-${Date.now()}`,
    };
    subjects.push(newSubject);
    this.set(STORAGE_KEYS.SUBJECTS, subjects);
    return newSubject;
  }

  public deleteSubject(id: string): boolean {
    const subjects = this.getSubjects().filter((s) => s.id !== id);
    this.set(STORAGE_KEYS.SUBJECTS, subjects);
    return true;
  }

  private ensureDocumentType(st: Student): Student {
    if (!st.documentType) {
      return { ...st, documentType: 'TI' };
    }
    return st;
  }

  // --- Students ---
  public getStudents(): Student[] {
    const students = this.get<Student[]>(STORAGE_KEYS.STUDENTS, DEFAULT_STUDENTS);
    let changed = false;
    const normalized = students.map((st) => {
      if (!st.documentType) {
        changed = true;
        return { ...st, documentType: 'TI' };
      }
      return st;
    });
    if (changed) {
      try {
        this.set(STORAGE_KEYS.STUDENTS, normalized);
      } catch {
        // ignore
      }
    }
    return normalized;
  }

  public getStudentsByCourse(courseId: string): Student[] {
    return this.getStudents().filter((s) => s.courseId === courseId && s.status === 'activo');
  }

  public saveStudent(student: Omit<Student, 'id'> & { id?: string }): Student {
    // Basic validations
    if (!student.name || !student.name.trim()) {
      throw new Error('El nombre del estudiante es obligatorio');
    }
    if (!student.document || !student.document.trim()) {
      throw new Error('El documento del estudiante es obligatorio');
    }
    if (!student.courseId || !student.courseId.trim()) {
      throw new Error('Debe seleccionar un curso para el estudiante');
    }
    if (student.status && student.status !== 'activo' && student.status !== 'inactivo') {
      throw new Error('Estado del estudiante inválido');
    }

    const students = this.getStudents();
    const docType = student.documentType || 'TI';
    const normalizedStudent = {
      ...student,
      name: student.name.trim(),
      document: student.document.trim(),
      guardianName: student.guardianName?.trim(),
      guardianPhone: student.guardianPhone?.trim(),
      email: student.email?.trim(),
      documentType: docType,
    };

    if (student.id) {
      const idx = students.findIndex((s) => s.id === student.id);
      if (idx >= 0) {
        students[idx] = { ...students[idx], ...(normalizedStudent as Student), documentType: docType };
        this.set(STORAGE_KEYS.STUDENTS, students);
        return students[idx];
      }
    }
    const newStudent: Student = {
      ...(normalizedStudent as Student),
      documentType: docType,
      id: `est-${Date.now()}`,
      status: normalizedStudent.status || 'activo',
    };
    students.push(newStudent);
    this.set(STORAGE_KEYS.STUDENTS, students);
    return newStudent;
  }

  public deleteStudent(id: string): boolean {
    const students = this.getStudents().filter((s) => s.id !== id);
    this.set(STORAGE_KEYS.STUDENTS, students);
    return true;
  }

  // Helper to normalize strings for accent-insensitive and case-insensitive comparison
  public normalizeText(text: string): string {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Clean document number (remove dots, hyphens, spaces)
  public cleanDoc(doc: string): string {
    return (doc || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
  }

  // Search students (Community portal or Admin)
  public searchStudents(query: string, courseId?: string, documentType?: string): Student[] {
    const rawQ = (query || '').trim();
    let list = this.getStudents();

    if (courseId && courseId !== 'all') {
      list = list.filter((s) => s.courseId === courseId);
    }

    if (documentType && documentType !== 'all') {
      list = list.filter((s) => (s.documentType || 'TI').toUpperCase() === documentType.toUpperCase());
    }

    if (!rawQ) {
      return list;
    }

    const normQ = this.normalizeText(rawQ);
    const cleanDocQ = this.cleanDoc(rawQ);

    return list.filter((s) => {
      const normName = this.normalizeText(s.name);
      const cleanDocS = this.cleanDoc(s.document);
      const normEmail = this.normalizeText(s.email || '');

      // Check document match (exact or substring, with or without dots/hyphens)
      const docMatch = cleanDocQ.length > 0 && cleanDocS.includes(cleanDocQ);
      // Check name match (accent-insensitive)
      const nameMatch = normName.includes(normQ);
      // Check email match
      const emailMatch = normEmail.includes(normQ);

      return docMatch || nameMatch || emailMatch;
    });
  }

  // Specialized finder by Student Name and Document Type (+ optional document number or course)
  public findStudentsByNameAndDocType(
    nameQuery: string,
    documentType?: string,
    documentNumber?: string,
    courseId?: string
  ): Student[] {
    let list = this.getStudents();

    if (courseId && courseId !== 'all') {
      list = list.filter((s) => s.courseId === courseId);
    }

    if (documentType && documentType !== 'all') {
      list = list.filter((s) => (s.documentType || 'TI').toUpperCase() === documentType.toUpperCase());
    }

    if (documentNumber && documentNumber.trim().length > 0) {
      const cleanTargetDoc = this.cleanDoc(documentNumber);
      list = list.filter((s) => this.cleanDoc(s.document).includes(cleanTargetDoc));
    }

    const cleanNameQ = (nameQuery || '').trim();
    if (!cleanNameQ) {
      return list;
    }

    const normTarget = this.normalizeText(cleanNameQ);
    const tokens = normTarget.split(/\s+/).filter(Boolean);

    return list.filter((s) => {
      const normStudentName = this.normalizeText(s.name);
      if (normStudentName.includes(normTarget)) return true;
      if (tokens.length > 0 && tokens.every((token) => normStudentName.includes(token))) return true;
      return false;
    });
  }

  // --- Absence Records ---
  public getAbsenceRecords(periodId?: string): AbsenceRecord[] {
    const all = this.get<AbsenceRecord[]>(STORAGE_KEYS.ABSENCES, DEFAULT_ABSENCES);
    if (periodId) {
      return all.filter((r) => r.periodId === periodId);
    }
    return all;
  }

  public addAbsenceRecord(record: Omit<AbsenceRecord, 'id' | 'createdAt'>): AbsenceRecord {
    const all = this.getAbsenceRecords();
    const newRecord: AbsenceRecord = {
      ...record,
      id: `abs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    all.push(newRecord);
    this.set(STORAGE_KEYS.ABSENCES, all);
    return newRecord;
  }

  public batchSaveAbsenceRecords(records: Omit<AbsenceRecord, 'id' | 'createdAt'>[]): void {
    const all = this.getAbsenceRecords();
    const newRecords = records.map((r, i) => ({
      ...r,
      id: `abs-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    }));
    this.set(STORAGE_KEYS.ABSENCES, [...all, ...newRecords]);
  }

  public saveDigitizedAttendance(params: {
    periodId: string;
    date: string;
    courseId: string;
    subjectId: string;
    registeredBy: string;
    rows: { studentId?: string; status: DigitizerStatus; hours: number; reason?: string }[];
  }): DigitizedSaveResult {
    const all = this.getAbsenceRecords();
    const byKey = new Map<string, AbsenceRecord>();
    all.forEach((record) => {
      byKey.set(
        `${record.studentId}|${record.courseId}|${record.subjectId}|${record.periodId}|${record.date}|${record.type}`,
        record
      );
    });

    const result: DigitizedSaveResult = {
      inserted: 0,
      skipped: 0,
      conflicts: 0,
      insertedIds: [],
      skippedRows: [],
    };
    const newRecords: AbsenceRecord[] = [];

    params.rows.forEach((row, index) => {
      if (!row.studentId) return;
      if (row.status === 'presente' || row.status === 'sin_definir') return;
      const hours = Math.max(1, Math.round(row.hours || 1));
      const key = `${row.studentId}|${params.courseId}|${params.subjectId}|${params.periodId}|${params.date}|${row.status}`;
      const existing = byKey.get(key);
      if (existing) {
        result.skipped++;
        if (existing.hours !== hours) result.conflicts++;
        result.skippedRows.push({
          studentId: row.studentId,
          reason:
            existing.hours !== hours
              ? `Ya existe un registro de ${row.status} con ${existing.hours} hora(s) para esta fecha.`
              : `Ya existe un registro idéntico de ${row.status} para esta fecha.`,
        });
        return;
      }
      const record: AbsenceRecord = {
        id: `abs-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: row.studentId,
        courseId: params.courseId,
        subjectId: params.subjectId,
        periodId: params.periodId,
        date: params.date,
        type: row.status,
        hours,
        reason: row.reason?.trim() || undefined,
        registeredBy: params.registeredBy,
        createdAt: new Date().toISOString(),
      };
      byKey.set(key, record);
      newRecords.push(record);
      result.insertedIds.push(record.id);
      result.inserted++;
    });

    if (newRecords.length > 0) {
      this.set(STORAGE_KEYS.ABSENCES, [...all, ...newRecords]);
    }
    return result;
  }

  public getDigitizations(): DigitizationHistoryEntry[] {
    return this.get<DigitizationHistoryEntry[]>(STORAGE_KEYS.DIGITIZATIONS, []).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }

  public saveDigitization(entry: DigitizationHistoryEntry, limit = 50): void {
    const current = this.getDigitizations().filter((item) => item.id !== entry.id);
    this.set(STORAGE_KEYS.DIGITIZATIONS, [entry, ...current].slice(0, limit));
  }

  public deleteDigitization(id: string): void {
    this.set(
      STORAGE_KEYS.DIGITIZATIONS,
      this.getDigitizations().filter((entry) => entry.id !== id)
    );
  }

  public findConfirmedDigitization(
    courseId: string,
    subjectId: string,
    date: string,
    periodId: string
  ): DigitizationHistoryEntry | null {
    return (
      this.getDigitizations().find(
        (entry) =>
          entry.status === 'confirmada' &&
          entry.courseId === courseId &&
          entry.subjectId === subjectId &&
          entry.date === date &&
          entry.periodId === periodId
      ) || null
    );
  }

  public hasStudentDocument(document: string, excludeStudentId?: string): boolean {
    const clean = this.cleanDoc(document);
    if (!clean) return false;
    return this.getStudents().some(
      (student) => student.id !== excludeStudentId && this.cleanDoc(student.document) === clean
    );
  }

  public updateAbsenceRecord(record: AbsenceRecord): void {
    const all = this.getAbsenceRecords().map((r) => (r.id === record.id ? record : r));
    this.set(STORAGE_KEYS.ABSENCES, all);
  }

  public deleteAbsenceRecord(id: string): void {
    const all = this.getAbsenceRecords().filter((r) => r.id !== id);
    this.set(STORAGE_KEYS.ABSENCES, all);
  }

  // --- Consolidation and Summaries ---
  public getStudentSummary(studentId: string, periodId?: string): StudentAbsenceSummary | null {
    const student = this.getStudents().find((s) => s.id === studentId);
    if (!student) return null;

    const course = this.getCourses().find((c) => c.id === student.courseId);
    const subjects = student.courseId ? this.getSubjects().filter((s) => s.courseIds && s.courseIds.includes(student.courseId)) : [];
    const activePeriod = periodId ? { id: periodId } : this.getActivePeriod();

    const records = this.getAbsenceRecords().filter(
      (r) => r.studentId === studentId && (!activePeriod.id || r.periodId === activePeriod.id)
    );

    let totalGeneral = 0;
    let hasAnyAlert = false;
    const config = this.getConfig();
    const threshold = config.alertThresholdPercent || 50;

    const subjectSummaries = subjects.map((sub) => {
      const subRecords = records.filter((r) => r.subjectId === sub.id);
      
      // Sum unjustified absences (hours missed)
      const unjustifiedAbsences = subRecords
        .filter((r) => r.type === 'falla')
        .reduce((sum, r) => sum + (r.hours || 1), 0);

      const justifiedCount = subRecords
        .filter((r) => r.type === 'justificada')
        .reduce((sum, r) => sum + (r.hours || 1), 0);

      const tardiesCount = subRecords.filter((r) => r.type === 'retardo').length;

      totalGeneral += unjustifiedAbsences;

      const maxAllowed = sub.maxAbsences || 20;
      const percentUsed = Math.round((unjustifiedAbsences / maxAllowed) * 100);
      const isOverThreshold = percentUsed >= threshold;
      const isFailed = percentUsed >= 100;

      if (isOverThreshold) {
        hasAnyAlert = true;
      }

      return {
        subject: sub,
        totalAbsences: unjustifiedAbsences,
        justifiedCount,
        tardiesCount,
        maxAllowed,
        percentUsed,
        isOverThreshold,
        isFailed,
      };
    });

    return {
      student,
      course,
      subjectSummaries,
      totalGeneralAbsences: totalGeneral,
      hasAnyAlert,
      records,
    };
  }

  // Backup export / import
  public exportCompleteBackup(): string {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      periods: this.getPeriods(),
      courses: this.getCourses(),
      subjects: this.getSubjects(),
      students: this.getStudents(),
      absences: this.getAbsenceRecords(),
      config: this.getConfig(),
      digitizations: this.getDigitizations(),
    };
    return JSON.stringify(data, null, 2);
  }

  public importCompleteBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.periods) this.set(STORAGE_KEYS.PERIODS, data.periods);
      if (data.courses) this.set(STORAGE_KEYS.COURSES, data.courses);
      if (data.subjects) this.set(STORAGE_KEYS.SUBJECTS, data.subjects);
      if (data.students) this.set(STORAGE_KEYS.STUDENTS, data.students);
      if (data.absences) this.set(STORAGE_KEYS.ABSENCES, data.absences);
      if (data.config) this.set(STORAGE_KEYS.CONFIG, data.config);
      if (data.digitizations) this.set(STORAGE_KEYS.DIGITIZATIONS, data.digitizations);
      return true;
    } catch (e) {
      console.error('Error importing backup:', e);
      return false;
    }
  }

  public resetToFactoryDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.PERIODS);
    localStorage.removeItem(STORAGE_KEYS.COURSES);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.ABSENCES);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
    localStorage.removeItem(STORAGE_KEYS.DIGITIZATIONS);
    this.init();
  }

  public clearAllDataCompletely(): void {
    this.set(STORAGE_KEYS.PERIODS, []);
    this.set(STORAGE_KEYS.COURSES, []);
    this.set(STORAGE_KEYS.SUBJECTS, []);
    this.set(STORAGE_KEYS.STUDENTS, []);
    this.set(STORAGE_KEYS.ABSENCES, []);
    this.set(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    this.set(STORAGE_KEYS.DIGITIZATIONS, []);
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    localStorage.removeItem(STORAGE_KEYS.STUDENT_SESSION);
  }
}

export const storage = new StorageService();
storage.init();
