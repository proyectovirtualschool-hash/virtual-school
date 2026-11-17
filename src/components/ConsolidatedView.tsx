import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  AlertTriangle, 
  Filter, 
  FileText, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  X, 
  Calendar,
  AlertOctagon,
  Clock
} from 'lucide-react';
import { AcademicPeriod, Course, InstitutionConfig, StudentAbsenceSummary, AbsenceType } from '../types';
import { storage } from '../services/storage';
import { exportCourseMatrixExcel, exportCourseReportPDF, exportStudentReportPDF, exportStudentReportExcel } from '../utils/exportUtils';

interface ConsolidatedViewProps {
  activePeriod: AcademicPeriod;
  config: InstitutionConfig;
  isAdmin: boolean;
  dataVersion?: number;
  onDataChanged: () => void;
  onConsultStudent?: (studentId: string) => void;
}

export const ConsolidatedView: React.FC<ConsolidatedViewProps> = ({
  activePeriod,
  config,
  isAdmin,
  dataVersion,
  onDataChanged,
  onConsultStudent,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);
  const [selectedStudentSummary, setSelectedStudentSummary] = useState<StudentAbsenceSummary | null>(null);
  const [localTick, setLocalTick] = useState<number>(0);

  // In-app deletion confirmation modal state
  const [recordToDelete, setRecordToDelete] = useState<{
    id: string;
    date: string;
    subjectName: string;
    hours: number;
    type: AbsenceType;
    reason?: string;
  } | null>(null);

  // In-modal notification feedback
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Modal for adding single manual absence
  const [isAddAbsenceModalOpen, setIsAddAbsenceModalOpen] = useState(false);
  const [newAbsenceDate, setNewAbsenceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newAbsenceSubjectId, setNewAbsenceSubjectId] = useState<string>('');
  const [newAbsenceType, setNewAbsenceType] = useState<AbsenceType>('falla');
  const [newAbsenceHours, setNewAbsenceHours] = useState<number>(2);
  const [newAbsenceReason, setNewAbsenceReason] = useState<string>('');

  const courses = useMemo(() => storage.getCourses(), []);
  const allStudents = useMemo(() => storage.getStudents(), []);
  const subjects = useMemo(() => storage.getSubjects(), []);

  // Compute summaries for all students
  const allSummaries = useMemo(() => {
    return allStudents
      .map((st) => storage.getStudentSummary(st.id, activePeriod.id))
      .filter((s): s is StudentAbsenceSummary => s !== null);
  }, [allStudents, activePeriod.id, dataVersion, localTick]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    return allSummaries.filter((sum) => {
      // Course filter
      if (selectedCourseId !== 'all' && sum.student.courseId !== selectedCourseId) {
        return false;
      }
      // Only alerts filter (>50%)
      if (onlyAlerts && !sum.hasAnyAlert) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = sum.student.name.toLowerCase().includes(q);
        const matchesDoc = sum.student.document.toLowerCase().includes(q);
        return matchesName || matchesDoc;
      }
      return true;
    });
  }, [allSummaries, selectedCourseId, onlyAlerts, searchQuery]);

  // Global KPIs
  const kpis = useMemo(() => {
    const totalStudents = allSummaries.length;
    const alertStudents = allSummaries.filter((s) => s.hasAnyAlert).length;
    const totalAbsences = allSummaries.reduce((acc, s) => acc + s.totalGeneralAbsences, 0);
    const avgAbsences = totalStudents > 0 ? (totalAbsences / totalStudents).toFixed(1) : '0';

    return { totalStudents, alertStudents, totalAbsences, avgAbsences };
  }, [allSummaries]);

  // Handle confirming deletion of an individual absence record (Admin only)
  const handleConfirmDeleteRecord = (recordId: string) => {
    storage.deleteAbsenceRecord(recordId);
    setRecordToDelete(null);
    setLocalTick((t) => t + 1);
    onDataChanged();

    // Refresh current open student
    if (selectedStudentSummary) {
      const updated = storage.getStudentSummary(selectedStudentSummary.student.id, activePeriod.id);
      setSelectedStudentSummary(updated);
    }

    setModalFeedback('Registro de inasistencia eliminado con éxito. Se recalcularon las horas y alertas.');
    setTimeout(() => {
      setModalFeedback(null);
    }, 4500);
  };

  // Handle saving an individual manual absence (Admin only)
  const handleSaveIndividualAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentSummary || !newAbsenceSubjectId) return;

    storage.addAbsenceRecord({
      studentId: selectedStudentSummary.student.id,
      courseId: selectedStudentSummary.student.courseId,
      subjectId: newAbsenceSubjectId,
      periodId: activePeriod.id,
      date: newAbsenceDate,
      type: newAbsenceType,
      hours: newAbsenceHours,
      reason: newAbsenceReason.trim() || undefined,
      registeredBy: 'Administrador',
    });

    setLocalTick((t) => t + 1);
    onDataChanged();
    setIsAddAbsenceModalOpen(false);
    setNewAbsenceReason('');

    // Refresh selected student summary
    const updated = storage.getStudentSummary(selectedStudentSummary.student.id, activePeriod.id);
    setSelectedStudentSummary(updated);
    setModalFeedback('Nueva novedad de inasistencia anexada correctamente.');
    setTimeout(() => {
      setModalFeedback(null);
    }, 4500);
  };

  // Open modal for adding absence to currently inspected student
  const handleOpenAddAbsence = () => {
    if (selectedStudentSummary && selectedStudentSummary.subjectSummaries.length > 0) {
      setNewAbsenceSubjectId(selectedStudentSummary.subjectSummaries[0].subject.id);
      setIsAddAbsenceModalOpen(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-semibold mb-2">
              <BarChart3 className="w-4 h-4" />
              <span>Consolidado General • {activePeriod.name}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Control Consolidado de Fallas y Semáforo de Alertas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Alerta visual en <strong>rojo</strong> para estudiantes que superan el 50% de inasistencias permitidas.
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Estudiantes
            </span>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpis.totalStudents}</p>
          </div>

          <div className="p-3.5 bg-red-50 rounded-xl border border-red-200">
            <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              En Alerta (&gt;50%)
            </span>
            <p className="text-2xl font-black text-red-700 mt-1">{kpis.alertStudents}</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Horas Perdidas
            </span>
            <p className="text-2xl font-black text-slate-800 mt-1">{kpis.totalAbsences} h</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Promedio por Estudiante
            </span>
            <p className="text-2xl font-black text-indigo-700 mt-1">{kpis.avgAbsences} h</p>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o documento..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Course filter */}
          <div className="md:col-span-3">
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos los Cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Only Alerts (>50%) */}
          <div className="md:col-span-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOnlyAlerts(!onlyAlerts)}
              className={`w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                onlyAlerts
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Mostrar sólo Alertas (&gt;50%)</span>
              {onlyAlerts && <span className="ml-1 bg-red-800 px-1.5 py-0.2 rounded-full text-[10px]">ON</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main Consolidated Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Consolidado de Inasistencias ({filteredSummaries.length} estudiantes)
          </h3>
          <span className="text-xs text-slate-500">
            Resaltado en <strong className="text-red-600 font-bold">ROJO</strong> si supera el 50% de fallas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Estudiante</th>
                <th className="py-3 px-4">Curso</th>
                <th className="py-3 px-4 text-center">Fallas Totales</th>
                <th className="py-3 px-4">Materias Afectadas / Conteo (Fallas / Máx)</th>
                <th className="py-3 px-4 text-center">Estado Semáforo</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No se encontraron registros con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map((sum) => {
                  const hasAlert = sum.hasAnyAlert;

                  return (
                    <tr
                      key={sum.student.id}
                      className={`hover:bg-slate-50 transition ${
                        hasAlert ? 'bg-red-50/30' : ''
                      }`}
                    >
                      {/* Name & Document */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{sum.student.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                            {sum.student.documentType || 'TI'}
                          </span>
                          <span>{sum.student.document}</span>
                        </div>
                      </td>

                      {/* Course */}
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {sum.course?.name || 'N/A'}
                      </td>

                      {/* Total Absences */}
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-black text-slate-800">
                          {sum.totalGeneralAbsences}
                        </span>
                        <span className="text-[11px] text-slate-400 block">horas</span>
                      </td>

                      {/* Subject breakdown tags */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {sum.subjectSummaries.map((sub) => {
                            if (sub.totalAbsences === 0) return null;
                            const isAlert = sub.isOverThreshold; // > 50%

                            return (
                              <span
                                key={sub.subject.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition ${
                                  isAlert
                                    ? 'bg-red-600 text-white border-red-700 shadow-xs ring-1 ring-red-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                                title={`${sub.subject.name}: ${sub.totalAbsences} fallas de ${sub.maxAllowed} permitidas (${sub.percentUsed}%)`}
                              >
                                {isAlert && <AlertTriangle className="w-3 h-3 text-white shrink-0" />}
                                <span>{sub.subject.name.split(' ')[0]}</span>
                                <span className="font-black">
                                  {sub.totalAbsences}/{sub.maxAllowed}
                                </span>
                              </span>
                            );
                          })}
                          {sum.totalGeneralAbsences === 0 && (
                            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Sin inasistencias
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {hasAlert ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            ALERTA &gt;50%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onConsultStudent && (
                            <button
                              type="button"
                              onClick={() => onConsultStudent(sum.student.id)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              title="Consultar en el Portal de Estudiante / Comunidad"
                            >
                              <Search className="w-3.5 h-3.5" />
                              <span>Consultar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedStudentSummary(sum)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Ver detalles e historial completo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detalles</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Detail Modal */}
      {selectedStudentSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            {/* Modal Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold">
                  {selectedStudentSummary.student.name}
                </h3>
                <p className="text-xs text-slate-300">
                  Documento: {selectedStudentSummary.student.document} • {selectedStudentSummary.course?.name} • {activePeriod.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentSummary(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* In-Modal Notification Banner */}
              {modalFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{modalFeedback}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalFeedback(null)}
                    className="text-emerald-600 hover:text-emerald-800 p-0.5 rounded cursor-pointer"
                    title="Cerrar mensaje"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Alert Banner if > 50% */}
              {selectedStudentSummary.hasAnyAlert && (
                <div className="p-3.5 bg-red-50 border-2 border-red-500 rounded-xl flex items-start gap-3 text-red-900">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-800">
                      Alerta Crítica: Supera el 50% de inasistencias en una o más materias
                    </h4>
                    <p className="text-xs text-red-700 mt-0.5">
                      El estudiante corre riesgo de reprobar la asignatura por inasistencias acumuladas.
                    </p>
                  </div>
                </div>
              )}

              {/* Subject Breakdown */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Consolidado por Materias
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedStudentSummary.subjectSummaries.map((sub) => {
                    const isAlert = sub.isOverThreshold;
                    return (
                      <div
                        key={sub.subject.id}
                        className={`p-3 rounded-xl border ${
                          isAlert
                            ? 'bg-red-50/80 border-red-400'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isAlert ? 'text-red-900' : 'text-slate-800'}`}>
                            {sub.subject.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                              isAlert
                                ? 'bg-red-600 text-white'
                                : 'bg-white text-slate-700 border border-slate-200'
                            }`}
                          >
                            {sub.totalAbsences} / {sub.maxAllowed}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isAlert ? 'bg-red-600' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, sub.percentUsed)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>{sub.percentUsed}% acumulado</span>
                          <span>{Math.max(0, sub.maxAllowed - sub.totalAbsences)} restantes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Individual History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Historial de Registros ({selectedStudentSummary.records.length})
                  </h4>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleOpenAddAbsence}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Anexar Falla Individual</span>
                    </button>
                  )}
                </div>

                {selectedStudentSummary.records.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg text-center">
                    No tiene fallas registradas en este periodo.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Fecha</th>
                          <th className="py-2 px-3">Materia</th>
                          <th className="py-2 px-3">Tipo</th>
                          <th className="py-2 px-3 text-center">Horas</th>
                          <th className="py-2 px-3">Motivo / Observación</th>
                          {isAdmin && <th className="py-2 px-3 text-right">Acción</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedStudentSummary.records.map((rec) => {
                          const subName = selectedStudentSummary.subjectSummaries.find(
                            (s) => s.subject.id === rec.subjectId
                          )?.subject.name || 'Materia';

                          return (
                            <tr key={rec.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-slate-700">{rec.date}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{subName}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    rec.type === 'falla'
                                      ? 'bg-red-100 text-red-700'
                                      : rec.type === 'justificada'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {rec.type === 'falla'
                                    ? 'Falla'
                                    : rec.type === 'justificada'
                                    ? 'Justificada'
                                    : 'Retardo'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center font-bold">{rec.hours} h</td>
                              <td className="py-2 px-3 text-slate-500 italic">
                                {rec.reason || 'Sin observación'}
                              </td>
                              {isAdmin && (
                                <td className="py-2 px-3 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRecordToDelete({
                                        id: rec.id,
                                        date: rec.date,
                                        subjectName: subName,
                                        hours: rec.hours || 1,
                                        type: rec.type,
                                        reason: rec.reason,
                                      })
                                    }
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-red-600 hover:text-white hover:bg-red-600 bg-red-50/80 border border-red-200 hover:border-red-600 rounded-lg transition text-xs font-semibold cursor-pointer shadow-2xs group"
                                    title="Eliminar este registro de inasistencia"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 shrink-0 text-red-600 group-hover:text-white" />
                                    <span>Eliminar</span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action Buttons: Export */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      exportStudentReportPDF(selectedStudentSummary, config, activePeriod.name)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Boletín PDF</span>
                  </button>
                  <button
                    onClick={() =>
                      exportStudentReportExcel(selectedStudentSummary, config, activePeriod.name)
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel</span>
                  </button>
                  {onConsultStudent && (
                    <button
                      onClick={() => {
                        const stId = selectedStudentSummary.student.id;
                        setSelectedStudentSummary(null);
                        onConsultStudent(stId);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer transition"
                      title="Abrir en Portal de Consulta de Estudiante / Comunidad"
                    >
                      <Search className="w-4 h-4" />
                      <span>Ver en Portal Comunidad</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setSelectedStudentSummary(null)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Delete Record */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-200 overflow-hidden">
            <div className="bg-red-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-white" />
                <h3 className="font-bold text-sm">¿Eliminar este registro de inasistencia?</h3>
              </div>
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="text-red-100 hover:text-white p-1 rounded-lg hover:bg-red-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Se eliminará permanentemente el registro de inasistencia del estudiante{' '}
                <strong>{selectedStudentSummary?.student.name}</strong>:
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Materia:</span>
                  <span className="font-bold text-slate-800">{recordToDelete.subjectName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Fecha:</span>
                  <span className="font-mono font-semibold text-slate-800">{recordToDelete.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Tipo:</span>
                  <span className={`font-bold ${
                    recordToDelete.type === 'falla' ? 'text-red-600' : recordToDelete.type === 'justificada' ? 'text-blue-600' : 'text-amber-600'
                  }`}>
                    {recordToDelete.type === 'falla' ? 'Falla Injustificada' : recordToDelete.type === 'justificada' ? 'Falla Justificada' : 'Retardo / Tardanza'} ({recordToDelete.hours} {recordToDelete.hours === 1 ? 'hora' : 'horas'})
                  </span>
                </div>
                {recordToDelete.reason && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                    <span className="not-italic font-medium text-slate-500">Observación: </span>
                    "{recordToDelete.reason}"
                  </div>
                )}
              </div>

              <div className="text-[11px] text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Al eliminar este registro, las horas se descontarán del total acumulado y se recalcularán automáticamente las alertas de riesgo (&gt;50%).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRecordToDelete(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteRecord(recordToDelete.id)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-600/25 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Eliminar Registro</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Single Absence Modal (Admin Only) */}
      {isAddAbsenceModalOpen && selectedStudentSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Anexar Novedad de Inasistencia</h3>
              <button
                onClick={() => setIsAddAbsenceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIndividualAbsence} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Materia</label>
                <select
                  value={newAbsenceSubjectId}
                  onChange={(e) => setNewAbsenceSubjectId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  {selectedStudentSummary.subjectSummaries.map((s) => (
                    <option key={s.subject.id} value={s.subject.id}>
                      {s.subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={newAbsenceDate}
                    onChange={(e) => setNewAbsenceDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Horas</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    required
                    value={newAbsenceHours}
                    onChange={(e) => setNewAbsenceHours(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Novedad</label>
                <select
                  value={newAbsenceType}
                  onChange={(e) => setNewAbsenceType(e.target.value as AbsenceType)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="falla">Falla Injustificada (Suma a alerta)</option>
                  <option value="justificada">Falla Justificada</option>
                  <option value="retardo">Retardo / Tardanza</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo / Observación
                </label>
                <input
                  type="text"
                  value={newAbsenceReason}
                  onChange={(e) => setNewAbsenceReason(e.target.value)}
                  placeholder="Ej: Incapacidad médica, cita odontológica..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAbsenceModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  Guardar Novedad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
