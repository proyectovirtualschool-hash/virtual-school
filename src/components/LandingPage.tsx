import React, { useMemo, useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Search,
  Calendar,
  Users,
  BookOpen,
  Lock,
  User,
  KeyRound,
  CreditCard,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  ScanLine,
  LogIn,
} from 'lucide-react';
import { InstitutionConfig, DOCUMENT_TYPES } from '../types';
import { storage } from '../services/storage';

interface LandingPageProps {
  config: InstitutionConfig;
  onAdminLogin: () => void;
  onStudentLogin: (studentId: string) => void;
}

const FEATURES = [
  {
    icon: Search,
    title: 'Consulta en tiempo real',
    description: 'Estudiantes y acudientes revisan sus fallas al instante.',
  },
  {
    icon: AlertTriangle,
    title: 'Alertas al 50%',
    description: 'Avisos oportunos antes de perder la asignatura.',
  },
  {
    icon: FileText,
    title: 'Reportes PDF y Excel',
    description: 'Boletines oficiales descargables en un solo clic.',
  },
  {
    icon: ScanLine,
    title: 'Registro ágil',
    description: 'Control manual o por escaneo en cada clase.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  config,
  onAdminLogin,
  onStudentLogin,
}) => {
  const [loginRole, setLoginRole] = useState<'student' | 'admin'>('student');

  // Student login fields
  const [studentDocType, setStudentDocType] = useState<string>('TI');
  const [studentName, setStudentName] = useState<string>('');
  const [studentDocNumber, setStudentDocNumber] = useState<string>('');

  // Admin login fields
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stats = useMemo(() => {
    const students = storage.getStudents();
    const activePeriod = storage.getActivePeriod();
    return {
      students: students.length,
      courses: storage.getCourses().length,
      period: activePeriod?.name || 'Sin periodo',
    };
  }, []);

  const resetFeedback = () => {
    setError(null);
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();

    const cleanName = studentName.trim();
    const cleanDoc = studentDocNumber.trim();

    if (!cleanName && !cleanDoc) {
      setError('Ingrese el nombre del estudiante y su tipo de documento para continuar.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      let matches = storage.findStudentsByNameAndDocType(
        cleanName,
        studentDocType === 'all' ? undefined : studentDocType,
        cleanDoc
      );

      if (matches.length === 0 && cleanName) {
        matches = storage.findStudentsByNameAndDocType(cleanName, undefined, cleanDoc);
      }

      setIsLoading(false);

      if (matches.length > 0) {
        const found = matches[0];
        storage.setStudentSession(found.id);
        onStudentLogin(found.id);
      } else {
        const docLabel = DOCUMENT_TYPES.find((d) => d.code === studentDocType)?.label || studentDocType;
        setError(
          `No se encontró ningún estudiante con el nombre "${cleanName}" y documento "${docLabel}". Verifique los datos o regístrese si es su primer ingreso.`
        );
      }
    }, 200);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resetFeedback();
    setIsLoading(true);

    setTimeout(() => {
      const isValid = storage.verifyAdminLogin(username, password);
      setIsLoading(false);
      if (isValid) {
        storage.setAdminSession(true);
        onAdminLogin();
      } else {
        setError('Usuario o contraseña incorrectos. Verifique sus credenciales.');
      }
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white px-6 sm:px-10 py-8 lg:py-12 flex flex-col justify-between">
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-tight tracking-tight text-white">
                {config.name}
              </h1>
              <p className="text-xs text-blue-200/80">Control de Fallas y Asistencia Escolar</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-md mt-6 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>Plataforma Académica {config.academicYear}</span>
          </div>

          <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Tu asistencia,
            <br />
            clara y a tiempo.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-blue-100 leading-relaxed max-w-md">
            Consulta las fallas acumuladas, recibe alertas antes de alcanzar el límite y descarga
            los boletines oficiales de cada periodo.
          </p>

          <ul className="hidden lg:grid gap-4 mt-8">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4 text-blue-200" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="text-xs text-blue-100/80 leading-relaxed">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10">
          <div className="hidden lg:grid grid-cols-3 gap-3">
            <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-blue-200">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Estudiantes</span>
              </div>
              <p className="text-xl font-black mt-1">{stats.students}</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-blue-200">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Cursos</span>
              </div>
              <p className="text-xl font-black mt-1">{stats.courses}</p>
            </div>
            <div className="bg-white/10 border border-white/15 rounded-xl px-3 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 text-blue-200">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Periodo</span>
              </div>
              <p className="text-xs font-bold mt-2 truncate" title={stats.period}>
                {stats.period}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-blue-200/80">
            <span className="font-semibold text-white">{config.name}</span>
            <span className="hidden sm:inline">•</span>
            <span>NIT: {config.nit}</span>
            <span className="hidden sm:inline">•</span>
            <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sistema en línea
            </span>
          </div>
        </div>
      </aside>

      {/* Access panel */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-8 lg:py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 leading-tight">
                    Bienvenido de nuevo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ingresa para consultar fallas y asistencias.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 p-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginRole('student');
                        resetFeedback();
                      }}
                      aria-pressed={loginRole === 'student'}
                      className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        loginRole === 'student'
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
                        setLoginRole('admin');
                        resetFeedback();
                      }}
                      aria-pressed={loginRole === 'admin'}
                      className={`py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        loginRole === 'admin'
                          ? 'bg-white text-slate-900 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Docente / Admin</span>
                    </button>
                  </div>

                  {loginRole === 'student' ? (
                    <form onSubmit={handleStudentSubmit} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          <span>Tipo de Documento *</span>
                        </label>
                        <select
                          value={studentDocType}
                          onChange={(e) => setStudentDocType(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
                        >
                          <option value="all">Cualquier Tipo de Doc.</option>
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
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Ej: Valentina Restrepo Morales"
                          className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition placeholder:text-slate-400"
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
                          className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition font-mono placeholder:text-slate-400"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Search className="w-4 h-4" />
                        {isLoading ? 'Verificando...' : 'Ingresar a Mi Consulta'}
                      </button>

                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-2">
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          Estudiantes de prueba:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setStudentName('ESTUDIANTE 001');
                              setStudentDocType('TI');
                              setStudentDocNumber('0000000001');
                              resetFeedback();
                            }}
                            className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                          >
                            Estudiante 001 (T.I.)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentName('ESTUDIANTE 002');
                              setStudentDocType('TI');
                              setStudentDocNumber('0000000002');
                              resetFeedback();
                            }}
                            className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                          >
                            Estudiante 002 (T.I.)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentName('ESTUDIANTE 008');
                              setStudentDocType('TI');
                              setStudentDocNumber('0000000008');
                              resetFeedback();
                            }}
                            className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md border border-slate-200 transition cursor-pointer"
                          >
                            Estudiante 008 (T.I.)
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
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
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition placeholder:text-slate-400"
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
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition placeholder:text-slate-400"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Lock className="w-4 h-4" />
                        {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
                      </button>

                      <div className="mt-2 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div>
                          <span className="font-medium text-slate-700">Credenciales por defecto:</span>
                          <p className="text-[11px] text-slate-500">admin / admin123</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUsername('admin');
                            setPassword('admin123');
                            resetFeedback();
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

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Acceso seguro · {config.name}</span>
          </div>
        </div>
      </main>
    </div>
  );
};
