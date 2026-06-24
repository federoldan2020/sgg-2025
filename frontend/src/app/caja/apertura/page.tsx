"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cajaService } from "@/servicios/cajaService";
import { getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/ui-kit";
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
  XCircle,
} from "lucide-react";

const SEDE = "Central";

export default function AperturaCajaPage() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const st = await cajaService.estado();
        if (st.abierta && st.cajaId) {
          router.replace("/caja");
          return;
        }
      } catch {
        /* si falla el estado, igual permitimos intentar abrir */
      }
      setChecking(false);
    })();
  }, [router]);

  const abrir = async () => {
    try {
      setOpening(true);
      setError(null);
      await cajaService.abrir(SEDE);
      router.replace("/caja");
    } catch (e) {
      setError(getErrorMessage(e));
      setOpening(false);
    }
  };

  const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <PageContainer>
      <PageHeader
        title="Apertura de Caja"
        subtitle="Abrí la caja para habilitar el registro de cobros del día"
      />

      <div className="mx-auto w-full max-w-xl">
        {checking ? (
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-medical-500" />
              <p className="text-sm text-muted-foreground">Verificando estado de la caja…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex flex-col items-center gap-6 px-8 py-10 text-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-medical-400 to-medical-600 shadow-lg shadow-medical-500/25">
                  <Lock className="h-9 w-9 text-white" />
                </div>
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-neutral-300" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
                  La caja está cerrada
                </h2>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Al abrirla se registrará tu usuario y la hora de apertura, y quedará
                  habilitado el cobro a afiliados.
                </p>
              </div>

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left">
                  <CalendarDays className="h-4 w-4 shrink-0 text-medical-600" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Fecha
                    </div>
                    <div className="truncate text-sm font-medium capitalize">{hoy}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-left">
                  <MapPin className="h-4 w-4 shrink-0 text-medical-600" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Sede
                    </div>
                    <div className="truncate text-sm font-medium">{SEDE}</div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex w-full items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-left">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  <p className="text-sm font-medium text-rose-800">{error}</p>
                </div>
              )}

              <Button
                onClick={abrir}
                disabled={opening}
                size="lg"
                className="h-12 w-full rounded-2xl text-base font-semibold"
              >
                {opening ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Abriendo caja…
                  </>
                ) : (
                  <>
                    Abrir Caja
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acción auditada y reversible solo mediante cierre
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
