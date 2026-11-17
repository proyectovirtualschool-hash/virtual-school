import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  Users, 
  Check, 
  AlertTriangle,
  Layers
} from 'lucide-react';
import { Course, Subject } from '../types';
import { storage } from '../services/storage';

interface AcademicManagementProps {
  onDataChanged: () => void;
  dataVersion?: number;
}

interface CourseDeleteTarget {
  id: string;
  name: string;
  code: string;
  studentCount: number;
  subjectsCount: number;
}

interface SubjectDeleteTarget {
  id: string;
  name: string;
  code: string;
}

export const AcademicManagement: React.FC<AcademicManagementProps> = ({ onDataChanged, dataVersion }) => {
  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'subjects'>('courses');
  const [courses, setCourses] = useState<Course[]>(() => storage.getCourses());
  const [subjects, setSubjects] = useState<Subject[]>(() => storage.getSubjects());

  // Notification Banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Deletion modals state
  const [courseToDelete, setCourseToDelete] = useState<CourseDeleteTarget | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectDeleteTarget | null>(null);

  // Course Modal
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cLevel, setCLevel] = useState('Educación Media');
  const [cDirector, setCDirector] = useState('');
  const [cDescription, setCDescription] = useState('');

  // Subject Modal
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectFormError, setSubjectFormError] = useState<string | null>(null);
  const [sName, setSName] = useState('');
  const [sCode, setSCode] = useState('');
  const [sMaxAbsences, setSMaxAbsences] = useState(20);
  const [sWeeklyHours, setSWeeklyHours] = useState(4);
  const [sCourseIds, setSCourseIds] = useState<string[]>([]);

  const reloadData = () => {
    setCourses(storage.getCourses());
    setSubjects(storage.getSubjects());
    onDataChanged();
  };

  useEffect(() => {
    if (dataVersion !== undefined) {
      setCourses(storage.getCourses());
      setSubjects(storage.getSubjects());
    }
  }, [dataVersion]);

  // --- Courses Handlers ---
  const handleOpenAddCourse = () => {
    setEditingCourse(null);
    setCourseFormError(null);
    setCName('');
    setCCode('');
    setCLevel('Educación Media');
    setCDirector('');
    setCDescription('');
    setIsCourseModalOpen(true);
  };

  const handleOpenEditCourse = (c: Course) => {
    setEditingCourse(c);
    setCourseFormError(null);
    setCName(c.name);
    setCCode(c.code);
    setCLevel(c.level);
    setCDirector(c.directorName || '');
    setCDescription(c.description || '');
    setIsCourseModalOpen(true);
  };

  const handleDeleteCourse = (course: Course) => {
    const studentCount = storage.getStudentsByCourse(course.id).length;
    const subjectsCount = storage.getSubjectsByCourse(course.id).length;
    setCourseToDelete({
      id: course.id,
      name: course.name,
      code: course.code,
      studentCount,
      subjectsCount,
    });
  };

  const [deleteCourseMode, setDeleteCourseMode] = useState<'none' | 'force' | 'reassign'>('none');
  const [reassignToCourseId, setReassignToCourseId] = useState<string>('');

  const handleConfirmDeleteCourse = () => {
    if (!courseToDelete) return;
    const courseName = courseToDelete.name;
    try {
      if (courseToDelete.studentCount > 0) {
        if (deleteCourseMode === 'reassign' && reassignToCourseId) {
          const result = storage.deleteCourse(courseToDelete.id, { reassignToCourseId });
          if (!result.ok) {
            setNotification({ type: 'error', message: result.reason || 'Error al eliminar curso' });
            return;
          }
          setNotification({
            type: 'success',
            message: `El curso "${courseName}" fue eliminado. Los estudiantes activos fueron reasignados correctamente.`,
          });
        } else {
          // Default: mark as inactive
          const result = storage.deleteCourse(courseToDelete.id, { force: true });
          if (!result.ok) {
            setNotification({ type: 'error', message: result.reason || 'Error al eliminar curso' });
            return;
          }
          setNotification({
            type: 'success',
            message: `El curso "${courseName}" fue eliminado. Los estudiantes activos fueron marcados como inactivos.`,
          });
        }
      } else {
        const result = storage.deleteCourse(courseToDelete.id);
        if (!result.ok) {
          setNotification({ type: 'error', message: result.reason || 'Error al eliminar curso' });
          return;
        }
        setNotification({
          type: 'success',
          message: `El curso "${courseName}" fue eliminado correctamente.`,
        });
      }
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message || 'Error al eliminar curso' });
      setCourseToDelete(null);
      setDeleteCourseMode('none');
      setReassignToCourseId('');
      return;
    }
    setCourseToDelete(null);
    setDeleteCourseMode('none');
    setReassignToCourseId('');
    reloadData();
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim() || !cCode.trim()) {
      setCourseFormError('Por favor complete el nombre y código del curso.');
      return;
    }

    try {
      storage.saveCourse({
        id: editingCourse?.id,
        name: cName.trim(),
        code: cCode.trim(),
        level: cLevel,
        directorName: cDirector.trim() || undefined,
        description: cDescription.trim() || undefined,
      });

      setIsCourseModalOpen(false);
      setNotification({
        type: 'success',
        message: editingCourse
          ? `El curso "${cName.trim()}" fue actualizado correctamente.`
          : `El curso "${cName.trim()}" fue creado exitosamente.`,
      });
      reloadData();
    } catch (err: any) {
      setCourseFormError(err.message || 'Error al guardar el curso');
    }
  };

  // --- Subjects Handlers ---
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubjectFormError(null);
    setSName('');
    setSCode('');
    setSMaxAbsences(20);
    setSWeeklyHours(4);
    setSCourseIds(courses.map((c) => c.id));
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (s: Subject) => {
    setEditingSubject(s);
    setSubjectFormError(null);
    setSName(s.name);
    setSCode(s.code);
    setSMaxAbsences(s.maxAbsences || 20);
    setSWeeklyHours(s.weeklyHours || 4);
    setSCourseIds(s.courseIds || []);
    setIsSubjectModalOpen(true);
  };

  const handleDeleteSubject = (s: Subject) => {
    setSubjectToDelete({
      id: s.id,
      name: s.name,
      code: s.code,
    });
  };

  const handleConfirmDeleteSubject = () => {
    if (!subjectToDelete) return;
    const subName = subjectToDelete.name;
    storage.deleteSubject(subjectToDelete.id);
    setSubjectToDelete(null);
    setNotification({
      type: 'success',
      message: `La materia "${subName}" fue eliminada correctamente.`,
    });
    reloadData();
  };

  const handleToggleCourseInSubject = (cId: string) => {
    setSCourseIds((prev) =>
      prev.includes(cId) ? prev.filter((id) => id !== cId) : [...prev, cId]
    );
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName.trim() || !sCode.trim() || sCourseIds.length === 0) {
      setSubjectFormError('Por favor complete Nombre, Código y seleccione al menos un Curso.');
      return;
    }

    try {
      storage.saveSubject({
        id: editingSubject?.id,
        name: sName.trim(),
        code: sCode.trim(),
        maxAbsences: sMaxAbsences,
        weeklyHours: sWeeklyHours,
        courseIds: sCourseIds,
      });

      setIsSubjectModalOpen(false);
      setNotification({
        type: 'success',
        message: editingSubject
          ? `La materia "${sName.trim()}" fue actualizada correctamente.`
          : `La materia "${sName.trim()}" fue creada exitosamente.`,
      });
      reloadData();
    } catch (err: any) {
      setSubjectFormError(err.message || 'Error al guardar la materia');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
            <Layers className="w-4 h-4" />
            <span>Malla Curricular y Organización</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Cursos y Materias
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Defina los límites de fallas permitidas por materia y los cursos correspondientes.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('courses')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'courses'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Cursos ({courses.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('subjects')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'subjects'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Materias ({subjects.length})</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            title="Cerrar notificación"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* COURSES TAB */}
      {activeSubTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Listado de Cursos y Grados
            </h3>
            <button
              onClick={handleOpenAddCourse}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nuevo Curso</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {courses.map((course) => {
              const studentsCount = storage.getStudentsByCourse(course.id).length;
              const courseSubjects = storage.getSubjectsByCourse(course.id);

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-300 transition"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          {course.code}
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-2">
                          {course.name}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">{course.level}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditCourse(course)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Editar curso"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                          title="Eliminar curso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {course.directorName && (
                      <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                        <strong>Director:</strong> {course.directorName}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <strong>{studentsCount}</strong> alumnos
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <strong>{courseSubjects.length}</strong> materias
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBJECTS TAB */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Materias y Límite de Fallas Permitidas
              </h3>
              <p className="text-xs text-slate-500">
                La alerta roja se disparará automáticamente cuando un alumno supere el 50% de las fallas permitidas.
              </p>
            </div>
            <button
              onClick={handleOpenAddSubject}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Materia</span>
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Asignatura</th>
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4 text-center">Horas Semanales</th>
                    <th className="py-2.5 px-4 text-center">Máximo Fallas Permitidas</th>
                    <th className="py-2.5 px-4 text-center">Umbral Alerta Roja (50%)</th>
                    <th className="py-2.5 px-4">Cursos Asociados</th>
                    <th className="py-2.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.map((sub) => {
                    const alertThreshold = Math.ceil(sub.maxAbsences * 0.5);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {sub.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {sub.code}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-700">
                          {sub.weeklyHours} h
                        </td>
                        <td className="py-3 px-4 text-center font-black text-slate-800">
                          <span className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                            {sub.maxAbsences} fallas
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center justify-center gap-1 mx-auto max-w-[110px]">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            &gt; {alertThreshold} fallas
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {sub.courseIds.map((cId) => {
                              const cName = courses.find((c) => c.id === cId)?.name || cId;
                              return (
                                <span
                                  key={cId}
                                  className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold border border-blue-200"
                                >
                                  {cName}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubject(sub)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Editar materia"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(sub)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Eliminar materia"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCourseModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {courseFormError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{courseFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCourse} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  required
                  value={cName}
                  onChange={(e) => {
                    setCName(e.target.value);
                    if (courseFormError) setCourseFormError(null);
                  }}
                  placeholder="Ej: Grado 10°A"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código Breve *
                  </label>
                  <input
                    type="text"
                    required
                    value={cCode}
                    onChange={(e) => {
                      setCCode(e.target.value);
                      if (courseFormError) setCourseFormError(null);
                    }}
                    placeholder="10-A"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nivel
                  </label>
                  <select
                    value={cLevel}
                    onChange={(e) => setCLevel(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="Básica Secundaria">Básica Secundaria</option>
                    <option value="Educación Media">Educación Media</option>
                    <option value="Primaria">Primaria</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Director de Grupo (Docente)
                </label>
                <input
                  type="text"
                  value={cDirector}
                  onChange={(e) => setCDirector(e.target.value)}
                  placeholder="Prof. Carlos Mendoza"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción / Aula
                </label>
                <input
                  type="text"
                  value={cDescription}
                  onChange={(e) => setCDescription(e.target.value)}
                  placeholder="Jornada Mañana - Salón 204"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
                >
                  Guardar Curso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Modal */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {subjectFormError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{subjectFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubject} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Asignatura *
                </label>
                <input
                  type="text"
                  required
                  value={sName}
                  onChange={(e) => {
                    setSName(e.target.value);
                    if (subjectFormError) setSubjectFormError(null);
                  }}
                  placeholder="Ej: Inglés Extranjero"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Código *
                  </label>
                  <input
                    type="text"
                    required
                    value={sCode}
                    onChange={(e) => {
                      setSCode(e.target.value);
                      if (subjectFormError) setSubjectFormError(null);
                    }}
                    placeholder="ING-10"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Horas/Semana
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={sWeeklyHours}
                    onChange={(e) => setSWeeklyHours(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-red-600">
                    Máx. Fallas *
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    required
                    value={sMaxAbsences}
                    onChange={(e) => setSMaxAbsences(parseInt(e.target.value) || 20)}
                    className="w-full p-2 bg-red-50 border border-red-300 rounded-lg text-xs font-bold text-red-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cursos que toman esta materia:
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {courses.map((c) => {
                    const isChecked = sCourseIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCourseInSubject(c.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{c.name} ({c.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition"
                >
                  Guardar Materia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-100" />
                <h3 className="font-bold text-sm">Eliminar Curso</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCourseToDelete(null);
                  setDeleteCourseMode('none');
                  setReassignToCourseId('');
                }}
                className="text-red-100 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  ¿Está seguro de que desea eliminar el curso{' '}
                  <strong className="text-slate-900 font-bold">"{courseToDelete.name}"</strong>{' '}
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    {courseToDelete.code}
                  </span>?
                </p>
              </div>

              {courseToDelete.studentCount > 0 ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Este curso tiene estudiantes activos</strong>
                      <p className="mt-0.5 leading-relaxed">
                        Hay <span className="font-bold">{courseToDelete.studentCount} estudiante(s) activo(s)</span> en este curso.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700">¿Qué deseas hacer con ellos?</p>
                    <div className="space-y-2">
                      <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${deleteCourseMode === 'none' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input
                          type="radio"
                          name="deleteCourseAction"
                          checked={deleteCourseMode === 'none'}
                          onChange={() => setDeleteCourseMode('none')}
                          className="mt-0.5"
                        />
                        <div className="text-xs">
                          <div className="font-semibold text-slate-900">Marcar como inactivos (recomendado)</div>
                          <div className="text-slate-600">Los estudiantes permanecerán en el sistema con estado inactivo.</div>
                        </div>
                      </label>
                      <label className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition ${deleteCourseMode === 'reassign' ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <input
                          type="radio"
                          name="deleteCourseAction"
                          checked={deleteCourseMode === 'reassign'}
                          onChange={() => setDeleteCourseMode('reassign')}
                          className="mt-0.5"
                        />
                        <div className="text-xs flex-1">
                          <div className="font-semibold text-slate-900">Reasignar a otro curso</div>
                          <div className="text-slate-600 mb-2">Mover estudiantes activos al curso seleccionado.</div>
                          {deleteCourseMode === 'reassign' && (
                            <select
                              value={reassignToCourseId}
                              onChange={(e) => setReassignToCourseId(e.target.value)}
                              className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="">Selecciona un curso...</option>
                              {courses.filter(c => c.id !== courseToDelete.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Este curso no tiene estudiantes registrados actualmente. La eliminación es segura.</span>
                </div>
              )}

              {courseToDelete.subjectsCount > 0 && (
                <p className="text-xs text-slate-500">
                  El curso se desvinculará automáticamente de las {courseToDelete.subjectsCount} materia(s) asociadas.
                </p>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setCourseToDelete(null);
                    setDeleteCourseMode('none');
                    setReassignToCourseId('');
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCourse}
                  disabled={courseToDelete.studentCount > 0 && deleteCourseMode === 'reassign' && !reassignToCourseId}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, Eliminar Curso</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation Modal */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-red-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-100" />
                <h3 className="font-bold text-sm">Eliminar Asignatura</h3>
              </div>
              <button
                type="button"
                onClick={() => setSubjectToDelete(null)}
                className="text-red-100 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                ¿Está seguro de que desea eliminar la asignatura{' '}
                <strong className="text-slate-900 font-bold">"{subjectToDelete.name}"</strong>{' '}
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  {subjectToDelete.code}
                </span>?
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                Esta acción retirará la materia del plan de estudios. Los historiales previos de asistencia se mantendrán protegidos.
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSubjectToDelete(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSubject}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, Eliminar Materia</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
