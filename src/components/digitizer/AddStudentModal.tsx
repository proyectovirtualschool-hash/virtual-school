import React, { useState } from 'react';
import { AlertCircle, UserPlus, X } from 'lucide-react';
import { DOCUMENT_TYPES, Student } from '../../types';
import { storage } from '../../services/storage';
import { cleanDocument } from '../../services/digitizer/textUtils';

interface AddStudentModalProps {
  isOpen: boolean;
  courseId: string;
  initialName: string;
  initialDocument?: string;
  onClose: () => void;
  onCreated: (student: Student) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  courseId,
  initialName,
  initialDocument,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState(initialName);
  const [document, setDocument] = useState(initialDocument || '');
  const [documentType, setDocumentType] = useState('TI');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!document.trim()) {
      setError('El documento es obligatorio. No se permiten documentos inventados.');
      return;
    }
    if (storage.hasStudentDocument(document)) {
      setError('Ya existe un estudiante con ese documento.');
      return;
    }
    try {
      const student = storage.saveStudent({
        name: name.trim(),
        document: document.trim(),
        documentType,
        courseId,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        status: 'activo',
      });
      onCreated(student);
      onClose();
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo crear el estudiante.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Agregar estudiante real</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            Solo agrega estudiantes con documentos reales. El digitalizador nunca crea datos automáticamente.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre completo *</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del estudiante"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Documento *</label>
              <input
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Número real"
              />
              {document && storage.hasStudentDocument(document) && (
                <p className="text-[11px] text-rose-600 mt-1">
                  Documento ya registrado ({cleanDocument(document)}).
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Acudiente</label>
              <input
                value={guardianName}
                onChange={(event) => setGuardianName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
              <input
                value={guardianPhone}
                onChange={(event) => setGuardianPhone(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
          </div>
          {error && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
            >
              Crear y cotejar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
