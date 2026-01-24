"use client";

import { Input } from "@/components/ui/input";
import { formatearPeriodoArgentina, periodoArgentinaAISO } from "@/utiles/formatos";
import { useState, useEffect } from "react";

interface InputPeriodoProps {
  value: string; // ISO (YYYY-MM) o vacío
  onChange: (isoValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Input de período que muestra formato argentino (mm/aa o mm/aaaa) pero maneja ISO internamente
 */
export function InputPeriodo({
  value,
  onChange,
  placeholder = "mm/aa",
  className,
  disabled,
  required,
}: InputPeriodoProps) {
  // Valor mostrado en formato argentino
  const [displayValue, setDisplayValue] = useState(() => {
    return value ? formatearPeriodoArgentina(value) : "";
  });

  // Sincronizar cuando el valor ISO cambie externamente
  useEffect(() => {
    const formatted = value ? formatearPeriodoArgentina(value) : "";
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Convertir a ISO si es válido
    const isoValue = periodoArgentinaAISO(inputValue);
    if (isoValue || inputValue === "") {
      onChange(isoValue);
    }
  };

  const handleBlur = () => {
    // Al perder el foco, formatear correctamente si hay valor
    if (displayValue) {
      const isoValue = periodoArgentinaAISO(displayValue);
      if (isoValue) {
        setDisplayValue(formatearPeriodoArgentina(isoValue));
      } else {
        // Si no es válido, intentar mantener formato o limpiar
        const formatted = formatearPeriodoArgentina(value || "");
        setDisplayValue(formatted);
        if (formatted) {
          onChange(periodoArgentinaAISO(formatted) || "");
        }
      }
    }
  };

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      required={required}
      inputMode="numeric"
      pattern="\d{1,2}/\d{2,4}"
    />
  );
}

