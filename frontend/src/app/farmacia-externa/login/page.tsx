"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, User as UserIcon } from "lucide-react";
import { loginFarmacia } from "@/servicios/farmaciaExterna";

export default function LoginFarmaciaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setBusy(true);
      await loginFarmacia(usuario.trim(), password);
      router.replace("/farmacia-externa");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-8 shadow-xl shadow-neutral-900/5 ring-1 ring-neutral-900/[0.03] sm:p-10">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Ingresar
            </h2>
            <p className="mt-1.5 text-sm text-neutral-500">
              Ingresá con el usuario y contraseña que te entregó UDAP.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="usuario"
                className="text-sm font-medium text-neutral-700"
              >
                Usuario
              </label>
              <div className="relative">
                <UserIcon
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <Input
                  id="usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                  data-no-uppercase
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-neutral-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
                  aria-hidden
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  data-no-uppercase
                  className="h-11 pl-10"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-11 w-full text-base font-semibold"
              disabled={busy}
            >
              {busy ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          UDAP · Farmacia externa
        </p>
      </div>
    </div>
  );
}
