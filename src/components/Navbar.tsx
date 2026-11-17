import React from 'react';
import { 
  GraduationCap, 
  ShieldCheck, 
  Search, 
  Calendar, 
  ClipboardCheck, 
  Users, 
  BookOpen, 
  BarChart3, 
  Settings, 
  LogOut, 
  LogIn,
  AlertTriangle,
  User,
  ScanLine
} from 'lucide-react';
import { AcademicPeriod, InstitutionConfig } from '../types';

interface NavbarProps {
  isAdmin: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod;
  onSelectPeriod: (periodId: string) => void;
  config: InstitutionConfig;
  alertCount: number;
  studentName?: string;
  onExit?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  activeTab,
  setActiveTab,
  onOpenLogin,
  onLogout,
  periods,
  activePeriod,
  onSelectPeriod,
  config,
  alertCount,
  studentName,
  onExit,
}) => {
  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="flex items-center justify-between h-16">
          {/* Institution Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('consulta')}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white flex items-center gap-2">
                {config.name}
              </h1>
              <p className="text-xs text-slate-400">
                Sistema de Control de Fallas y Asistencia Escolar
              </p>
            </div>
          </div>

          {/* Right Section: Period Selector & Auth */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Academic Period Selector */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60">
              <Calendar className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-slate-300">Periodo:</span>
              <select
                value={activePeriod.id}
                onChange={(e) => onSelectPeriod(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                title="Seleccionar periodo académico"
              >
                {periods.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name} {p.isActive ? '(Activo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Alert Indicator if any */}
            {alertCount > 0 && (
              <button
                onClick={() => setActiveTab('consolidado')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-colors"
                title={`${alertCount} estudiantes con fallas > 50%`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                <span className="font-bold text-white">{alertCount}</span>
                <span className="hidden md:inline">en alerta</span>
              </button>
            )}

            {/* Role Badge & Auth Button */}
            {isAdmin ? (
              <div className="flex items-center space-x-2">
                <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                  Administrador
                </span>
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition"
                  title="Cerrar sesión de administrador"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            ) : studentName ? (
              <div className="flex items-center space-x-2">
                <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-500/30 max-w-[220px] truncate">
                  <User className="w-3.5 h-3.5 mr-1 text-blue-300 shrink-0" />
                  <span className="truncate">{studentName}</span>
                </span>
                <button
                  onClick={onExit}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
                  title="Cerrar sesión y volver al inicio"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/30 transition cursor-pointer"
                title="Ingreso para Estudiantes, Acudientes y Docentes"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Ingresar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Bar / Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto scrollbar-none text-xs sm:text-sm font-medium">
          {/* Public Tab */}
          <button
            type="button"
            id="nav-btn-consulta-comunidad"
            onClick={() => setActiveTab('consulta')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer font-semibold ${
              activeTab === 'consulta'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4 stroke-[2.5]" />
            <span>Consulta Estudiante / Comunidad</span>
          </button>

          {/* Admin Tabs (or available if admin logged in) */}
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('registro')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'registro'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Registro de Fallas</span>
              </button>

              <button
                onClick={() => setActiveTab('digitalizador')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'digitalizador'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ScanLine className="w-4 h-4" />
                <span>Digitalizador IA</span>
              </button>

              <button
                onClick={() => setActiveTab('consolidado')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'consolidado'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Consolidado y Alertas</span>
              </button>

              <button
                onClick={() => setActiveTab('estudiantes')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'estudiantes'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Estudiantes</span>
              </button>

              <button
                onClick={() => setActiveTab('academic')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'academic'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Cursos y Materias</span>
              </button>

              <button
                onClick={() => setActiveTab('reportes')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'reportes'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Reportes PDF / Excel</span>
              </button>

              <button
                onClick={() => setActiveTab('configuracion')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === 'configuracion'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Configuración y Periodos</span>
              </button>
            </>
          )}

          {!isAdmin && (
            <button
              onClick={onOpenLogin}
              className="ml-auto text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1.5 px-3 py-2"
            >
              <span>¿Eres docente o directivo? Iniciar sesión</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};
