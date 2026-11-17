import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles, 
  Save, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { Course, Subject, Student, AcademicPeriod, AbsenceType } from '../types';
import { storage } from '../services/storage';
import { ScanModal, ScanApplyPayload } from './ScanModal';

interface FastAttendanceRegisterProps {
  activePeriod: AcademicPeriod;
  onDataChanged: () => void;
}

interface StudentAttendanceRow {
  student: Student;
  status: 'presente' | AbsenceType;
  hours: number;
  reason?: string;
}

export const FastAttendanceRegister: React.FC<FastAttendanceRegisterProps> = ({
  activePeriod,
  onDataChanged,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [hoursPerClass, setHoursPerClass] = useState<number>(2);

  // Student roster state
  const [roster, setRoster] = useState<StudentAttendanceRow[]>([]);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  // Load initial courses
  useEffect(() => {
    const list = storage.getCourses();
    setCourses(list);
    if (list.length > 0 && !selectedCourseId) {
      setSelectedCourseId(list[0].id);
    }
  }, []);

  // When course changes, update available subjects and students
  useEffect(() => {
    if (!selectedCourseId) return;

    const courseSubjects = storage.getSubjectsByCourse(selectedCourseId);
    setSubjects(courseSubjects);
    if (courseSubjects.length > 0) {
      setSelectedSubjectId(courseSubjects[0].id);
    } else {
      setSelectedSubjectId('');
    }

    const courseStudents = storage.getStudentsByCourse(selectedCourseId);
    setRoster(
      courseStudents.map((st) => ({
        student: st,
        status: 'presente',
        hours: hoursPerClass,
        reason: '',
      }))
    );
  }, [selectedCourseId]);

  // When hours per class change, update roster rows
  const handleHoursChange = (h: number) => {
    setHoursPerClass(h);
    setRoster((prev) => prev.map((r) => ({ ...r, hours: h })));
  };

  // Quick Action: Mark all present
  const handleMarkAllPresent = () => {
    setRoster((prev) =>
      prev.map((r) => ({
        ...r,
        status: 'presente',
        reason: '',
      }))
    );
  };

  // Update status for a specific student
  const handleSetStudentStatus = (studentId: string, status: 'presente' | AbsenceType) => {
    setRoster((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, status } : r))
    );
  };

  // Update reason for a specific student
  const handleSetStudentReason = (studentId: string, reason: string) => {
    setRoster((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, reason } : r))
    );
  };

  // Apply full results from AI scan
  const handleApplyScanResults = (payload: ScanApplyPayload) => {
    // 1. Reload courses and subjects in case new ones were created
    const updatedCourses = storage.getCourses();
    setCourses(updatedCourses);

    const targetCourseId = payload.courseId || selectedCourseId || (updatedCourses[0]?.id ?? '');
    setSelectedCourseId(targetCourseId);

    const updatedSubjects = storage.getSubjectsByCourse(targetCourseId);
    setSubjects(updatedSubjects);

    const targetSubjectId = payload.subjectId || selectedSubjectId || (updatedSubjects[0]?.id ?? '');
    setSelectedSubjectId(targetSubjectId);

    // 2. Update Date if detected on sheet
    if (payload.date) {
      setDate(payload.date);
    }

    // 3. Update hours per class if detected on sheet
    if (payload.hours && payload.hours > 0) {
      setHoursPerClass(payload.hours);
    }

    // 4. Reload full student list for the target course (including newly created ones)
    const freshCourseStudents = storage.getStudentsByCourse(targetCourseId);
    const previousStatus = new Map(roster.map((row) => [row.student.id, row]));

    // Build the complete roster with the students and marks that were actually reviewed
    const newRoster: StudentAttendanceRow[] = freshCourseStudents.map((st) => {
      const match = payload.records.find((rec) => rec.studentId === st.id);
      if (match) {
        return {
          student: st,
          status: match.status,
          hours: match.hours || payload.hours || hoursPerClass,
          reason: match.reason !== undefined ? match.reason : '',
        };
      }
      const previous = previousStatus.get(st.id);
      return {
        student: st,
        status: previous?.status || 'presente',
        hours: payload.hours || previous?.hours || hoursPerClass,
        reason: previous?.reason || '',
      };
    });

    setRoster(newRoster);

    // 5. Notify parent of data change so Navbar alerts, Consolidated view, and Reports update
    onDataChanged();

    const fallasCount = payload.records.filter((rec) => rec.status === 'falla').length;
    const retardosCount = payload.records.filter((rec) => rec.status === 'retardo').length;
    const justificadasCount = payload.records.filter((rec) => rec.status === 'justificada').length;
    const presentesCount = payload.records.filter((rec) => rec.status === 'presente').length;
    const courseName = updatedCourses.find((c) => c.id === targetCourseId)?.name || 'Curso';
    const subjectName = updatedSubjects.find((s) => s.id === targetSubjectId)?.name || 'Materia';

    if (payload.alreadyPersisted || payload.autoSavedDirectly) {
      const metrics = payload.metrics;
      const summary = metrics
        ? `${metrics.present} asistencias, ${metrics.absences} fallas, ${metrics.tardies} retardos y ${metrics.justified} justificadas`
        : `${presentesCount} presentes, ${fallasCount} fallas, ${retardosCount} retardos y ${justificadasCount} justificadas`;
      setSavedSuccessMessage(
        `Planilla digitalizada y guardada en el sistema.
• ${payload.records.length} estudiante(s) revisados: ${summary}
• ${subjectName} • ${courseName} • Fecha: ${payload.date || date}
• Si ajustas el estado de algún estudiante, vuelve a guardar: los registros idénticos se omiten automáticamente.`
      );
    } else {
      setSavedSuccessMessage(
        `Planilla digitalizada aplicada al formulario. ${payload.records.length} estudiante(s) revisados en ${courseName}. Revisa los datos y presiona "Guardar Registro de Asistencia".`
      );
    }

    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 8000);
  };

  // Counts
  const counts = useMemo(() => {
    const total = roster.length;
    const presentes = roster.filter((r) => r.status === 'presente').length;
    const fallas = roster.filter((r) => r.status === 'falla').length;
    const justificadas = roster.filter((r) => r.status === 'justificada').length;
    const retardos = roster.filter((r) => r.status === 'retardo').length;
    return { total, presentes, fallas, justificadas, retardos };
  }, [roster]);

  // Save attendance batch
  const handleSaveAttendance = () => {
    if (!selectedCourseId || !selectedSubjectId || !date) {
      alert('Por favor seleccione Curso, Materia y Fecha.');
      return;
    }

    const result = storage.saveDigitizedAttendance({
      periodId: activePeriod.id,
      date,
      courseId: selectedCourseId,
      subjectId: selectedSubjectId,
      registeredBy: 'Docente / Administrador',
      rows: roster.map((row) => ({
        studentId: row.student.id,
        status: row.status,
        hours: row.hours || hoursPerClass,
        reason: row.reason?.trim() || undefined,
      })),
    });

    onDataChanged();
    const subjectName = subjects.find((s) => s.id === selectedSubjectId)?.name || 'Materia';
    setSavedSuccessMessage(
      `Asistencia guardada para ${subjectName} (${date}). ${result.inserted} novedad(es) registrada(s)` +
        (result.skipped > 0 ? `, ${result.skipped} ya existente(s) omitida(s).` : '.')
    );

    setTimeout(() => {
      setSavedSuccessMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <ClipboardCheck className="w-4 h-4" />
              <span>Toma de Asistencia y Novedades</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Registro Rápido de Asistencia
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Periodo activo: <strong>{activePeriod.name}</strong> • Digitación ágil en un solo clic
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition cursor-pointer ring-2 ring-blue-400/30"
              title="Digitalizar hoja o planilla física sin omitir información ni digitar a mano"
            >
              <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span>Digitalizar Planilla con IA (Automático)</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="Marcar todos los estudiantes como Presentes"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Todos Presentes</span>
            </button>
          </div>
        </div>

        {/* Selection Form Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Curso / Grado
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Materia / Asignatura
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
            >
              {subjects.length === 0 ? (
                <option value="">No hay materias asociadas</option>
              ) : (
                subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Max {s.maxAbsences} fallas)
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Fecha de la Clase
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Horas de Clase
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <select
                value={hoursPerClass}
                onChange={(e) => handleHoursChange(parseInt(e.target.value))}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
              >
                <option value={1}>1 Hora de clase</option>
                <option value={2}>2 Horas (Bloque doble)</option>
                <option value={3}>3 Horas</option>
                <option value={4}>4 Horas</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Alumnos</span>
            <p className="text-lg font-black text-slate-800">{counts.total}</p>
          </div>
          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-700">Presentes</span>
            <p className="text-lg font-black text-emerald-700">{counts.presentes}</p>
          </div>
          <div className="bg-red-50 p-2 rounded-lg border border-red-200">
            <span className="text-[10px] uppercase font-bold text-red-700">Fallas Injustificadas</span>
            <p className="text-lg font-black text-red-700">{counts.fallas}</p>
          </div>
          <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
            <span className="text-[10px] uppercase font-bold text-blue-700">Justificadas</span>
            <p className="text-lg font-black text-blue-700">{counts.justificadas}</p>
          </div>
          <div className="bg-amber-50 p-2 rounded-lg border border-amber-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-amber-700">Retardos</span>
            <p className="text-lg font-black text-amber-700">{counts.retardos}</p>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {savedSuccessMessage && (
        <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span className="text-xs sm:text-sm font-semibold">{savedSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSavedSuccessMessage(null)}
            className="text-emerald-100 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Student Roll Call List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Llamado a Lista • {courses.find((c) => c.id === selectedCourseId)?.name}
          </h3>
          <span className="text-xs text-slate-500">
            Haga clic en el estado para marcar la novedad
          </span>
        </div>

        {roster.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No hay estudiantes activos registrados en este curso.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {roster.map((row, idx) => (
              <div
                key={row.student.id}
                className={`p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  row.status === 'falla'
                    ? 'bg-red-50/50'
                    : row.status === 'justificada'
                    ? 'bg-blue-50/40'
                    : row.status === 'retardo'
                    ? 'bg-amber-50/40'
                    : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Student Info */}
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right font-mono">
                    {idx + 1}.
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                    {row.student.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {row.student.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Doc: {row.student.document}
                    </p>
                  </div>
                </div>

                {/* State Buttons Bar */}
                <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-center">
                  {/* Presente */}
                  <button
                    type="button"
                    onClick={() => handleSetStudentStatus(row.student.id, 'presente')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      row.status === 'presente'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Presente</span>
                  </button>

                  {/* Falla Injustificada */}
                  <button
                    type="button"
                    onClick={() => handleSetStudentStatus(row.student.id, 'falla')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      row.status === 'falla'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-red-100 hover:text-red-700 text-slate-700'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Falla</span>
                  </button>

                  {/* Falla Justificada */}
                  <button
                    type="button"
                    onClick={() => handleSetStudentStatus(row.student.id, 'justificada')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      row.status === 'justificada'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Justificada</span>
                  </button>

                  {/* Retardo */}
                  <button
                    type="button"
                    onClick={() => handleSetStudentStatus(row.student.id, 'retardo')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      row.status === 'retardo'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Retardo</span>
                  </button>
                </div>

                {/* Inline Justification / Note when not present */}
                {row.status !== 'presente' && (
                  <div className="w-full sm:w-64 mt-1 sm:mt-0">
                    <input
                      type="text"
                      value={row.reason || ''}
                      onChange={(e) => handleSetStudentReason(row.student.id, e.target.value)}
                      placeholder={
                        row.status === 'justificada'
                          ? 'Motivo: Incapacidad médica, calamidad...'
                          : 'Observación (opcional)...'
                      }
                      className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer Save Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-600">
            Fallas marcadas para guardar:{' '}
            <strong className="text-red-600">{counts.fallas}</strong> • Justificadas:{' '}
            <strong className="text-blue-600">{counts.justificadas}</strong>
          </div>

          <button
            type="button"
            onClick={handleSaveAttendance}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Registro de Asistencia</span>
          </button>
        </div>
      </div>

      {/* AI Scan Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        students={roster.map((r) => r.student)}
        courses={courses}
        subjects={subjects}
        selectedCourseId={selectedCourseId}
        selectedSubjectId={selectedSubjectId}
        currentDate={date}
        currentHours={hoursPerClass}
        onApplyResults={handleApplyScanResults}
        onDirectSaveSuccess={(msg) => {
          setSavedSuccessMessage(msg);
          setTimeout(() => setSavedSuccessMessage(null), 8000);
        }}
      />
    </div>
  );
};
