// components/MonthPicker.tsx
import React, { useEffect, useRef } from "react";

function addMonths(ym: string, delta: number) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5));
  const d = new Date(y, m - 1 + delta, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}
export const firstDay = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5));
  return new Date(y, m - 1, 1, 0, 0, 0, 0);
};
export const lastDay = (ym: string) => {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5));
  return new Date(y, m, 0, 23, 59, 59, 999);
};

export default function MonthPicker({
  value,
  onChange,
  className = "",
  autoFocus = false,
}: {
  value: string; // "YYYY-MM"
  onChange: (v: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onChange(addMonths(value, -1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onChange(addMonths(value, +1));
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [value, onChange]);

  return (
    <input
      ref={ref}
      type="month"
      className={`rounded-md border border-neutral-300 px-2 py-2 text-sm ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
    />
  );
}
