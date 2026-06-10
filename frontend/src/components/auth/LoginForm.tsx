'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { authOrganizaciones, type OrgLite } from '@/servicios/api';
import {
  Loader2,
  User as UserIcon,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
interface LoginFormProps {
  onSuccess?: () => void;
}

const FEATURES = [
  'Gestión de afiliados y padrones',
  'Caja, órdenes y liquidaciones',
  'Acceso seguro por roles',
] as const;

const LOGIN_ORG_KEY = 'loginOrganizacionId';

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [organizacionId, setOrganizacionId] = useState('');
  const [organizaciones, setOrganizaciones] = useState<OrgLite[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    let cancelled = false;
    void authOrganizaciones().then((list) => {
      if (cancelled) return;
      setOrganizaciones(list);
      const saved =
        typeof window !== 'undefined'
          ? localStorage.getItem(LOGIN_ORG_KEY)
          : null;
      if (saved && list.some((o) => o.id === saved)) {
        setOrganizacionId(saved);
      } else if (list.length === 1) {
        setOrganizacionId(list[0].id);
      }
      setOrgsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (organizaciones.length > 1 && !organizacionId) {
      setError('Seleccioná la organización a la que pertenecés.');
      return;
    }

    setIsLoading(true);

    try {
      if (organizacionId) {
        localStorage.setItem(LOGIN_ORG_KEY, organizacionId);
      }
      await login(identificador, password, organizacionId || undefined);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-50">
      {/* Fondo decorativo */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-medical-200/40 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-medical-400/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-medical-100/50 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(2 132 199 / 0.12) 1px, transparent 0)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        {/* Panel de marca — desktop */}
        <aside className="relative hidden w-full flex-col justify-between overflow-hidden bg-gradient-to-br from-medical-700 via-medical-600 to-medical-800 px-12 py-14 text-white lg:flex lg:w-[44%] xl:w-[42%]">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            aria-hidden
          >
            <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-16 left-10 h-56 w-56 rounded-full bg-medical-300/20 blur-2xl" />
          </div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/20 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-medical-700 shadow-lg">
                <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">PGG 2025</p>
                <p className="text-xs font-medium text-medical-100">
                  Sistema interno
                </p>
              </div>
            </div>

            <h1 className="mt-12 max-w-sm text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Sistema de Gestión Gremial
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-medical-100/90">
              Plataforma unificada para la administración de afiliados, caja y
              procesos operativos de tu organización.
            </p>
          </div>

          <ul className="relative z-10 mt-10 space-y-3">
            {FEATURES.map((text) => (
              <li
                key={text}
                className="flex items-center gap-3 text-sm text-medical-50/95"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="relative z-10 mt-auto pt-10 text-xs text-medical-200/80">
            Acceso restringido a personal autorizado
          </p>
        </aside>

        {/* Formulario */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div
            className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
          >
            {/* Logo móvil */}
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-medical-600 to-medical-700 text-white shadow-lg shadow-medical-500/30">
                <ShieldCheck className="h-7 w-7" strokeWidth={2} />
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
                PGG 2025
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Sistema de Gestión Gremial
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 bg-white/90 p-8 shadow-xl shadow-neutral-900/5 ring-1 ring-neutral-900/[0.03] backdrop-blur-sm sm:p-10">
              <div className="mb-8 hidden lg:block">
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  Iniciar sesión
                </h2>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Ingresá con tu cuenta corporativa
                </p>
              </div>

              <div className="mb-6 lg:hidden">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Iniciar sesión
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Ingresá con tu cuenta corporativa
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {(orgsLoading || organizaciones.length > 0) && (
                  <div className="space-y-2">
                    <Label htmlFor="organizacion" className="text-neutral-700">
                      Organización
                    </Label>
                    <div className="relative">
                      <Building2
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                        aria-hidden
                      />
                      <select
                        id="organizacion"
                        name="organizacion"
                        required={organizaciones.length > 0}
                        value={organizacionId}
                        onChange={(e) => setOrganizacionId(e.target.value)}
                        disabled={isLoading || orgsLoading}
                        className="h-11 w-full appearance-none rounded-lg border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-900 transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">
                          {orgsLoading
                            ? 'Cargando organizaciones…'
                            : organizaciones.length === 0
                              ? 'Sin organizaciones disponibles'
                              : 'Seleccionar organización'}
                        </option>
                        {organizaciones.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    {!orgsLoading && organizaciones.length === 0 && (
                      <p className="text-xs text-amber-700">
                        No hay organizaciones activas. Ejecutá el seed o creá una
                        organización en el backend.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="identificador" className="text-neutral-700">
                    Usuario o email
                  </Label>
                  <div className="relative">
                    <UserIcon
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      aria-hidden
                    />
                    <Input
                      id="identificador"
                      name="identificador"
                      type="text"
                      autoComplete="username"
                      required
                      value={identificador}
                      onChange={(e) => setIdentificador(e.target.value)}
                      placeholder="froldan o nombre@organizacion.com"
                      className="h-11 pl-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-medical-500/10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-neutral-700">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                      aria-hidden
                    />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-10 pr-11 transition-shadow focus-visible:shadow-md focus-visible:shadow-medical-500/10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label={
                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 animate-in fade-in slide-in-from-top-1 duration-300"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p>{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    orgsLoading ||
                    (organizaciones.length > 0 && !organizacionId)
                  }
                  size="lg"
                  className="mt-2 h-11 w-full text-base font-semibold shadow-md shadow-medical-600/20 transition-all hover:shadow-lg hover:shadow-medical-600/25 active:scale-[0.99] disabled:opacity-70"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Iniciando sesión…
                    </>
                  ) : (
                    'Iniciar sesión'
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-neutral-400">
              © {new Date().getFullYear()} PGG — Uso interno autorizado
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
