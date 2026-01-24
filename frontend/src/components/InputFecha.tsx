"use client";

import { Input } from "@/components/ui/input";
import { formatearFechaArgentina, fechaArgentinaAISO } from "@/utiles/formatos";
import { useState, useEffect } from "react";

interface InputFechaProps {
  value: string; // ISO (yyyy-mm-dd) o vacío
  onChange: (isoValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Input de fecha que muestra formato argentino (dd/mm/aaaa) pero maneja ISO internamente
 */
export function InputFecha({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  disabled,
  required,
}: InputFechaProps) {
  // Valor mostrado en formato argentino
  const [displayValue, setDisplayValue] = useState(() => {
    return value ? formatearFechaArgentina(value) : "";
  });

  // Sincronizar cuando el valor ISO cambie externamente
  useEffect(() => {
    const formatted = value ? formatearFechaArgentina(value) : "";
    if (formatted !== displayValue) {
      setDisplayValue(formatted);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Convertir a ISO si es válido
    const isoValue = fechaArgentinaAISO(inputValue);
    if (isoValue || inputValue === "") {
      onChange(isoValue);
    }
  };

  const handleBlur = () => {
    // Al perder el foco, formatear correctamente si hay valor
    if (displayValue) {
      const isoValue = fechaArgentinaAISO(displayValue);
      if (isoValue) {
        setDisplayValue(formatearFechaArgentina(isoValue));
      } else {
        // Si no es válido, intentar mantener formato o limpiar
        const formatted = formatearFechaArgentina(value || "");
        setDisplayValue(formatted);
        if (formatted) {
          onChange(fechaArgentinaAISO(formatted) || "");
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
      pattern="\d{1,2}/\d{1,2}/\d{2,4}"
    />
  );
}

