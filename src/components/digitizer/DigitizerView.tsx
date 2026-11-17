import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImageIcon,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { AcademicPeriod } from '../../types';
import { storage } from '../../services/storage';
import { DigitizerResult } from '../../services/digitizer/types';
import { persistDigitizedResult } from '../../services/digitizer/persistence';
import { DigitizerWizard } from './DigitizerWizard';
import { HistoryPanel } from './HistoryPanel';

interface DigitizerViewProps {
  activePeriod: AcademicPeriod;
  onDataChanged: () => void;
}

export const DigitizerView: React.FC<DigitizerViewProps> = ({ activePeriod, onDataChanged }) => {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courses = useMemo(() => storage.getCourses(), [historyVersion]);
  const activeStudents = useMemo(
    () => storage.getStudents().filter((student) => student.status === 'activo'),
    [historyVersion]
  );
  const initialCourse = useMemo(
    () =>
      courses.find(
        (course) =>
          activeStudents.some((student) => student.courseId === course.id) &&
          storage.getSubjectsByCourse(course.id).length > 0
      ) || courses[0],
    [courses, activeStudents]
  );
  const initialCourseId = initialCourse?.id || '';
  const initialSubjectId = useMemo(
    () => storage.getSubjectsByCourse(initialCourseId)[0]?.id || '',
    [initialCourseId, historyVersion]
  );
  const studentsCount = useMemo(
    () => activeStudents.filter((student) => student.courseId === initialCourseId).length,
    [activeStudents, initialCourseId]
  );
  const entries = useMemo(() => storage.getDigitizations(), [historyVersion]);

  const openWizard = () => {
    setError(null);
    setMessage(null);
    if (!courses.length) {
      setError('Primero crea al menos un curso y una materia en “Cursos y Materias”.');
      return;
    }
    if (!initialSubjectId) {
      setError('El curso inicial no tiene materias. Crea una materia antes de digitalizar.');
      return;
    }
    if (!studentsCount) {
      setError('No hay estudiantes activos en el curso inicial. Inscribe estudiantes antes de digitalizar.');
      return;
    }
    setWizardKey((value) => value + 1);
    setIsWizardOpen(true);
  };

  const handleConfirm = (result: DigitizerResult) => {
    try {
      const { entry, saveResult } = persistDigitizedResult(result, {
        periodId: activePeriod.id,
        registeredBy: result.header.teacher || 'Digitalizador automático',
      });
      setMessage(
        `Digitalización guardada. ${saveResult.inserted} novedad(es) registrada(s) para ${entry.courseName} · ${entry.subjectName} (${entry.date})` +
          (saveResult.skipped > 0 ? ` · ${saveResult.skipped} fila(s) ya existían y se omitieron.` : '.')
      );
      setHistoryVersion((value) => value + 1);
      setIsWizardOpen(false);
      onDataChanged();
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo guardar la digitalización.');
    }
  };

  const handleDeleteHistory = useCallback((id: string) => {
    storage.deleteDigitization(id);
    setHistoryVersion((value) => value + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-6 py-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold text-blue-100 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Digitalizador automático de planillas físicas
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Convierte fotos o PDF en asistencia revisada</h2>
              <p className="text-sm text-blue-100/90 mt-2 leading-relaxed">
                Reconocimiento óptico 100% local con TrOCR para nombres manuscritos, Tesseract para texto
                impreso y OpenCV para enderezar y limpiar la hoja. Nada se guarda hasta que lo confirmes.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 text-[11px] font-semibold">
                <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Sin nube
                </span>
                <span className="px-2 py-1 rounded-lg bg-blue-500/15 text-blue-100 border border-blue-400/30 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Foto o PDF
                </span>
                <span className="px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-100 border border-indigo-400/30 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Cotejo con matrícula
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={openWizard}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold shadow-lg shadow-blue-950/40 transition"
              >
                <ScanLine className="w-4 h-4" />
                Digitalizar una planilla
              </button>
              <p className="text-[11px] text-blue-200/70 text-center mt-2">
                Curso inicial: {initialCourse?.name || 'sin cursos'} · {studentsCount} estudiante(s)
              </p>
            </div>
          </div>
        </div>

        {(message || error) && (
          <div className="p-4 space-y-2">
            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{message}</span>
                <button onClick={() => setMessage(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:text-rose-800">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isWizardOpen && (
        <DigitizerWizard
          key={wizardKey}
          initialCourseId={initialCourseId}
          initialSubjectId={initialSubjectId}
          initialDate={new Date().toISOString().split('T')[0]}
          initialHours={2}
          confirmLabel="Confirmar y guardar asistencia"
          onCancel={() => setIsWizardOpen(false)}
          onConfirm={handleConfirm}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Digitalizaciones</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{entries.length}</p>
          <p className="text-[11px] text-slate-500">Últimas 50 conservadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Novedades registradas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {entries.reduce((total, entry) => total + entry.metrics.absences + entry.metrics.tardies + entry.metrics.justified, 0)}
          </p>
          <p className="text-[11px] text-slate-500">Fallas, retardos y justificadas</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Asistencias leídas</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {entries.reduce((total, entry) => total + entry.metrics.present, 0)}
          </p>
          <p className="text-[11px] text-slate-500">No generan registro de falla</p>
        </div>
      </div>

      <HistoryPanel entries={entries} onDelete={handleDeleteHistory} />
    </div>
  );
};
