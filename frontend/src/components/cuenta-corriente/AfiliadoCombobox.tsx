"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { buscarAfiliados } from "./api";
import type { AfiliadoSuggest } from "./types";

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function AfiliadoCombobox({
  value,
  onSelect,
}: {
  value: AfiliadoSuggest | null;
  onSelect: (a: AfiliadoSuggest | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [items, setItems] = useState<AfiliadoSuggest[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dq.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    buscarAfiliados(dq)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [dq]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-[420px] justify-start gap-2 text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className={cn("truncate", value ? "text-foreground" : "")}>
            {value ? value.display : "Buscar afiliado (DNI, nombre o padrón)…"}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[420px]" align="end">
        <Command>
          <CommandInput
            ref={inputRef as React.RefObject<HTMLInputElement>}
            placeholder="Escribí al menos 2 caracteres…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {loading && (
              <div className="p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            )}
            {!loading && <CommandEmpty>Sin resultados.</CommandEmpty>}

            <CommandGroup heading="Afiliados">
              {items.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.display} ${s.dni}`}
                  onSelect={() => {
                    onSelect(s);
                    setOpen(false);
                    setQ("");
                    setItems([]);
                  }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{s.display}</span>
                    <span className="text-xs text-muted-foreground">DNI {s.dni}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            {value && (
              <>
                <Separator />
                <div className="p-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={() => {
                      onSelect(null);
                      setOpen(false);
                      setQ("");
                      setItems([]);
                    }}
                  >
                    Quitar selección
                  </Button>
                </div>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
