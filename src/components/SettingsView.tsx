import React, { useState, useRef } from 'react';
import { 
  Settings, 
  KeyRound, 
  Calendar, 
  Building, 
  Database, 
  Save, 
  Plus, 
  Download, 
  Upload, 
  Check, 
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  X
} from 'lucide-react';
import { AcademicPeriod, InstitutionConfig } from '../types';
import { storage } from '../services/storage';

interface SettingsViewProps {
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod;
  config: InstitutionConfig;
  onDataChanged: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  periods,
  activePeriod,
  config,
  onDataChanged,
}) => {
  // Institutional config
  const [instName, setInstName] = useState(config.name);
  const [instNit, setInstNit] = useState(config.nit);
  const [instAddress, setInstAddress] = useState(config.address);
  const [instPhone, setInstPhone] = useState(config.phone);
  const [alertPercent, setAlertPercent] = useState(config.alertThresholdPercent || 50);

  // Admin Credentials
  const adminUser = storage.getAdminUser();
  const [adminUsername, setAdminUsername] = useState(adminUser.username);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Period creation
  const [newPeriodName, setNewPeriodName] = useState('');
  const [newPeriodYear, setNewPeriodYear] = useState(2026);
  const [newPeriodStart, setNewPeriodStart] = useState('');
  const [newPeriodEnd, setNewPeriodEnd] = useState('');

  // Backup
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Clear all data
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  const handleSaveInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updateConfig({
      name: instName.trim(),
      nit: instNit.trim(),
      address: instAddress.trim(),
      phone: instPhone.trim(),
      alertThresholdPercent: alertPercent,
    });
    onDataChanged();
    setStatusMessage('Configuración institucional guardada exitosamente.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    storage.updateAdminCredentials(adminUsername, newPassword || undefined);
    setSecurityMessage('Credenciales de administrador actualizadas con éxito.');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSecurityMessage(null), 3500);
  };

  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName.trim()) return;

    storage.addPeriod({
      name: newPeriodName.trim(),
      year: newPeriodYear,
      startDate: newPeriodStart || '2026-01-01',
      endDate: newPeriodEnd || '2026-12-31',
      isActive: false,
    });

    setNewPeriodName('');
    onDataChanged();
  };

  const handleSetActivePeriod = (periodId: string) => {
    storage.setActivePeriod(periodId);
    onDataChanged();
  };

  const handleExportBackup = () => {
    const json = storage.exportCompleteBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_Control_Fallas_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = storage.importCompleteBackup(content);
      if (success) {
        alert('Copia de seguridad restaurada correctamente.');
        onDataChanged();
      } else {
        alert('Error al leer el archivo de respaldo.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (confirm('¿Desea restaurar los datos de demostración iniciales del sistema? Se conservarán los datos modelo de cursos, materias y estudiantes de prueba.')) {
      storage.resetToFactoryDefaults();
      onDataChanged();
      alert('Sistema restaurado a datos iniciales de demostración.');
    }
  };

  const handleClearAllData = () => {
    if (clearConfirmText !== 'BORRAR TODO') {
      alert('Debe escribir exactamente "BORRAR TODO" para confirmar.');
      return;
    }
    try {
      storage.clearAllDataCompletely();
      onDataChanged();
      setShowClearAllModal(false);
      setClearConfirmText('');
      alert('Todos los datos han sido eliminados. No quedan estudiantes registrados.');
    } catch (e) {
      alert('Error al borrar los datos.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Academic Periods Management */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Periodos Académicos y Conservación Histórica</h3>
            <p className="text-xs text-slate-500">
              El historial de inasistencias se conserva por periodos sin eliminar datos de periodos anteriores.
            </p>
          </div>
        </div>

        {/* Existing periods list */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">Periodos Registrados:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {periods.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border flex items-center justify-between transition ${
                  p.isActive
                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-400'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 block">{p.name}</span>
                  <span className="text-[11px] text-slate-500">
                    Año: {p.year} • {p.startDate} a {p.endDate}
                  </span>
                </div>

                {p.isActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
                    Periodo Activo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetActivePeriod(p.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    Activar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Create new period */}
        <form onSubmit={handleCreatePeriod} className="pt-3 border-t border-slate-100 space-y-3">
          <span className="text-xs font-bold text-slate-700 block">Agregar Nuevo Periodo Académico:</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              placeholder="Ej: Periodo 2 - 2026"
              value={newPeriodName}
              onChange={(e) => setNewPeriodName(e.target.value)}
              className="sm:col-span-2 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
            <input
              type="date"
              value={newPeriodStart}
              onChange={(e) => setNewPeriodStart(e.target.value)}
              className="p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Periodo</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Admin Security & Password Change */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Seguridad y Credenciales de Administrador</h3>
            <p className="text-xs text-slate-500">
              El administrador inicia sesión con usuario y contraseña asignados por él mismo.
            </p>
          </div>
        </div>

        {securityMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{securityMessage}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Usuario Administrador
              </label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                placeholder="Dejar en blanco para no cambiar"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                placeholder="Repita la nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              Contraseña actual encriptada y protegida en almacenamiento local.
            </span>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              Guardar Credenciales
            </button>
          </div>
        </form>
      </div>

      {/* 3. Institution Profile & Threshold */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Membrete Institucional y Umbral de Alerta</h3>
            <p className="text-xs text-slate-500">
              Estos datos aparecen en los boletines PDF y sábanas de Excel generados.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveInstitution} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre de la Institución
              </label>
              <input
                type="text"
                required
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIT o Registro Oficial
              </label>
              <input
                type="text"
                required
                value={instNit}
                onChange={(e) => setInstNit(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dirección / Sede
              </label>
              <input
                type="text"
                value={instAddress}
                onChange={(e) => setInstAddress(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={instPhone}
                onChange={(e) => setInstPhone(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Porcentaje de Alerta Roja por Inasistencia (% del límite permitido):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={10}
                max={90}
                value={alertPercent}
                onChange={(e) => setAlertPercent(parseInt(e.target.value) || 50)}
                className="w-24 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-red-700"
              />
              <span className="text-xs text-slate-500">
                Por defecto: <strong>50%</strong> (Resalta en rojo a los estudiantes que superen esta proporción de fallas por materia).
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>

      {/* 4. Backup and Restore */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">Respaldo y Seguridad de la Información</h3>
            <p className="text-xs text-slate-500">
              Descargue una copia de seguridad en archivo JSON con todos los cursos, estudiantes y registros de fallas.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Descargar Copia de Seguridad (JSON)</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>Restaurar Copia</span>
              </button>
            </div>

            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar datos de prueba iniciales</span>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold text-red-700">Zona Peligrosa</p>
              <p className="text-[11px] text-slate-500">Elimina permanentemente toda la información del sistema</p>
            </div>
            <button
              onClick={() => setShowClearAllModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Borrar TODOS los datos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para borrar todos los datos */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-sm">PELIGRO - Borrar todos los datos</h3>
              </div>
              <button
                onClick={() => {
                  setShowClearAllModal(false);
                  setClearConfirmText('');
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-800 font-semibold mb-2">⚠️ Esta acción NO se puede deshacer</p>
                <p className="text-xs text-red-700 leading-relaxed">
                  Se eliminarán PERMANENTEMENTE todos los cursos, materias, estudiantes, registros de asistencia, periodos académicos, configuraciones personalizadas y credenciales. El sistema quedará con los valores por defecto.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Para confirmar, escriba <span className="font-bold text-red-600">BORRAR TODO</span>
                </label>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="Escriba BORRAR TODO"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowClearAllModal(false);
                    setClearConfirmText('');
                  }}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearAllData}
                  disabled={clearConfirmText !== 'BORRAR TODO'}
                  className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Borrar Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
