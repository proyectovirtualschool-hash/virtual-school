import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  FileImage,
  FileText,
  History,
  ImageIcon,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { Student } from '../../types';
import { storage } from '../../services/storage';
import { digitizePage } from '../../services/digitizer/digitizer';
import { isPdfFile, renderPdfPages, PdfPageImage } from '../../services/digitizer/pdf';
import {
  calculateMetrics,
  canConfirm,
  createOmittedRows,
  flagLabel,
  isBlockingRow,
  markDuplicateRows,
  resolveRowMatch,
  statusLabel,
} from '../../services/digitizer/reconcile';
import {
  DigitizerHeader,
  DigitizerProgress,
  DigitizerResult,
  DigitizerRow,
  DigitizerStatus,
} from '../../services/digitizer/types';
import { normalizeText } from '../../services/digitizer/textUtils';
import { AddStudentModal } from './AddStudentModal';

type WizardStep = 'upload' | 'processing' | 'review';
type RowFilter = 'all' | 'pending' | 'omitted' | 'duplicates' | 'unregistered' | 'excluded';

interface DigitizerWizardProps {
  initialCourseId: string;
  initialSubjectId: string;
  initialDate: string;
  initialHours: number;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (result: DigitizerResult) => void;
}

interface SourcePage {
  dataUrl: string;
  pageNumber: number;
  pageCount: number;
  fileName: string;
}

const STATUS_OPTIONS: { value: DigitizerStatus; label: string }[] = [
  { value: 'presente', label: 'Asistió' },
  { value: 'falla', label: 'Falla' },
  { value: 'retardo', label: 'Retardo' },
  { value: 'justificada', label: 'Justificada' },
  { value: 'sin_definir', label: 'Sin definir' },
];

function confidenceLabel(value: number): string {
  if (value >= 0.8) return 'Alta';
  if (value >= 0.55) return 'Media';
  return 'Baja';
}

function confidenceClass(value: number): string {
  if (value >= 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (value >= 0.55) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function statusClass(status: DigitizerStatus): string {
  switch (status) {
    case 'presente':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'falla':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'retardo':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'justificada':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function flagClass(flag: string): string {
  if (['conflicto', 'no_inscrito', 'ilegible', 'duplicado', 'omitido'].includes(flag)) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (flag === 'baja_confianza' || flag === 'estructura_estimada') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (flag === 'excluido') return 'bg-slate-100 text-slate-500 border-slate-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export const DigitizerWizard: React.FC<DigitizerWizardProps> = ({
  initialCourseId,
  initialSubjectId,
  initialDate,
  initialHours,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const courses = useMemo(() => storage.getCourses(), []);
  const defaultCourseId = initialCourseId || courses[0]?.id || '';
  const defaultSubjectId = initialSubjectId || storage.getSubjectsByCourse(defaultCourseId)[0]?.id || '';

  const [step, setStep] = useState<WizardStep>('upload');
  const [sourcePage, setSourcePage] = useState<SourcePage | null>(null);
  const [pdfPages, setPdfPages] = useState<PdfPageImage[]>([]);
  const [selectedPdfPage, setSelectedPdfPage] = useState(0);
  const [fileName, setFileName] = useState('');
  const [useTrocr, setUseTrocr] = useState(true);
  const [progress, setProgress] = useState<DigitizerProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<DigitizerResult | null>(null);
  const [header, setHeader] = useState<DigitizerHeader | null>(null);
  const [rows, setRows] = useState<DigitizerRow[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [showImages, setShowImages] = useState(false);
  const [addTarget, setAddTarget] = useState<DigitizerRow | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const roster = useMemo<Student[]>(() => {
    const courseId = header?.courseId || defaultCourseId;
    return storage.getStudentsByCourse(courseId);
  }, [header?.courseId, defaultCourseId, catalogVersion]);

  const subjects = useMemo(() => {
    const courseId = header?.courseId || defaultCourseId;
    const list = storage.getSubjectsByCourse(courseId);
    if (header?.subjectId && !list.some((subject) => subject.id === header.subjectId)) {
      const current = storage.getSubjects().find((subject) => subject.id === header.subjectId);
      if (current) return [...list, current];
    }
    return list;
  }, [header?.courseId, header?.subjectId, defaultCourseId, catalogVersion]);

  const metrics = useMemo(() => calculateMetrics(rows), [rows]);
  const blockingCount = useMemo(() => rows.filter((row) => isBlockingRow(row)).length, [rows]);
  const canProceed = useMemo(() => canConfirm(rows), [rows]);

  const resetAll = () => {
    setStep('upload');
    setSourcePage(null);
    setPdfPages([]);
    setSelectedPdfPage(0);
    setFileName('');
    setProgress(null);
    setError(null);
    setWarnings([]);
    setResult(null);
    setHeader(null);
    setRows([]);
    setFilter('all');
    setShowImages(false);
    setSearch('');
  };

  const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });

  const handleFile = async (file: File) => {
    setError(null);
    setWarnings([]);
    setResult(null);
    setRows([]);
    setHeader(null);
    setPdfPages([]);
    setSelectedPdfPage(0);
    setFileName(file.name);
    try {
      if (await isPdfFile(file)) {
        const pages = await renderPdfPages(file, 8, 2000);
        if (!pages.length) throw new Error('El PDF no contiene páginas legibles.');
        setPdfPages(pages);
        setSourcePage({
          dataUrl: pages[0].dataUrl,
          pageNumber: pages[0].pageNumber,
          pageCount: pages.length,
          fileName: file.name,
        });
        setSelectedPdfPage(0);
      } else {
        if (!file.type.startsWith('image/')) {
          throw new Error('Selecciona una imagen JPG, PNG o WEBP, o un PDF.');
        }
        const dataUrl = await readImageFile(file);
        setSourcePage({ dataUrl, pageNumber: 1, pageCount: 1, fileName: file.name });
      }
      setStep('upload');
    } catch (fileError: any) {
      setError(fileError?.message || 'No se pudo leer el archivo.');
      setSourcePage(null);
    }
  };

  const handleSelectPdfPage = (index: number) => {
    if (!pdfPages[index]) return;
    setSelectedPdfPage(index);
    setSourcePage({
      dataUrl: pdfPages[index].dataUrl,
      pageNumber: pdfPages[index].pageNumber,
      pageCount: pdfPages.length,
      fileName,
    });
  };

  const startProcessing = async () => {
    if (!sourcePage) return;
    setStep('processing');
    setError(null);
    setWarnings([]);
    setProgress({ step: 'preparing', message: 'Preparando la página...' });
    try {
      const digitized = await digitizePage(
        sourcePage.dataUrl,
        sourcePage.fileName,
        sourcePage.pageNumber,
        sourcePage.pageCount,
        {
          catalog: {
            students: storage.getStudents(),
            courses: storage.getCourses(),
            subjects: storage.getSubjects(),
          },
          courseId: defaultCourseId,
          subjectId: defaultSubjectId,
          date: initialDate,
          hours: initialHours,
          useTrocr,
          onProgress: setProgress,
        }
      );
      setResult(digitized);
      setHeader(digitized.header);
      setRows(digitized.rows);
      setWarnings(digitized.warnings);
      setFilter('pending');
      setStep('review');
    } catch (processError: any) {
      setError(processError?.message || 'No se pudo procesar la planilla.');
      setStep('upload');
    } finally {
      setProgress(null);
    }
  };

  const updateRow = (id: string, patch: Partial<DigitizerRow>) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleNameChange = (row: DigitizerRow, value: string) => {
    const next = resolveRowMatch({ ...row, studentName: value, matchedStudentId: undefined }, roster);
    setRows((previous) => markDuplicateRows(previous.map((item) => (item.id === row.id ? next : item))));
  };

  const handleManualMatch = (row: DigitizerRow, studentId: string) => {
    const student = roster.find((item) => item.id === studentId);
    setRows((previous) =>
      markDuplicateRows(
        previous.map((item) => {
          if (item.id !== row.id) return item;
          if (!studentId || !student) {
            return { ...item, matchedStudentId: undefined, flags: [...item.flags.filter((flag) => flag !== 'cotejado'), 'no_inscrito'] };
          }
          const flags = item.flags.filter(
            (flag) => !['conflicto', 'no_inscrito', 'ilegible', 'omitido', 'cotejado'].includes(flag)
          );
          flags.push('cotejado');
          return {
            ...item,
            matchedStudentId: student.id,
            studentName: item.studentName || student.name,
            document: student.document,
            flags,
          };
        })
      )
    );
  };

  const handleStatusChange = (row: DigitizerRow, status: DigitizerStatus) => {
    setRows((previous) =>
      previous.map((item) => {
        if (item.id !== row.id) return item;
        const flags = item.flags.filter((flag) => flag !== 'omitido');
        return { ...item, status, flags };
      })
    );
  };

  const handleExclude = (row: DigitizerRow, excluded: boolean) => {
    setRows((previous) =>
      markDuplicateRows(
        previous.map((item) => {
          if (item.id !== row.id) return item;
          const flags = item.flags.filter((flag) => !['excluido', 'duplicado'].includes(flag));
          if (excluded) flags.push('excluido');
          return { ...item, excluded, flags };
        })
      )
    );
  };

  const handleHeaderCourse = (courseId: string) => {
    if (!header) return;
    const nextRoster = storage.getStudentsByCourse(courseId);
    const base = rows
      .filter((row) => !row.rosterOnly && !row.excluded)
      .map((row) => resolveRowMatch({ ...row, rosterOnly: false }, nextRoster));
    const omitted = createOmittedRows(base, nextRoster, header.hours);
    const nextSubject = storage.getSubjectsByCourse(courseId)[0]?.id || header.subjectId;
    setHeader({ ...header, courseId, subjectId: nextSubject });
    setRows(markDuplicateRows([...base, ...omitted]));
  };

  const handleHeaderSubject = (subjectId: string) => {
    if (!header) return;
    setHeader({ ...header, subjectId });
  };

  const handleAddStudentCreated = (student: Student) => {
    if (!addTarget) return;
    setCatalogVersion((version) => version + 1);
    setRows((previous) =>
      markDuplicateRows(
        previous.map((row) => {
          if (row.id !== addTarget.id) return row;
          const flags = row.flags.filter((flag) =>
            !['conflicto', 'no_inscrito', 'ilegible', 'omitido', 'cotejado', 'duplicado'].includes(flag)
          );
          flags.push('cotejado');
          return {
            ...row,
            matchedStudentId: student.id,
            studentName: student.name,
            document: student.document,
            flags,
          };
        })
      )
    );
    setAddTarget(null);
  };

  const handleConfirm = () => {
    if (!result || !header) return;
    if (!header.courseId || !header.subjectId) {
      setError('Selecciona el curso y la materia antes de confirmar.');
      return;
    }
    if (!header.date) {
      setError('Selecciona la fecha de la planilla antes de confirmar.');
      return;
    }
    if (!canProceed || blockingCount > 0) {
      setError(`Hay ${blockingCount} fila(s) bloqueante(s). Resuélvelas o exclúyelas con motivo.`);
      return;
    }
    const activePeriod = storage.getActivePeriod();
    const existing = storage.findConfirmedDigitization(
      header.courseId,
      header.subjectId,
      header.date,
      activePeriod.id
    );
    if (existing && !window.confirm(
      `Ya existe una digitalización confirmada para esta sesión (${new Date(existing.createdAt).toLocaleString('es-CO')}). ¿Deseas continuar de todos modos? Los registros duplicados se omitirán al guardar.`
    )) {
      return;
    }
    const updatedMetrics = calculateMetrics(rows);
    onConfirm({
      ...result,
      header,
      rows,
      metrics: updatedMetrics,
      warnings,
    });
  };

  const visibleRows = useMemo(() => {
    const query = normalizeText(search);
    return rows.filter((row) => {
      if (query) {
        const haystack = normalizeText(`${row.studentName} ${row.document || ''}`);
        if (!haystack.includes(query)) return false;
      }
      switch (filter) {
        case 'pending':
          return isBlockingRow(row);
        case 'omitted':
          return row.flags.includes('omitido');
        case 'duplicates':
          return row.flags.includes('duplicado');
        case 'unregistered':
          return row.flags.includes('no_inscrito') || row.flags.includes('conflicto');
        case 'excluded':
          return !!row.excluded;
        default:
          return true;
      }
    });
  }, [rows, filter, search]);

  if (step === 'processing') {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="max-w-md mx-auto text-center space-y-5">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Procesando planilla localmente</h3>
            <p className="text-sm text-slate-600 mt-1">
              {progress?.message || 'Preparando el reconocimiento...'}
            </p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all"
              style={{
                width:
                  progress?.current && progress?.total
                    ? `${Math.max(5, Math.round((progress.current / progress.total) * 100))}%`
                    : '45%',
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Las imágenes no salen de este dispositivo
          </p>
        </div>
      </div>
    );
  }

  if (step === 'review' && result && header) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-5 py-4 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <ScanLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Revisión de planilla digitalizada</h3>
                <p className="text-xs text-blue-100">
                  {result.fileName} · Página {result.pageNumber} de {result.pageCount} · {result.engine}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImages((value) => !value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {showImages ? 'Ocultar imagen' : 'Ver imagen'}
              </button>
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Nueva planilla
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {showImages && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600">Imagen original</p>
                  <img src={result.originalImage} alt="Original" className="w-full rounded-xl border border-slate-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-600">Imagen mejorada</p>
                  <img src={result.enhancedImage} alt="Mejorada" className="w-full rounded-xl border border-slate-200" />
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Advertencias del reconocimiento
                </p>
                <ul className="text-[11px] text-amber-800 list-disc pl-5 space-y-0.5">
                  {warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={header.date}
                  onChange={(event) => setHeader({ ...header, date: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Curso</label>
                <select
                  value={header.courseId}
                  onChange={(event) => handleHeaderCourse(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Materia</label>
                <select
                  value={header.subjectId}
                  onChange={(event) => handleHeaderSubject(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Horas</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={header.hours}
                  onChange={(event) => setHeader({ ...header, hours: Number(event.target.value) || 1 })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Docente</label>
                <input
                  value={header.teacher}
                  onChange={(event) => setHeader({ ...header, teacher: event.target.value })}
                  placeholder="Nombre del docente (opcional)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Observaciones generales</label>
                <input
                  value={header.notes}
                  onChange={(event) => setHeader({ ...header, notes: event.target.value })}
                  placeholder="Opcional"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { label: 'Filas', value: metrics.totalRows, tone: 'slate' },
                { label: 'Cotejados', value: metrics.matched, tone: 'emerald' },
                { label: 'Pendientes', value: metrics.pending, tone: 'amber' },
                { label: 'Omitidos', value: metrics.omitted, tone: 'rose' },
                { label: 'Duplicados', value: metrics.duplicates, tone: 'rose' },
                { label: 'No inscritos', value: metrics.unregistered, tone: 'rose' },
                { label: 'Ilegibles', value: metrics.illegible, tone: 'rose' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{item.label}</p>
                  <p className="text-lg font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'all', label: `Todas (${rows.length})` },
                  { key: 'pending', label: `Bloqueantes (${blockingCount})` },
                  { key: 'omitted', label: `Omitidos (${metrics.omitted})` },
                  { key: 'duplicates', label: `Duplicados (${metrics.duplicates})` },
                  { key: 'unregistered', label: `No inscritos (${metrics.unregistered})` },
                  { key: 'excluded', label: 'Excluidos' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key as RowFilter)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
                      filter === item.key
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto w-full sm:w-56">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nombre o documento..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 w-10">#</th>
                    <th className="px-3 py-2 w-10">Exc.</th>
                    <th className="px-3 py-2 min-w-[230px]">Nombre leído</th>
                    <th className="px-3 py-2 min-w-[170px]">Estudiante cotejado</th>
                    <th className="px-3 py-2 w-32">Estado</th>
                    <th className="px-3 py-2 w-28">Horas</th>
                    <th className="px-3 py-2 min-w-[180px]">Observación</th>
                    <th className="px-3 py-2 min-w-[190px]">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRows.map((row) => (
                    <tr key={row.id} className={row.excluded ? 'bg-slate-50/70 opacity-70' : isBlockingRow(row) ? 'bg-rose-50/30' : ''}>
                      <td className="px-3 py-2 text-xs text-slate-500 align-top">{row.sheetRow}</td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={!!row.excluded}
                          onChange={(event) => handleExclude(row, event.target.checked)}
                          title="Excluir fila de esta digitalización"
                          className="mt-1"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={row.studentName}
                          onChange={(event) => handleNameChange(row, event.target.value)}
                          placeholder="Nombre ilegible"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${confidenceClass(row.confidence)}`}>
                            {confidenceLabel(row.confidence)}
                          </span>
                          {row.nameEngine && (
                            <span className="text-[10px] text-slate-400 uppercase">{row.nameEngine}</span>
                          )}
                          {row.rosterOnly && <span className="text-[10px] text-amber-600 font-semibold">No aparece en la planilla</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.matchedStudentId || ''}
                          onChange={(event) => handleManualMatch(row, event.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">— Sin cotejar —</option>
                          {row.candidates.length > 0 && (
                            <optgroup label="Candidatos">
                              {row.candidates.map((candidate) => (
                                <option key={`cand-${candidate.studentId}`} value={candidate.studentId}>
                                  {candidate.name} ({Math.round(candidate.score * 100)}%)
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Matrícula del curso">
                            {roster.map((student) => (
                              <option key={student.id} value={student.id}>
                                {student.name} · {student.document}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {!row.matchedStudentId && (
                          <button
                            onClick={() => setAddTarget(row)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800"
                          >
                            <UserPlus className="w-3 h-3" />
                            Agregar estudiante real
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={row.status}
                          onChange={(event) => handleStatusChange(row, event.target.value as DigitizerStatus)}
                          className={`w-full rounded-lg border px-2 py-1.5 text-xs font-semibold bg-white ${statusClass(row.status)}`}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {row.markDetected && <p className="mt-1 text-[10px] text-slate-500">Marca: {row.markDetected}</p>}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={row.hours}
                          onChange={(event) => updateRow(row.id, { hours: Number(event.target.value) || 1 })}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={row.observation || ''}
                          onChange={(event) => updateRow(row.id, { observation: event.target.value })}
                          placeholder="Opcional"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {row.flags.map((flag) => (
                            <span key={`${row.id}-${flag}`} className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${flagClass(flag)}`}>
                              {flagLabel(flag)}
                            </span>
                          ))}
                          {row.flags.length === 0 && <span className="text-[10px] text-slate-400">Sin alertas</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-500">
                        No hay filas con este filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <div className="text-xs text-slate-600">
                {blockingCount > 0 ? (
                  <span className="text-rose-600 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Faltan {blockingCount} fila(s) por resolver para poder confirmar.
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Todo cotejado. Revisa y confirma.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canProceed || blockingCount > 0}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {addTarget && (
          <AddStudentModal
            key={addTarget.id}
            isOpen
            courseId={header.courseId}
            initialName={addTarget.studentName}
            initialDocument={addTarget.document}
            onClose={() => setAddTarget(null)}
            onCreated={handleAddStudentCreated}
          />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-5 py-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold">Digitalizador automático de planillas</h3>
            <p className="text-xs text-blue-100">OCR local con TrOCR, Tesseract y OpenCV</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/15" title="Cerrar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            100% local
          </span>
          <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
            TrOCR + Tesseract + OpenCV
          </span>
          <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
            Sin datos inventados
          </span>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50/60'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm font-bold text-slate-900">Arrastra una foto o PDF de la planilla</p>
          <p className="text-xs text-slate-500 mt-1">JPG, PNG, WEBP o PDF · máximo 8 páginas por archivo</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <FileImage className="w-4 h-4" />
              Seleccionar archivo
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
            >
              <Camera className="w-4 h-4" />
              Usar cámara
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.target.value = '';
            }}
          />
        </div>

        {sourcePage && (
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-800">{sourcePage.fileName}</span>
                <span>· Página {sourcePage.pageNumber} de {sourcePage.pageCount}</span>
              </div>
              {pdfPages.length > 1 && (
                <select
                  value={selectedPdfPage}
                  onChange={(event) => handleSelectPdfPage(Number(event.target.value))}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
                >
                  {pdfPages.map((page, index) => (
                    <option key={page.pageNumber} value={index}>
                      Página {page.pageNumber}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <img
              src={sourcePage.dataUrl}
              alt="Vista previa de la planilla"
              className="max-h-72 w-full object-contain rounded-xl border border-slate-200 bg-slate-50"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={useTrocr}
                  onChange={(event) => setUseTrocr(event.target.checked)}
                />
                Usar TrOCR para nombres manuscritos (recomendado)
              </label>
              <button
                onClick={startProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                Procesar planilla
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-600">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Mejora automática
            </p>
            Corrige perspectiva, endereza, mejora contraste y detecta la tabla.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-600" /> Revisión obligatoria
            </p>
            No se guarda nada hasta que confirmes fila por fila.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <ChevronDown className="w-3.5 h-3.5 text-emerald-600" /> Sin invención
            </p>
            Los campos dudosos quedan en “Sin definir” y bloquean el guardado.
          </div>
        </div>
      </div>
    </div>
  );
};
