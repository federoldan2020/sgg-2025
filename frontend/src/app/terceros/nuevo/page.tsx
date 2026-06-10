"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/servicios/api";
import { Button } from "@/components/ui/button";
import TerceroForm from "@/components/terceros/TerceroForm";

export default function NuevoTerceroPage() {
  const router = useRouter();

  const onSubmit = async (payload: Record<string, unknown>) => {
    const r = await api<{ id: string }>("/terceros", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    router.push(`/terceros/${r.id}`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">Nuevo tercero</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/terceros" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver al listado
          </Link>
        </Button>
      </div>

      <TerceroForm mode="crear" onSubmit={onSubmit} />
    </div>
  );
}
