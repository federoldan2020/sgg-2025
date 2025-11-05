// hooks/usePadronMask.ts
import { useState, useCallback } from "react";

export function usePadronMask(initialValue = "") {
  const [value, setValue] = useState(initialValue);

  const formatPadron = useCallback((input: string) => {
    // Remover todo lo que no sea dígito
    const numbers = input.replace(/\D/g, "");

    // Limitar a 7 dígitos máximo
    const limited = numbers.slice(0, 7);

    // Aplicar formato automáticamente
    if (limited.length > 6) {
      // Si tiene más de 6 dígitos, insertar el guión automáticamente
      return limited.slice(0, 6) + "-" + limited.slice(6);
    } else if (limited.length === 6) {
      // Cuando llega exactamente a 6 dígitos, agregar el guión
      return limited + "-";
    } else {
      // Menos de 6 dígitos, mostrar tal como está
      return limited;
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const cursorPosition = e.target.selectionStart || 0;

      const formatted = formatPadron(inputValue);
      setValue(formatted);

      // Ajustar la posición del cursor después del formateo
      setTimeout(() => {
        const input = e.target;
        let newPosition = cursorPosition;

        // Si se agregó el guión automáticamente, mover el cursor después del guión
        if (formatted.length > inputValue.length && formatted.includes("-")) {
          newPosition = formatted.indexOf("-") + 1;
        }

        input.setSelectionRange(newPosition, newPosition);
      }, 0);
    },
    [formatPadron]
  );

  // Función para obtener solo los números (para enviar al backend)
  const getRawValue = useCallback(() => {
    return value.replace(/\D/g, "");
  }, [value]);

  // Función para obtener el valor completo con guión (para enviar al backend)
  const getFormattedValue = useCallback(() => {
    return value;
  }, [value]);

  return {
    value,
    onChange: handleChange,
    getRawValue,
    getFormattedValue,
    setValue: (newValue: string) => {
      setValue(formatPadron(newValue));
    },
  };
}
