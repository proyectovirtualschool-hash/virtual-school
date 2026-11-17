import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  History,
  Search,
  Trash2,
} from 'lucide-react';
import { DigitizationHistoryEntry } from '../../services/digitizer/types';
import { statusLabel } from '../../services/digitizer/reconcile';

interface HistoryPanelProps {
  entries: DigitizationHistoryEntry[];
  onDelete: (id: string) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string): string {
  if (status === 'confirmada') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'cancelada') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
}

function rowStatusClass(status: string): string {
  switch (status) {
    case 'presente':
      return 'text-emerald-700';
    case 'falla':
      return 'text-rose-700';
    case 'retardo':
      return 'text-amber-700';
    case 'justificada':
      return 'text-blue-700';
    default:
      return 'text-slate-500';
  }
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ entries, onDelete }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) =>
      `${entry.fileName} ${entry.courseName} ${entry.subjectName} ${entry.date} ${entry.teacher}`
        .toLowerCase()
        .includes(query)
    );
  }, [entries, search]);

  const visible = showAll ? filtered : filtered.slice(0, 8);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Historial de digitalizaciones</h3>
            <p className="text-[11px] text-slate-500">
              {entries.length} registro(s) · se conserva la miniatura y el detalle, no la imagen completa
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar archivo, curso o fecha..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          Todavía no hay planillas digitalizadas confirmadas.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id}>
                <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="w-full sm:w-24 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                    {entry.thumbnail ? (
                      <img src={entry.thumbnail} alt="Miniatura" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 text-sm truncate">{entry.fileName}</p>
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${statusBadge(entry.status)}`}>
                        {entry.status === 'confirmada' ? 'Confirmada' : 'Cancelada'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {entry.courseName} · {entry.subjectName} · {entry.date} · {entry.hours}h
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(entry.createdAt)} · {entry.engine}
                      {entry.teacher ? ` · ${entry.teacher}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                        {entry.metrics.present} asistencia(s)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
                        {entry.metrics.absences} falla(s)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                        {entry.metrics.tardies} retardo(s)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                        {entry.metrics.justified} justificada(s)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Detalle
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('¿Eliminar este registro del historial? No se borran las fallas ya guardadas.')) {
                          onDelete(entry.id);
                        }
                      }}
                      className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Eliminar del historial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Estudiante</th>
                              <th className="px-3 py-2">Documento</th>
                              <th className="px-3 py-2">Estado</th>
                              <th className="px-3 py-2">Horas</th>
                              <th className="px-3 py-2">Motivo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entry.rows.map((row, index) => (
                              <tr key={`${entry.id}-row-${index}`}>
                                <td className="px-3 py-1.5 text-slate-800">{row.studentName}</td>
                                <td className="px-3 py-1.5 text-slate-500">{row.document || '—'}</td>
                                <td className={`px-3 py-1.5 font-semibold ${rowStatusClass(row.status)}`}>
                                  {statusLabel(row.status)}
                                </td>
                                <td className="px-3 py-1.5 text-slate-600">{row.hours}</td>
                                <td className="px-3 py-1.5 text-slate-500">{row.reason || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {entry.warnings.length > 0 && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{entry.warnings.join(' · ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 8 && (
        <div className="p-3 border-t border-slate-200 text-center">
          <button
            onClick={() => setShowAll((value) => !value)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            {showAll ? 'Mostrar menos' : `Ver los ${filtered.length} registros`}
          </button>
        </div>
      )}
    </div>
  );
};
