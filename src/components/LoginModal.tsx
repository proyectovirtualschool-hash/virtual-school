import React, { useState } from 'react';
import { Lock, User, X, ShieldAlert, KeyRound, GraduationCap, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import { storage } from '../services/storage';
import { DOCUMENT_TYPES } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  onStudentLogin?: (studentId: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  onLoginSuccess,
  onStudentLogin 
}) => {
  // Mode: 'student' or 'admin'
  const [activeMode, setActiveMode] = useState<'student' | 'admin'>('student');

  // Student mode fields
  const [studentDocType, setStudentDocType] = useState<string>('TI');
  const [studentName, setStudentName] = useState<string>('');
  const [studentDocNumber, setStudentDocNumber] = useState<string>('');

  // Admin mode fields
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Admin Login
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const isValid = storage.verifyAdminLogin(username, password);
      if (isValid) {
        storage.setAdminSession(true);
        setIsLoading(false);
        onLoginSuccess();
        onClose();
      } else {
        setIsLoading(false);
        setError('Usuario o contraseña incorrectos. Verifique sus credenciales.');
      }
    }, 200);
  };

  // Handle Student / Acudiente Entry
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = studentName.trim();
    const cleanDoc = studentDocNumber.trim();

    if (!cleanName && !cleanDoc) {
      setError('Por favor ingrese el Nombre del estudiante y su Tipo de Documento.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find student by Name and Document Type
      let matches = storage.findStudentsByNameAndDocType(
        cleanName,
        studentDocType === 'all' ? undefined : studentDocType,
        cleanDoc
      );

      // If not found with chosen type, try finding across any type by name
      if (matches.length === 0 && cleanName) {
        matches = storage.findStudentsByNameAndDocType(cleanName, undefined, cleanDoc);
      }

      setIsLoading(false);

      if (matches.length > 0) {
        const found = matches[0];
        if (onStudentLogin) {
          onStudentLogin(found.id);
        }
        onClose();
      } else {
        const docLabel = DOCUMENT_TYPES.find((d) => d.code === studentDocType)?.label || studentDocType;
        setError(`No se encontró ningún estudiante con el nombre "${cleanName}" y tipo de documento "${docLabel}". Verifique los datos.`);
      }
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              {activeMode === 'student' ? (
                <GraduationCap className="w-5 h-5" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {activeMode === 'student' ? 'Ingreso de Estudiante / Acudiente' : 'Acceso Administrativo'}
              </h3>
              <p className="text-xs text-slate-300">
                {activeMode === 'student'
                  ? 'Consulta con Nombre y Tipo de Documento'
                  : 'Gestión y registro escolar para directivos'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveMode('student');
              setError(null);
            }}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMode === 'student'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Estudiante / Acudiente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('admin');
              setError(null);
            }}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeMode === 'admin'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Docente / Admin</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STUDENT / ACUDIENTE FORM */}
          {activeMode === 'student' && (
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tipo de Documento *</span>
                </label>
                <select
                  value={studentDocType}
                  onChange={(e) => setStudentDocType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.code} value={dt.code}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nombre del Estudiante *</span>
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Ej: Valentina Restrepo Morales"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Número de Documento (Opcional)
                </label>
                <input
                  type="text"
                  value={studentDocNumber}
                  onChange={(e) => setStudentDocNumber(e.target.value)}
                  placeholder="Ej: 1025849632"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                {isLoading ? 'Verificando...' : 'Ingresar a Mi Consulta'}
              </button>

              {/* Quick Fill Pills */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-2">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  Estudiantes de prueba:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentName('Valentina Restrepo Morales');
                      setStudentDocType('TI');
                      setStudentDocNumber('1025849632');
                      setError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Valentina (T.I.)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentName('Santiago Benítez Vargas');
                      setStudentDocType('TI');
                      setStudentDocNumber('1036987412');
                      setError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Santiago (T.I.)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentName('Nicolás Jiménez Beltrán');
                      setStudentDocType('CC');
                      setStudentDocNumber('1096325874');
                      setError(null);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    Nicolás (C.C.)
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ADMIN FORM */}
          {activeMode === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Usuario Administrador
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div>
                  <span className="font-medium text-slate-700">Credenciales por defecto:</span>
                  <p className="text-[11px] text-slate-500">admin / admin123</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('admin');
                    setPassword('admin123');
                    setError(null);
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Autocompletar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
