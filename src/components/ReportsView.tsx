import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Users, 
  AlertTriangle, 
  Calendar, 
  GraduationCap, 
  Search,
  CheckCircle2
} from 'lucide-react';
import { AcademicPeriod, Course, InstitutionConfig, StudentAbsenceSummary } from '../types';
import { storage } from '../services/storage';
import { 
  exportStudentReportPDF, 
  exportStudentReportExcel, 
  exportCourseReportPDF, 
  exportCourseMatrixExcel, 
  exportRiskAlertsExcel 
} from '../utils/exportUtils';

interface ReportsViewProps {
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod;
  config: InstitutionConfig;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  periods,
  activePeriod,
  config,
}) => {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(activePeriod.id);
  const [reportType, setReportType] = useState<'student' | 'course' | 'risk'>('course');

  // Course selector
  const courses = useMemo(() => storage.getCourses(), []);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.id || '');

  // Student selector
  const allStudents = useMemo(() => storage.getStudents(), []);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(allStudents[0]?.id || '');
  const [studentSearch, setStudentSearch] = useState('');

  const currentPeriodName = useMemo(() => {
    return periods.find((p) => p.id === selectedPeriodId)?.name || activePeriod.name;
  }, [periods, selectedPeriodId, activePeriod]);

  // Compute student summary
  const studentSummary: StudentAbsenceSummary | null = useMemo(() => {
    if (!selectedStudentId) return null;
    return storage.getStudentSummary(selectedStudentId, selectedPeriodId);
  }, [selectedStudentId, selectedPeriodId]);

  // Compute course summaries
  const courseSummaries = useMemo(() => {
    if (!selectedCourseId) return [];
    const courseStudents = storage.getStudentsByCourse(selectedCourseId);
    return courseStudents
      .map((st) => storage.getStudentSummary(st.id, selectedPeriodId))
      .filter((s): s is StudentAbsenceSummary => s !== null);
  }, [selectedCourseId, selectedPeriodId]);

  // Compute at risk summaries (>50%)
  const atRiskSummaries = useMemo(() => {
    return allStudents
      .map((st) => storage.getStudentSummary(st.id, selectedPeriodId))
      .filter((s): s is StudentAbsenceSummary => s !== null && s.hasAnyAlert);
  }, [allStudents, selectedPeriodId]);

  // Filter students for picker
  const filteredStudents = useMemo(() => {
    return storage.searchStudents(studentSearch);
  }, [allStudents, studentSearch]);

  // Export handlers
  const handleExportStudentPDF = () => {
    if (studentSummary) {
      exportStudentReportPDF(studentSummary, config, currentPeriodName);
    }
  };

  const handleExportStudentExcel = () => {
    if (studentSummary) {
      exportStudentReportExcel(studentSummary, config, currentPeriodName);
    }
  };

  const handleExportCoursePDF = () => {
    const course = courses.find((c) => c.id === selectedCourseId);
    const subjects = storage.getSubjectsByCourse(selectedCourseId);
    if (course) {
      exportCourseReportPDF(course, courseSummaries, subjects, config, currentPeriodName);
    }
  };

  const handleExportCourseExcel = () => {
    const course = courses.find((c) => c.id === selectedCourseId);
    const subjects = storage.getSubjectsByCourse(selectedCourseId);
    if (course) {
      exportCourseMatrixExcel(course, courseSummaries, subjects, currentPeriodName);
    }
  };

  const handleExportRiskExcel = () => {
    exportRiskAlertsExcel(atRiskSummaries, currentPeriodName);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
              <Download className="w-4 h-4" />
              <span>Centro de Generación de Reportes</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Reportes Oficiales e Historial Académico
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Descargue informes consolidados en formato PDF o Excel por estudiante, curso o alertas tempranas.
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700">Periodo Histórico:</span>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-white border border-slate-300 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isActive ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Report Type Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
          <button
            onClick={() => setReportType('course')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              reportType === 'course'
                ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <GraduationCap
                className={`w-5 h-5 ${reportType === 'course' ? 'text-blue-600' : 'text-slate-400'}`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Curso Completo
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-2">Sábana Consolidada</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Matriz de inasistencias por materia de todos los alumnos
            </p>
          </button>

          <button
            onClick={() => setReportType('student')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              reportType === 'student'
                ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <Users
                className={`w-5 h-5 ${reportType === 'student' ? 'text-blue-600' : 'text-slate-400'}`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Individual
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-2">Boletín de Inasistencias</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Reporte individual con detalle de fechas y espacio para firmas
            </p>
          </button>

          <button
            onClick={() => setReportType('risk')}
            className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
              reportType === 'risk'
                ? 'bg-red-50/80 border-red-500 ring-2 ring-red-400/30'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <AlertTriangle
                className={`w-5 h-5 ${reportType === 'risk' ? 'text-red-600' : 'text-slate-400'}`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                Alerta Temprana
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 mt-2">Informe en Riesgo (&gt;50%)</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Listado especial para Comités de Evaluación y Convivencia
            </p>
          </button>
        </div>
      </div>

      {/* REPORT 1: COURSE MATRIX */}
      {reportType === 'course' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Seleccionar Curso:</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCoursePDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Exportar PDF Sábana</span>
              </button>
              <button
                onClick={handleExportCourseExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar Excel Sábana</span>
              </button>
            </div>
          </div>

          {/* Quick Preview */}
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>
              Vista previa: {courseSummaries.length} estudiantes matriculados en{' '}
              {courses.find((c) => c.id === selectedCourseId)?.name}
            </span>
            <span>Periodo: {currentPeriodName}</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Documento</th>
                  <th className="py-2 px-3">Estudiante</th>
                  <th className="py-2 px-3 text-center">Fallas Totales</th>
                  <th className="py-2 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courseSummaries.map((sum, i) => (
                  <tr key={sum.student.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{sum.student.document}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{sum.student.name}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-700">
                      {sum.totalGeneralAbsences} h
                    </td>
                    <td className="py-2 px-3 text-center">
                      {sum.hasAnyAlert ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          Alerta &gt;50%
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: INDIVIDUAL STUDENT BULLETIN */}
      {reportType === 'student' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-100 items-center">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Buscar y Seleccionar Estudiante:</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filtrar por nombre o cédula..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Estudiante a Imprimir:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full py-1.5 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                {filteredStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.document})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-slate-600">
              Generando boletín para:{' '}
              <strong className="text-slate-900">{studentSummary?.student.name}</strong> •{' '}
              {currentPeriodName}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportStudentPDF}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span>Descargar Boletín Oficial (PDF)</span>
              </button>

              <button
                onClick={handleExportStudentExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Descargar Excel</span>
              </button>
            </div>
          </div>

          {/* Printable Preview Card */}
          {studentSummary && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-bold text-slate-900">{config.name}</h4>
                  <p className="text-[11px] text-slate-500">NIT: {config.nit}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800">{currentPeriodName}</span>
                  <p className="text-[11px] text-slate-500">
                    Fecha: {new Date().toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <p>
                  <strong>Estudiante:</strong> {studentSummary.student.name}
                </p>
                <p>
                  <strong>Documento:</strong> {studentSummary.student.document}
                </p>
                <p>
                  <strong>Curso:</strong> {studentSummary.course?.name}
                </p>
                <p>
                  <strong>Total Fallas:</strong> {studentSummary.totalGeneralAbsences} horas
                </p>
              </div>

              <div className="pt-2">
                <span className="font-bold text-slate-700 block mb-1">
                  Resumen de Materias Evaluadas:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {studentSummary.subjectSummaries.map((sub) => (
                    <div
                      key={sub.subject.id}
                      className={`p-2 rounded border ${
                        sub.isOverThreshold
                          ? 'bg-red-100/70 border-red-300 text-red-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="font-bold truncate">{sub.subject.name}</div>
                      <div className="text-[11px]">
                        {sub.totalAbsences} de {sub.maxAllowed} ({sub.percentUsed}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT 3: RISK ALERTS (>50%) */}
      {reportType === 'risk' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Estudiantes con Inasistencias Mayores al 50%
              </h3>
              <p className="text-xs text-slate-500">
                Total estudiantes en situación crítica: <strong>{atRiskSummaries.length}</strong>
              </p>
            </div>

            <button
              onClick={handleExportRiskExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-md shadow-red-500/20 cursor-pointer transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Reporte de Alertas a Excel</span>
            </button>
          </div>

          {atRiskSummaries.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                ¡Ningún estudiante supera el 50% de fallas!
              </p>
              <p className="text-xs text-slate-500 mt-1">
                La asistencia general se encuentra dentro de los parámetros regulares en este periodo.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-50 text-red-800 font-bold border-b border-red-200">
                  <tr>
                    <th className="py-2.5 px-4">Estudiante</th>
                    <th className="py-2.5 px-4">Curso</th>
                    <th className="py-2.5 px-4">Materias en Alerta (&gt;50%)</th>
                    <th className="py-2.5 px-4">Acudiente de Contacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskSummaries.map((sum) => {
                    const alertSubs = sum.subjectSummaries.filter((s) => s.isOverThreshold);

                    return (
                      <tr key={sum.student.id} className="hover:bg-red-50/40">
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{sum.student.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Doc: {sum.student.document}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {sum.course?.name}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {alertSubs.map((s) => (
                              <span
                                key={s.subject.id}
                                className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[11px] font-bold shadow-xs"
                              >
                                {s.subject.name}: {s.totalAbsences}/{s.maxAllowed} ({s.percentUsed}%)
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {sum.student.guardianName || 'No registrado'}
                          {sum.student.guardianPhone && (
                            <span className="block text-[11px] text-slate-500">
                              Tel: {sum.student.guardianPhone}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
