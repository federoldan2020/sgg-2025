"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getErrorMessage } from "@/servicios/api";
import { historialCobertura, type Cobertura } from "@/servicios/suspensiones";
import { SemaforoCoberturaInline } from "@/components/coseguro/SemaforoCoberturaInline";
import { CupoOrdenesInline } from "@/components/coseguro/CupoOrdenesInline";
import { TabCobertura } from "@/components/coseguro/TabCobertura";
import { TabOrdenesFarmacia } from "@/components/coseguro/TabOrdenesFarmacia";
import { TabCuotas } from "@/components/coseguro/TabCuotas";
import { TabHistorial } from "@/components/coseguro/TabHistorial";
import type {
  AfiliadoLite,
  Colateral,
  CoseguroCfg,
  PadronLite,
  Parentesco,
  PrecioResumen,
} from "@/components/coseguro/types";

function displayNombre(a?: string | null, n?: string | null) {
  const A = (a ?? "").trim();
  const N = (n ?? "").trim();
  if (A && N) return `${A}, ${N}`;
  if (A || N) return (A || N)!;
  return "(sin nombre)";
}

export default function CoseguroAfiliadoPage() {
  const { afiliadoId } = useParams<{ afiliadoId: string }>();

  const [afiliado, setAfiliado] = useState<AfiliadoLite | null>(null);
  const [padrones, setPadrones] = useState<PadronLite[]>([]);
  const [cfg, setCfg] = useState<CoseguroCfg>({
    estado: "ninguno",
    padronCoseguroId: null,
    padronColatId: null,
  });
  const [colaterales, setColaterales] = useState<Colateral[]>([]);
  const [parentescos, setParentescos] = useState<Parentesco[]>([]);
  const [precio, setPrecio] = useState<PrecioResumen | null>(null);
  const [cobertura, setCobertura] = useState<Cobertura | null>(null);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const notify = useCallback((kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const cargarTodo = useCallback(async () => {
    if (!afiliadoId) return;
    try {
      setLoading(true);
      const [panel, familia, cats, cfgColat, pr, cob] = await Promise.all([
        api<{
          afiliado: AfiliadoLite;
          padrones: PadronLite[];
          coseguro: {
            estado: "activo" | "baja" | null;
            fechaAlta?: string | null;
            fechaBaja?: string | null;
            padronCoseguroId?: string | number | null;
          } | null;
        }>(`/coseguro/afiliados/${afiliadoId}`),
        api<Colateral[]>(`/colaterales/afiliados/${afiliadoId}/colaterales`),
        api<Parentesco[]>(`/colaterales/parentescos`).catch(() => [] as Parentesco[]),
        api<{ padronColatId?: string | number | null }>(
          `/colaterales/afiliados/${afiliadoId}/config`,
        ).catch(() => ({ padronColatId: null })),
        api<PrecioResumen>(
          `/colaterales/precio?afiliadoId=${encodeURIComponent(String(afiliadoId))}`,
        ).catch(() => null),
        historialCobertura(afiliadoId, 1)
          .then((arr) => arr[0] ?? null)
          .catch(() => null),
      ]);

      setAfiliado(panel.afiliado ?? null);
      setPadrones(panel.padrones ?? []);
      setCfg({
        estado: panel.coseguro?.estado ?? "ninguno",
        padronCoseguroId: panel.coseguro?.padronCoseguroId ?? null,
        padronColatId: cfgColat?.padronColatId ?? null,
        fechaAlta: panel.coseguro?.fechaAlta ?? null,
        fechaBaja: panel.coseguro?.fechaBaja ?? null,
      });
      setColaterales(familia ?? []);
      setParentescos(cats ?? []);
      setPrecio(pr ?? null);
      setCobertura(cob);
    } catch (e) {
      notify("error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [afiliadoId, notify]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  const nombreAfiliado = displayNombre(
    afiliado?.apellido ?? null,
    afiliado?.nombre ?? null,
  );
  const dniAf = afiliado?.dni ? String(afiliado.dni) : "—";
  const padronPrincipal = padrones.find((p) => p.activo !== false)?.padron ?? "—";

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ===== Header sticky ===== */}
      <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/coseguro">
                <Button variant="ghost" size="sm">
                  ← Coseguros
                </Button>
              </Link>
              <div>
                {loading && !afiliado ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  <div className="text-sm font-semibold text-neutral-900">
                    {nombreAfiliado}
                  </div>
                )}
                <div className="text-xs text-neutral-500">
                  DNI {dniAf} · Padrón {padronPrincipal}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={
                  cfg.estado === "activo"
                    ? "success"
                    : cfg.estado === "baja"
                      ? "error"
                      : "secondary"
                }
              >
                Coseguro: {cfg.estado.toUpperCase()}
              </Badge>
              <SemaforoCoberturaInline cobertura={cobertura} loading={loading} />
              <CupoOrdenesInline
                consumidas={null}
                cupo={null}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== Toast simple ===== */}
      {toast && (
        <div className="pointer-events-none fixed right-4 top-20 z-50 max-w-sm">
          <div
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
            role="alert"
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* ===== Contenido ===== */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loading && !afiliado ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="cobertura">
            <TabsList>
              <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
              <TabsTrigger value="ordenes">Órdenes farmacia</TabsTrigger>
              <TabsTrigger value="cuotas">Cuotas</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <TabsContent value="cobertura">
              <TabCobertura
                afiliadoId={String(afiliadoId)}
                padrones={padrones}
                cfg={cfg}
                setCfg={setCfg}
                colaterales={colaterales}
                parentescos={parentescos}
                precio={precio}
                busy={busy}
                setBusy={setBusy}
                notify={notify}
                refresh={cargarTodo}
              />
            </TabsContent>

            <TabsContent value="ordenes">
              <TabOrdenesFarmacia />
            </TabsContent>

            <TabsContent value="cuotas">
              <TabCuotas afiliadoId={String(afiliadoId)} />
            </TabsContent>

            <TabsContent value="historial">
              <TabHistorial afiliadoId={String(afiliadoId)} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
