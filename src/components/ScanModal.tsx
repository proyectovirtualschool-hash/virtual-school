import React, { useEffect, useState } from 'react';
import { AlertTriangle, ScanLine, X } from 'lucide-react';
import { Student, Course, Subject, AbsenceType } from '../types';
import { storage } from '../services/storage';
import { persistDigitizedResult } from '../services/digitizer/persistence';
import { DigitizerMetrics, DigitizerResult } from '../services/digitizer/types';
import { DigitizerWizard } from './digitizer/DigitizerWizard';

export interface ScanRecordItem {
  sheetIndex?: number;
  studentName: string;
  document?: string;
  markDetected?: string;
  status: 'falla' | 'presente' | 'justificada' | 'retardo';
  confidence: string;
  observation?: string;
  hours?: number;
  matchedStudentId?: string;
  isNewStudent?: boolean;
}

export interface ScanApplyPayload {
  date?: string;
  courseId?: string;
  subjectId?: string;
  hours?: number;
  generalObservations?: string;
  sheetTitle?: string;
  autoSavedDirectly?: boolean;
  newStudentsCreatedCount?: number;
  digitizationId?: string;
  metrics?: DigitizerMetrics;
  alreadyPersisted?: boolean;
  unresolvedCount?: number;
  records: {
    studentId: string;
    studentName: string;
    document?: string;
    status: 'presente' | AbsenceType;
    hours: number;
    reason?: string;
  }[];
}

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  courses: Course[];
  subjects: Subject[];
  selectedCourseId: string;
  selectedSubjectId: string;
  currentDate: string;
  currentHours: number;
  onApplyResults: (payload: ScanApplyPayload) => void;
  onDirectSaveSuccess?: (summaryMessage: string) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  selectedCourseId,
  selectedSubjectId,
  currentDate,
  currentHours,
  onApplyResults,
  onDirectSaveSuccess,
}) => {
  const [sessionKey, setSessionKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSessionKey((value) => value + 1);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = (result: DigitizerResult) => {
    try {
      const activeRows = result.rows.filter((row) => !row.excluded);
      const activePeriod = storage.getActivePeriod();
      const { entry, saveResult } = persistDigitizedResult(result, {
        periodId: activePeriod.id,
        registeredBy: result.header.teacher || 'Digitalizador automático',
      });

      const payload: ScanApplyPayload = {
        date: result.header.date,
        courseId: result.header.courseId,
        subjectId: result.header.subjectId,
        hours: result.header.hours,
        generalObservations: result.header.notes,
        sheetTitle: result.header.title,
        autoSavedDirectly: true,
        alreadyPersisted: true,
        newStudentsCreatedCount: 0,
        digitizationId: entry.id,
        metrics: entry.metrics,
        unresolvedCount: 0,
        records: activeRows.map((row) => ({
          studentId: row.matchedStudentId || '',
          studentName: row.studentName,
          document: row.document,
          status: row.status as 'presente' | AbsenceType,
          hours: row.hours,
          reason: row.observation?.trim() || undefined,
        })),
      };

      const summary = `Planilla digitalizada y guardada. ${saveResult.inserted} novedad(es) registrada(s) en ${entry.subjectName} · ${entry.courseName} (${entry.date})` +
        (saveResult.skipped > 0 ? ` · ${saveResult.skipped} fila(s) ya existían.` : '.');

      onApplyResults(payload);
      if (onDirectSaveSuccess) onDirectSaveSuccess(summary);
      onClose();
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo guardar la digitalización.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto my-2 sm:my-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <ScanLine className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold">Digitalizador de planillas</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            aria-label="Cerrar digitalizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-rose-600 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <DigitizerWizard
          key={sessionKey}
          initialCourseId={selectedCourseId}
          initialSubjectId={selectedSubjectId}
          initialDate={currentDate}
          initialHours={currentHours}
          confirmLabel="Confirmar y guardar en el sistema"
          onCancel={onClose}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
};
