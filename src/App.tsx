import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { CommunityPortal } from './components/CommunityPortal';
import { FastAttendanceRegister } from './components/FastAttendanceRegister';
import { DigitizerView } from './components/digitizer/DigitizerView';
import { ConsolidatedView } from './components/ConsolidatedView';
import { StudentManagement } from './components/StudentManagement';
import { AcademicManagement } from './components/AcademicManagement';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { LandingPage } from './components/LandingPage';
import { storage } from './services/storage';
import { AcademicPeriod, InstitutionConfig } from './types';
import { ShieldCheck, Heart, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => storage.isAdminSessionActive());
  const [studentSession, setStudentSession] = useState(() => storage.getStudentSession());
  const [activeTab, setActiveTab] = useState<string>('consulta');
  const [consultStudentId, setConsultStudentId] = useState<string | null>(
    () => storage.getStudentSession()?.studentId ?? null
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const [periods, setPeriods] = useState<AcademicPeriod[]>(() => storage.getPeriods());
  const [activePeriod, setActivePeriod] = useState<AcademicPeriod>(() => storage.getActivePeriod());
  const [config, setConfig] = useState<InstitutionConfig>(() => storage.getConfig());
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Trigger re-read of storage when changes happen
  const handleDataChanged = useCallback(() => {
    setPeriods(storage.getPeriods());
    setActivePeriod(storage.getActivePeriod());
    setConfig(storage.getConfig());
    setDataVersion((v) => v + 1);
  }, []);

  const handleSelectPeriod = (periodId: string) => {
    storage.setActivePeriod(periodId);
    handleDataChanged();
  };

  const handleLogout = () => {
    storage.setAdminSession(false);
    storage.clearStudentSession();
    setIsAdmin(false);
    setStudentSession(null);
    setConsultStudentId(null);
    setActiveTab('consulta');
    setIsLoginModalOpen(false);
  };

  const handleLoginSuccess = () => {
    storage.clearStudentSession();
    setStudentSession(null);
    setIsAdmin(true);
    setActiveTab('registro');
    setIsLoginModalOpen(false);
  };

  const handleConsultStudent = (studentId: string) => {
    setConsultStudentId(studentId);
    setActiveTab('consulta');
  };

  const handleStudentLogin = (studentId: string) => {
    storage.setAdminSession(false);
    storage.setStudentSession(studentId);
    setStudentSession(storage.getStudentSession());
    setIsAdmin(false);
    setConsultStudentId(studentId);
    setActiveTab('consulta');
    setIsLoginModalOpen(false);
  };

  // Compute number of students in alert (>50%) for the badge in navbar
  const alertCount = useMemo(() => {
    const students = storage.getStudents();
    let count = 0;
    students.forEach((st) => {
      const sum = storage.getStudentSummary(st.id, activePeriod.id);
      if (sum?.hasAnyAlert) count++;
    });
    return count;
  }, [activePeriod.id, dataVersion]);

  const studentName = useMemo(() => {
    if (!studentSession?.studentId) return undefined;
    return storage.getStudents().find((st) => st.id === studentSession.studentId)?.name;
  }, [studentSession, dataVersion]);

  // Entry gate: login or registration is required before using the platform
  if (!isAdmin && !studentSession) {
    return (
      <LandingPage
        config={config}
        onAdminLogin={handleLoginSuccess}
        onStudentLogin={handleStudentLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        isAdmin={isAdmin}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        periods={periods}
        activePeriod={activePeriod}
        onSelectPeriod={handleSelectPeriod}
        config={config}
        alertCount={alertCount}
        studentName={studentName}
        onExit={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Public Consultation Portal */}
        {activeTab === 'consulta' && (
          <CommunityPortal
            activePeriod={activePeriod}
            config={config}
            initialStudentId={consultStudentId}
            dataVersion={dataVersion}
          />
        )}

        {/* Admin Tabs */}
        {isAdmin && activeTab === 'registro' && (
          <FastAttendanceRegister
            activePeriod={activePeriod}
            onDataChanged={handleDataChanged}
          />
        )}

        {isAdmin && activeTab === 'digitalizador' && (
          <DigitizerView
            activePeriod={activePeriod}
            onDataChanged={handleDataChanged}
          />
        )}

        {isAdmin && activeTab === 'consolidado' && (
          <ConsolidatedView
            activePeriod={activePeriod}
            config={config}
            isAdmin={isAdmin}
            dataVersion={dataVersion}
            onDataChanged={handleDataChanged}
            onConsultStudent={handleConsultStudent}
          />
        )}

        {isAdmin && activeTab === 'estudiantes' && (
          <StudentManagement
            dataVersion={dataVersion}
            onDataChanged={handleDataChanged}
            onConsultStudent={handleConsultStudent}
          />
        )}

        {isAdmin && activeTab === 'academic' && (
          <AcademicManagement
            onDataChanged={handleDataChanged}
            dataVersion={dataVersion}
          />
        )}

        {isAdmin && activeTab === 'reportes' && (
          <ReportsView
            periods={periods}
            activePeriod={activePeriod}
            config={config}
          />
        )}

        {isAdmin && activeTab === 'configuracion' && (
          <SettingsView
            periods={periods}
            activePeriod={activePeriod}
            config={config}
            onDataChanged={handleDataChanged}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700">{config.name}</span>
            <span>•</span>
            <span>NIT: {config.nit}</span>
            <span>•</span>
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema en Línea 24/7
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-slate-400">
              Plataforma de Control de Fallas y Asistencia Escolar
            </span>
            {!isAdmin ? (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                Ingreso Docente / Admin
              </button>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sesión Administrador Activa
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onStudentLogin={handleStudentLogin}
      />
    </div>
  );
}
