"use client";

import { useEffect } from "react";

/**
 * Convierte a MAYÚSCULAS todo lo que el usuario escribe en inputs de texto y
 * textareas de la app, de forma global, salvo:
 *  - campos de login / contraseña (por `type`, `autocomplete` o data-no-uppercase)
 *  - inputs no textuales (email, número, fecha, etc.)
 *  - cualquier campo (o contenedor) marcado con `data-no-uppercase`
 *
 * Usa un listener en fase de captura + el setter nativo del value para que el
 * cambio sea detectado por los componentes controlados de React.
 */

// type de <input> que NO se transforman
const EXCLUDED_TYPES = new Set([
  "password",
  "email",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "tel",
  "url",
  "color",
  "file",
  "checkbox",
  "radio",
  "range",
  "hidden",
  "image",
  "submit",
  "button",
  "reset",
]);

// autocomplete de campos sensibles (login / contraseña)
const EXCLUDED_AUTOCOMPLETE = new Set([
  "username",
  "email",
  "current-password",
  "new-password",
  "one-time-code",
]);

function shouldSkip(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement) {
    const t = (el.type || "text").toLowerCase();
    if (EXCLUDED_TYPES.has(t)) return true;
  }
  const ac = (el.getAttribute("autocomplete") || "").toLowerCase();
  if (ac && EXCLUDED_AUTOCOMPLETE.has(ac)) return true;
  if (el.hasAttribute("data-no-uppercase")) return true;
  if (el.closest("[data-no-uppercase]")) return true;
  return false;
}

function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

export default function UppercaseInputs() {
  useEffect(() => {
    const onInput = (e: Event) => {
      // Respetar composición (acentos con tecla muerta, IME)
      if ((e as InputEvent).isComposing) return;

      const el = e.target;
      if (
        !(el instanceof HTMLInputElement) &&
        !(el instanceof HTMLTextAreaElement)
      )
        return;
      if (shouldSkip(el)) return;

      const v = el.value;
      const up = v.toUpperCase();
      if (up === v) return;

      const start = el.selectionStart;
      const end = el.selectionEnd;
      setNativeValue(el, up);
      try {
        if (start != null && end != null) el.setSelectionRange(start, end);
      } catch {
        /* algunos type no soportan selección */
      }
    };

    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);

  return null;
}
