"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { api, getErrorMessage } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import TerceroForm, {
  type TerceroInitial,
} from "@/components/terceros/TerceroForm";

export default function EditarTerceroPage() {
  const router = useRouter();
  const { tercerosId } = useParams<{ tercerosId: string }>();
  const id = tercerosId;

  const [initial, setInitial] = useState<TerceroInitial | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      try {
        const r = await api<TerceroInitial & { nombre: string }>(
          `/terceros/by-id/${encodeURIComponent(id)}`
        );
        if (cancel) return;
        setInitial(r);
        setNombre(r.nombre);
      } catch (e) {
        if (!cancel) setMsg(getErrorMessage(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const onSubmit = async (payload: Record<string, unknown>) => {
    await api(`/terceros/by-id/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    router.push(`/terceros/${id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-semibold text-neutral-900">
          {nombre ? `Editar · ${nombre}` : "Editar tercero"}
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/terceros/${id}`} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : msg ? (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="size-5 shrink-0" />
          <span className="font-medium">{msg}</span>
        </div>
      ) : initial ? (
        <TerceroForm
          mode="editar"
          initial={initial}
          onSubmit={onSubmit}
          cancelHref={`/terceros/${id}`}
        />
      ) : null}
    </div>
  );
}
