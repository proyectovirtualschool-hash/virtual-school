import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  GraduationCap,
  Phone,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { Student, Course, DOCUMENT_TYPES } from '../types';
import { storage } from '../services/storage';

interface StudentManagementProps {
  dataVersion?: number;
  onDataChanged: () => void;
  onConsultStudent?: (studentId: string) => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({ 
  dataVersion, 
  onDataChanged, 
  onConsultStudent 
}) => {
  const [courses, setCourses] = useState<Course[]>(() => storage.getCourses());
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [localVersion, setLocalVersion] = useState<number>(0);

  // User feedback toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<string>('TI');
  const [document, setDocument] = useState('');
  const [courseId, setCourseId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'activo' | 'inactivo'>('activo');

  // Delete modal state
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Batch import modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchCourseId, setBatchCourseId] = useState(courses[0]?.id || '');
  const [batchText, setBatchText] = useState('');
  const [batchMessage, setBatchMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync courses whenever external dataVersion changes
  useEffect(() => {
    const freshCourses = storage.getCourses();
    setCourses(freshCourses);
    if (!batchCourseId && freshCourses.length > 0) {
      setBatchCourseId(freshCourses[0].id);
    }
  }, [dataVersion]);

  // Reload courses & trigger state update
  const refresh = () => {
    setCourses(storage.getCourses());
    setLocalVersion((v) => v + 1);
    onDataChanged();
  };

  const filteredStudents = useMemo(() => {
    return storage.searchStudents(searchQuery, selectedCourseId === 'all' ? undefined : selectedCourseId);
  }, [searchQuery, selectedCourseId, localVersion, dataVersion]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setName('');
    setDocumentType('TI');
    setDocument('');
    setCourseId(courses[0]?.id || '');
    setGuardianName('');
    setGuardianPhone('');
    setEmail('');
    setStatus('activo');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: Student) => {
    setEditingStudent(st);
    setName(st.name || '');
    setDocumentType(st.documentType || 'TI');
    setDocument(st.document || '');
    setCourseId(st.courseId || courses[0]?.id || '');
    setGuardianName(st.guardianName || '');
    setGuardianPhone(st.guardianPhone || '');
    setEmail(st.email || '');
    setStatus(st.status || 'activo');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleRequestDelete = (id: string, stName: string) => {
    setStudentToDelete({ id, name: stName });
  };

  const handleConfirmDelete = () => {
    if (studentToDelete) {
      storage.deleteStudent(studentToDelete.id);
      setToastMessage({
        text: `Estudiante "${studentToDelete.name}" eliminado correctamente.`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
      setStudentToDelete(null);
      refresh();
    }
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanDoc = document.trim();

    if (!cleanName) {
      setFormError('Por favor complete el Nombre Completo del estudiante.');
      return;
    }
    if (!cleanDoc) {
      setFormError('Por favor complete el Documento de Identidad.');
      return;
    }
    if (!courseId) {
      setFormError('Por favor seleccione un Curso Asignado.');
      return;
    }

    // Check for document duplicates with another student
    const existing = storage.getStudents().find(
      (s) => s.document.trim().toLowerCase() === cleanDoc.toLowerCase() && s.id !== editingStudent?.id
    );
    if (existing) {
      setFormError(`El documento "${cleanDoc}" ya se encuentra asignado a "${existing.name}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      storage.saveStudent({
        id: editingStudent?.id,
        name: cleanName,
        document: cleanDoc,
        documentType,
        courseId,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        email: email.trim() || undefined,
        status,
      });

      setIsModalOpen(false);
      refresh();
      setToastMessage({
        text: editingStudent 
          ? `¡Datos de "${cleanName}" actualizados con éxito!` 
          : `¡Estudiante "${cleanName}" registrado con éxito!`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Error al guardar los datos del estudiante.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Process batch import
  const handleProcessBatch = () => {
    setBatchMessage(null);
    if (!batchCourseId) {
      setBatchMessage({ text: 'Seleccione un curso de destino.', type: 'error' });
      return;
    }

    const lines = batchText.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setBatchMessage({ text: 'Ingrese al menos un estudiante en la lista.', type: 'error' });
      return;
    }

    let addedCount = 0;
    lines.forEach((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      if (parts.length >= 2) {
        const studentName = parts[0];
        const studentDoc = parts[1];
        if (studentName && studentDoc) {
          storage.saveStudent({
            name: studentName,
            document: studentDoc,
            documentType: (parts[2] as any) || 'TI',
            courseId: batchCourseId,
            status: 'activo',
          });
          addedCount++;
        }
      }
    });

    if (addedCount > 0) {
      refresh();
      setIsBatchModalOpen(false);
      setBatchText('');
      setToastMessage({
        text: `Se importaron ${addedCount} estudiante(s) con éxito.`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setBatchMessage({
        text: 'No se detectaron registros válidos. Use formato: Nombre Completo, Documento por línea.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Feedback */}
      {toastMessage && (
        <div 
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
            <Users className="w-4 h-4" />
            <span>Directorio y Matrícula</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Gestión de Estudiantes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cree, edite o asigne estudiantes. Quedan automáticamente matriculados en las materias de su curso.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBatchMessage(null);
              setIsBatchModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Importar Lista Masiva</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Estudiante</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, documento o acudiente..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos los Cursos ({courses.length})</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Estudiantes Registrados ({filteredStudents.length})
          </h3>
          <span className="text-xs text-slate-500">Gestión autorizada para Administrador</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Estudiante</th>
                <th className="py-2.5 px-4">Documento</th>
                <th className="py-2.5 px-4">Curso Asignado</th>
                <th className="py-2.5 px-4">Acudiente y Contacto</th>
                <th className="py-2.5 px-4 text-center">Estado</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No hay estudiantes registrados o coincidentes con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => {
                  const courseName = courses.find((c) => c.id === st.courseId)?.name || 'Sin curso';

                  return (
                    <tr key={st.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[11px] shrink-0">
                          {st.name.charAt(0)}
                        </div>
                        <div>
                          <span>{st.name}</span>
                          {st.email && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {st.email}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200 mr-1.5">
                          {st.documentType || 'TI'}
                        </span>
                        <span>{st.document}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                          {courseName}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {st.guardianName ? (
                          <div>
                            <span className="font-medium text-slate-800 block">
                              {st.guardianName}
                            </span>
                            {st.guardianPhone && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {st.guardianPhone}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No registrado</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            st.status === 'activo'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {st.status === 'activo' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onConsultStudent && (
                            <button
                              onClick={() => onConsultStudent(st.id)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Consultar historial de inasistencias en el portal de comunidad"
                            >
                              <Search className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(st)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Editar estudiante"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRequestDelete(st.id, st.name)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Eliminar estudiante"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Add / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">
                  {editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}
                </h3>
                <p className="text-xs text-slate-300">
                  {editingStudent
                    ? `Modifique los datos de "${editingStudent.name}"`
                    : 'Complete la ficha académica del nuevo estudiante'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form noValidate onSubmit={handleSaveStudent} className="p-6 space-y-4">
              {/* Error Banner */}
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="font-medium">{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Sofía Valentina Gómez"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tipo de Doc. *
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {DOCUMENT_TYPES.map((dt) => (
                      <option key={dt.code} value={dt.code}>
                        {dt.code} - {dt.label.split(' - ')[1] || dt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. de Documento *
                  </label>
                  <input
                    type="text"
                    required
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    placeholder="Ej: 1025849632"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Curso Asignado *
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {courses.length === 0 ? (
                      <option value="">No hay cursos creados</option>
                    ) : (
                      courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombre del Acudiente
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Madre / Padre / Tutor"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono Acudiente
                  </label>
                  <input
                    type="tel"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="315 123 4567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="estudiante@colegio.edu.co"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estado del Estudiante
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="activo">Activo (Matriculado)</option>
                    <option value="inactivo">Inactivo / Retirado</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingStudent ? 'Actualizar Datos' : 'Registrar Estudiante'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Replaces blocked window.confirm) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">¿Eliminar estudiante?</h3>
                <p className="text-xs text-slate-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
              ¿Está seguro de eliminar al estudiante <span className="font-bold text-slate-900">{studentToDelete.name}</span> del sistema escolar?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                Sí, Eliminar Estudiante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Import Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Importación Masiva de Estudiantes</h3>
                <p className="text-xs text-slate-300">Agregue múltiples estudiantes rápidamente</p>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {batchMessage && (
                <div 
                  className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                    batchMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {batchMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{batchMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Curso al que se asignarán
                </label>
                <select
                  value={batchCourseId}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 cursor-pointer"
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
                  Pegue la lista (Formato: <code>Nombre Completo, Documento</code> por línea)
                </label>
                <textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`Andrés Felipe Castro, 1023456789\nMaría Paula Rincón, 1087654321\nDavid Leonardo Mora, 1056789123`}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Puede copiar directamente desde columnas de Excel (Nombre y Cédula/TI).
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleProcessBatch}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                >
                  Procesar e Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
