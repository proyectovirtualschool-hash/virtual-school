import React, { useState, useMemo } from 'react';
import { 
  Search, 
  User, 
  FileText, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  GraduationCap, 
  BookOpen, 
  ShieldAlert,
  CreditCard,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Student, AcademicPeriod, InstitutionConfig, StudentAbsenceSummary, DOCUMENT_TYPES } from '../types';
import { storage } from '../services/storage';
import { exportStudentReportExcel, exportStudentReportPDF } from '../utils/exportUtils';

interface CommunityPortalProps {
  activePeriod: AcademicPeriod;
  config: InstitutionConfig;
  initialStudentId?: string | null;
  dataVersion?: number;
  onSelectStudent?: (studentId: string) => void;
}

export const CommunityPortal: React.FC<CommunityPortalProps> = ({
  activePeriod,
  config,
  initialStudentId,
  dataVersion = 0,
}) => {
  const courses = useMemo(() => storage.getCourses(), [dataVersion]);
  const allStudents = useMemo(() => storage.getStudents(), [dataVersion]);

  // Entrance fields: Student Name and Document Type (+ optional document number)
  const [studentName, setStudentName] = useState('');
  const [documentType, setDocumentType] = useState<string>('TI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return initialStudentId || '';
  });
  const [searchStatus, setSearchStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
  }>({ type: 'idle', message: '' });

  // Update selected student if initialStudentId changes
  React.useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      const student = storage.getStudents().find((s) => s.id === initialStudentId);
      if (student) {
        setSearchStatus({
          type: 'success',
          message: `Mostrando reporte de: ${student.name} (${student.documentType || 'TI'} ${student.document})`,
        });
        setStudentName(student.name);
        setDocumentType(student.documentType || 'TI');
        setDocumentNumber(student.document);
        setSelectedCourseId('all');
        setTimeout(() => {
          document.getElementById('student-consultation-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    }
  }, [initialStudentId]);

  // Filter students based on search inputs (Name, Document Type, Doc Number, Course)
  const filteredStudents = useMemo(() => {
    return storage.findStudentsByNameAndDocType(
      studentName,
      documentType === 'all' ? undefined : documentType,
      documentNumber,
      selectedCourseId === 'all' ? undefined : selectedCourseId
    );
  }, [studentName, documentType, documentNumber, selectedCourseId, dataVersion]);

  // Execute consultation explicitly when user clicks "Ingresar / Consultar" or presses Enter
  const handleExecuteConsultation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanName = studentName.trim();
    const cleanDoc = documentNumber.trim();
    const docTypeLabel = DOCUMENT_TYPES.find((d) => d.code === documentType)?.name || documentType;

    if (!cleanName && !cleanDoc) {
      // If both name and document number are empty, pick current or first in filter
      if (filteredStudents.length > 0) {
        const student = filteredStudents[0];
        setSelectedStudentId(student.id);
        setSearchStatus({
          type: 'success',
          message: `Mostrando estudiante: ${student.name} (${student.documentType || 'TI'} ${student.document})`,
        });
        setTimeout(() => {
          document.getElementById('student-consultation-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      } else {
        setSearchStatus({
          type: 'error',
          message: 'Por favor escriba el Nombre del estudiante y verifique su Tipo de Documento.',
        });
      }
      return;
    }

    // 1. First try matching with the selected course and document type
    let matches = storage.findStudentsByNameAndDocType(
      cleanName,
      documentType === 'all' ? undefined : documentType,
      cleanDoc,
      selectedCourseId === 'all' ? undefined : selectedCourseId
    );

    // 2. If not found in the selected course, search globally across all courses
    if (matches.length === 0 && selectedCourseId !== 'all') {
      const globalMatches = storage.findStudentsByNameAndDocType(
        cleanName,
        documentType === 'all' ? undefined : documentType,
        cleanDoc
      );
      if (globalMatches.length > 0) {
        matches = globalMatches;
        setSelectedCourseId('all');
      }
    }

    // 3. If still not found and a specific documentType was chosen, test if the name exists with any document type
    if (matches.length === 0 && documentType !== 'all') {
      const anyTypeMatches = storage.findStudentsByNameAndDocType(cleanName, undefined, cleanDoc);
      if (anyTypeMatches.length > 0) {
        matches = anyTypeMatches;
        setDocumentType(matches[0].documentType || 'TI');
        setSelectedCourseId('all');
      }
    }

    if (matches.length > 0) {
      const match = matches[0];
      setSelectedStudentId(match.id);
      setSearchStatus({
        type: 'success',
        message: `¡Ingreso exitoso! Mostrando reporte de: ${match.name} (${match.documentType || 'TI'} ${match.document})${
          matches.length > 1 ? ` — (${matches.length} estudiantes coincidentes)` : ''
        }`,
      });
      setTimeout(() => {
        document.getElementById('student-consultation-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } else {
      setSearchStatus({
        type: 'error',
        message: `No se encontró ningún estudiante con el nombre "${cleanName}" y tipo de documento "${docTypeLabel}". Verifique los datos ingresados o pruebe con el número de documento.`,
      });
    }
  };

  const handleClearSearch = () => {
    setStudentName('');
    setDocumentType('all');
    setDocumentNumber('');
    setSelectedCourseId('all');
    setSearchStatus({ type: 'idle', message: '' });
  };

  // Selected student full summary
  const summary: StudentAbsenceSummary | null = useMemo(() => {
    if (!selectedStudentId) return null;
    return storage.getStudentSummary(selectedStudentId, activePeriod.id);
  }, [selectedStudentId, activePeriod.id, dataVersion]);

  const handleDownloadPDF = () => {
    if (!summary) return;
    exportStudentReportPDF(summary, config, activePeriod.name);
  };

  const handleDownloadExcel = () => {
    if (!summary) return;
    exportStudentReportExcel(summary, config, activePeriod.name);
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-md mb-3 border border-white/15">
            <GraduationCap className="w-3.5 h-3.5 text-blue-200" />
            <span>Portal de Consulta Abierta - Comunidad Educativa</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Consulta y Consolidado de Inasistencias
          </h2>
          <p className="mt-2 text-sm sm:text-base text-blue-100 leading-relaxed">
            Los estudiantes y acudientes pueden ingresar directamente con su <strong>nombre</strong> y <strong>tipo de documento</strong> para consultar en tiempo real las fallas acumuladas y descargar su boletín oficial.
          </p>
        </div>
      </div>

      {/* Prominent Student Entrance / Consultation Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Ingreso con Nombre y Tipo de Documento</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete los datos del estudiante para acceder al historial de fallas y alertas académicas.
            </p>
          </div>
          {(studentName || documentNumber || documentType !== 'all' || selectedCourseId !== 'all') && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs font-semibold text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition cursor-pointer self-start sm:self-auto"
            >
              Limpiar Campos
            </button>
          )}
        </div>

        <form onSubmit={handleExecuteConsultation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Tipo de Documento */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Tipo de Documento *</span>
              </label>
              <select
                id="select-tipo-documento"
                value={documentType}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  if (searchStatus.type !== 'idle') setSearchStatus({ type: 'idle', message: '' });
                }}
                className="w-full py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer shadow-inner"
              >
                <option value="all">Cualquier Tipo de Doc.</option>
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.code} value={dt.code}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre del Estudiante */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Nombre del Estudiante *</span>
              </label>
              <div className="relative">
                <input
                  id="input-nombre-estudiante"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    if (searchStatus.type !== 'idle') setSearchStatus({ type: 'idle', message: '' });
                  }}
                  placeholder="Ej: Valentina Restrepo, Santiago..."
                  className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition placeholder:text-slate-400 shadow-inner"
                />
              </div>
            </div>

            {/* Número de Documento (opcional / complementario) */}
            <div className="lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-blue-600" />
                <span>No. de Documento (Opcional)</span>
              </label>
              <input
                id="input-numero-documento"
                type="text"
                value={documentNumber}
                onChange={(e) => {
                  setDocumentNumber(e.target.value);
                  if (searchStatus.type !== 'idle') setSearchStatus({ type: 'idle', message: '' });
                }}
                placeholder="Ej: 1025849632"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition placeholder:text-slate-400 font-mono shadow-inner"
              />
            </div>

            {/* Curso Filter */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                <span>Curso / Grado</span>
              </label>
              <select
                id="select-consulta-curso"
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full py-2.5 px-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer shadow-inner"
              >
                <option value="all">Todos los Cursos</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Row: Quick buttons + Submit */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            {/* Quick Suggestions / Demos */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500">
              <span className="font-semibold text-slate-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Ejemplos:
              </span>
              <button
                type="button"
                onClick={() => {
                  setStudentName('Valentina Restrepo Morales');
                  setDocumentType('TI');
                  setDocumentNumber('1025849632');
                  setSelectedCourseId('all');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-800 border border-slate-200 rounded-lg text-[11px] font-medium transition cursor-pointer"
              >
                Valentina Restrepo (T.I.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentName('Santiago Benítez Vargas');
                  setDocumentType('TI');
                  setDocumentNumber('1036987412');
                  setSelectedCourseId('all');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-800 border border-slate-200 rounded-lg text-[11px] font-medium transition cursor-pointer"
              >
                Santiago Benítez (T.I.)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentName('Nicolás Jiménez Beltrán');
                  setDocumentType('CC');
                  setDocumentNumber('1096325874');
                  setSelectedCourseId('all');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-800 border border-slate-200 rounded-lg text-[11px] font-medium transition cursor-pointer"
              >
                Nicolás Jiménez (C.C.)
              </button>
            </div>

            {/* MAIN CONSULTATION / LOGIN BUTTON */}
            <button
              id="btn-consulta-estudiante"
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
              title="Realizar consulta de inasistencias del estudiante"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>Ingresar / Consultar Estudiante</span>
            </button>
          </div>

          {/* Status Feedback Message */}
          {searchStatus.type === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{searchStatus.message}</span>
            </div>
          )}

          {searchStatus.type === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchStatus.message}</span>
            </div>
          )}
        </form>

        {/* Quick hint tag list */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
          <span>Estudiantes encontrados: <strong>{filteredStudents.length}</strong></span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              Alerta mayor al 50% de fallas
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Asistencia al día
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Student Selector on Mobile/Left + Full Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Student Quick List */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Listado de Estudiantes
            </h3>
            <span className="text-xs text-slate-500 font-medium">Seleccione uno</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No se encontraron estudiantes con ese criterio de búsqueda.
              </div>
            ) : (
              filteredStudents.map((st) => {
                const isSelected = st.id === selectedStudentId;
                const studentSummary = storage.getStudentSummary(st.id, activePeriod.id);
                const hasAlert = studentSummary?.hasAnyAlert;
                const courseName = courses.find((c) => c.id === st.courseId)?.name;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudentId(st.id);
                      setSearchStatus({
                        type: 'success',
                        message: `Consulta activa: ${st.name} (Doc: ${st.document})`,
                      });
                    }}
                    className={`w-full text-left p-3 transition flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 border-l-4 border-blue-600 ring-1 ring-blue-200'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          hasAlert
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {st.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-800'}`}>
                          {st.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded text-[10px] border border-blue-200">
                            {st.documentType || 'TI'}
                          </span>
                          <span>{st.document}</span>
                          <span>•</span>
                          <span>{courseName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      {hasAlert ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 animate-pulse flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          &gt;50%
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">
                          {studentSummary?.totalGeneralAbsences || 0} f.
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700'}`}>
                        {isSelected ? 'Consultando' : 'Consultar'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Complete Student Detailed View */}
        <div id="student-consultation-report" className="lg:col-span-8 space-y-6">
          {summary ? (
            <>
              {/* Student Profile Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
                      {summary.student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                          {summary.student.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {summary.course?.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        <strong className="text-slate-700">Tipo y Documento:</strong>{' '}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 mr-1.5">
                          {summary.student.documentType || 'TI'}
                        </span>
                        <span className="font-mono text-slate-800 font-semibold">{summary.student.document}</span>
                        {' '}| <strong className="text-slate-700">Periodo:</strong> {activePeriod.name}
                      </p>
                    </div>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={handleDownloadPDF}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold shadow-xs transition"
                      title="Descargar Boletín Oficial en PDF"
                    >
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span>Descargar PDF</span>
                    </button>
                    <button
                      onClick={handleDownloadExcel}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold shadow-xs transition"
                      title="Descargar datos en Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Descargar Excel</span>
                    </button>
                  </div>
                </div>

                {/* Critical Alert Banner if > 50% */}
                {summary.hasAnyAlert && (
                  <div className="mt-5 p-4 rounded-xl bg-red-50 border-2 border-red-500 flex items-start gap-3 text-red-900 shadow-sm animate-pulse">
                    <ShieldAlert className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-red-800 uppercase tracking-wide">
                        ¡Atención: Estudiante en Riesgo de Reprobación por Inasistencia!
                      </h4>
                      <p className="text-xs text-red-700 mt-1 leading-relaxed">
                        Este estudiante ha superado el <strong>50% de fallas permitidas</strong> en una o más materias durante este periodo académico. Según el reglamento institucional, acumular el límite de fallas conlleva a la reprobación automática de la asignatura.
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Fallas Injustificadas</span>
                    <p className="text-2xl font-black text-slate-800 mt-1">
                      {summary.totalGeneralAbsences} <span className="text-xs font-normal text-slate-500">horas</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Justificadas</span>
                    <p className="text-2xl font-black text-emerald-600 mt-1">
                      {summary.subjectSummaries.reduce((a, b) => a + b.justifiedCount, 0)} <span className="text-xs font-normal text-slate-500">horas</span>
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase">Tardanzas / Retardos</span>
                    <p className="text-2xl font-black text-amber-600 mt-1">
                      {summary.subjectSummaries.reduce((a, b) => a + b.tardiesCount, 0)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg border ${summary.hasAnyAlert ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                    <span className="text-[11px] font-semibold uppercase">Estado Académico</span>
                    <p className="text-sm font-bold mt-1 flex items-center gap-1">
                      {summary.hasAnyAlert ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          En Alerta Roja
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          En Regla
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subject Breakdown Cards (Requirement: Highlight in RED when exceeding 50% e.g. "Inglés 14/20") */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Consolidado de Fallas por Materia
                  </h3>
                  <span className="text-xs text-slate-500">Límite permitido por periodo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {summary.subjectSummaries.map((sub) => {
                    const isAlert = sub.isOverThreshold; // > 50%
                    const isFailed = sub.isFailed; // >= 100%
                    const remaining = Math.max(0, sub.maxAllowed - sub.totalAbsences);

                    return (
                      <div
                        key={sub.subject.id}
                        className={`rounded-xl p-4 border transition-all ${
                          isAlert
                            ? 'bg-red-50/70 border-red-500 ring-2 ring-red-400/40 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className={`text-sm font-bold ${isAlert ? 'text-red-900 font-extrabold' : 'text-slate-800'}`}>
                              {sub.subject.name}
                            </h4>
                            <span className="text-xs text-slate-500 font-mono">
                              {sub.subject.code} • {sub.subject.weeklyHours}h semanales
                            </span>
                          </div>

                          {/* Badge with count, e.g. "Inglés 14/20" */}
                          <div
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              isAlert
                                ? 'bg-red-600 text-white border-red-700 shadow-xs'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {sub.totalAbsences} / {sub.maxAllowed}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1 font-medium">
                            <span className={isAlert ? 'text-red-700 font-bold' : 'text-slate-600'}>
                              {sub.percentUsed}% acumulado
                            </span>
                            <span className="text-slate-500">
                              {remaining} fallas restantes
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFailed
                                  ? 'bg-red-800'
                                  : isAlert
                                  ? 'bg-red-600'
                                  : sub.percentUsed > 30
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, sub.percentUsed)}%` }}
                            />
                          </div>
                        </div>

                        {/* Alert Message for this subject */}
                        {isAlert && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100/80 px-2 py-1 rounded-md">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>
                              {isFailed
                                ? 'Materia Reprobada por Inasistencia'
                                : '¡Superó el 50% de fallas permitidas!'}
                            </span>
                          </div>
                        )}

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Justificadas: {sub.justifiedCount}</span>
                          <span>Tardanzas: {sub.tardiesCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Absence History Table */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Historial Completo de Inasistencias
                  </h3>
                  <span className="text-xs text-slate-500">
                    {summary.records.length} registro(s) en este periodo
                  </span>
                </div>

                {summary.records.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">¡Asistencia Perfecta!</p>
                    <p className="text-xs text-slate-500 mt-1">
                      No se han registrado inasistencias para este estudiante en el periodo seleccionado.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-4">Fecha</th>
                          <th className="py-2.5 px-4">Materia</th>
                          <th className="py-2.5 px-4">Tipo</th>
                          <th className="py-2.5 px-4 text-center">Horas</th>
                          <th className="py-2.5 px-4">Motivo / Justificación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.records.map((rec) => {
                          const sub = summary.subjectSummaries.find((s) => s.subject.id === rec.subjectId);
                          return (
                            <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                                {rec.date}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-slate-900">
                                {sub?.subject.name || 'Asignatura'}
                              </td>
                              <td className="py-2.5 px-4">
                                {rec.type === 'falla' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                    Falla Injustificada
                                  </span>
                                )}
                                {rec.type === 'justificada' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                    Falla Justificada
                                  </span>
                                )}
                                {rec.type === 'retardo' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                    Retardo / Tardanza
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-center font-semibold text-slate-700">
                                {rec.hours || 1} h
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 italic">
                                {rec.reason || 'Sin observación registrada'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-slate-700">Seleccione un estudiante</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Utilice el buscador o seleccione un estudiante del listado para consultar su historial de inasistencias y reporte detallado.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
