"use client";

import { useSyncExternalStore } from "react";

// Broadcast Setup v0 — configuracion de presentacion de stream/caster.
// Persistencia SOLO en localStorage (v0, sin backend). Namespace versionado
// para poder migrar el shape mas adelante sin romper datos viejos.
export const BROADCAST_SETUP_KEY = "bracketflow.broadcastSetup.v1";

// Evento propio para que consumidores en la MISMA pestaña (ej. Caster Hub)
// reaccionen a un guardado. El evento nativo `storage` solo cruza pestañas.
export const BROADCAST_SETUP_EVENT = "bracketflow:broadcast-setup";

export type OverlayLayout = "sidebar" | "lower-third" | "matchpoint" | "mvp" | "leaderboard";
export type BroadcastTheme = "default" | "iridescent" | "minimal";
export type ObsTarget = "1920x1080" | "1280x720";

export type BroadcastSetup = {
  eventName: string;
  organizer: string;
  casterName: string;
  brandMark: string;
  defaultLayout: OverlayLayout;
  theme: BroadcastTheme;
  obsTarget: ObsTarget;
  transparentDefault: boolean;
};

export const LAYOUT_OPTIONS: ReadonlyArray<{ value: OverlayLayout; label: string }> = [
  { value: "sidebar", label: "Sidebar" },
  { value: "lower-third", label: "Lower third" },
  { value: "matchpoint", label: "Match point" },
  { value: "mvp", label: "MVP" },
  { value: "leaderboard", label: "Leaderboard" },
];

export const THEME_OPTIONS: ReadonlyArray<{ value: BroadcastTheme; label: string }> = [
  { value: "default", label: "Default" },
  { value: "iridescent", label: "Iridescent" },
  { value: "minimal", label: "Minimal" },
];

export const OBS_TARGET_OPTIONS: ReadonlyArray<{ value: ObsTarget; label: string }> = [
  { value: "1920x1080", label: "1920 × 1080" },
  { value: "1280x720", label: "1280 × 720" },
];

// Defaults seguros: sin evento/caster (los llena el operador), organizador y
// marca con el branding actual, overlay sidebar y target 1080p transparente.
export const DEFAULT_BROADCAST_SETUP: BroadcastSetup = {
  eventName: "",
  organizer: "Gedeon Esport",
  casterName: "",
  brandMark: "BF",
  defaultLayout: "sidebar",
  theme: "default",
  obsTarget: "1920x1080",
  transparentDefault: true,
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asEnum<T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  return typeof value === "string" && (allowed as ReadonlyArray<string>).includes(value)
    ? (value as T)
    : fallback;
}

// Normaliza cualquier payload (parcial, corrupto o de una version previa) a un
// BroadcastSetup completo y valido, cayendo a defaults campo por campo.
export function normalizeBroadcastSetup(raw: unknown): BroadcastSetup {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    eventName: asString(source.eventName, DEFAULT_BROADCAST_SETUP.eventName),
    organizer: asString(source.organizer, DEFAULT_BROADCAST_SETUP.organizer),
    casterName: asString(source.casterName, DEFAULT_BROADCAST_SETUP.casterName),
    brandMark: asString(source.brandMark, DEFAULT_BROADCAST_SETUP.brandMark),
    defaultLayout: asEnum(
      source.defaultLayout,
      LAYOUT_OPTIONS.map((option) => option.value),
      DEFAULT_BROADCAST_SETUP.defaultLayout
    ),
    theme: asEnum(
      source.theme,
      THEME_OPTIONS.map((option) => option.value),
      DEFAULT_BROADCAST_SETUP.theme
    ),
    obsTarget: asEnum(
      source.obsTarget,
      OBS_TARGET_OPTIONS.map((option) => option.value),
      DEFAULT_BROADCAST_SETUP.obsTarget
    ),
    transparentDefault:
      typeof source.transparentDefault === "boolean"
        ? source.transparentDefault
        : DEFAULT_BROADCAST_SETUP.transparentDefault,
  };
}

export function loadBroadcastSetup(): BroadcastSetup {
  if (typeof window === "undefined") {
    return { ...DEFAULT_BROADCAST_SETUP };
  }
  try {
    const raw = window.localStorage.getItem(BROADCAST_SETUP_KEY);
    if (!raw) {
      return { ...DEFAULT_BROADCAST_SETUP };
    }
    return normalizeBroadcastSetup(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BROADCAST_SETUP };
  }
}

export function saveBroadcastSetup(value: BroadcastSetup): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(BROADCAST_SETUP_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(BROADCAST_SETUP_EVENT));
  } catch {
    // Almacenamiento no disponible (modo privado / cuota): v0 degrada en silencio.
  }
}

// Snapshot cacheado para useSyncExternalStore: debe devolver la MISMA
// referencia mientras el raw de localStorage no cambie, si no React entra en
// un loop de renders. Recalcula solo cuando el string persistido cambia.
let cachedRaw: string | null = null;
let cachedSetup: BroadcastSetup = DEFAULT_BROADCAST_SETUP;

function getSnapshot(): BroadcastSetup {
  if (typeof window === "undefined") {
    return DEFAULT_BROADCAST_SETUP;
  }
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(BROADCAST_SETUP_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    if (!raw) {
      cachedSetup = DEFAULT_BROADCAST_SETUP;
    } else {
      try {
        cachedSetup = normalizeBroadcastSetup(JSON.parse(raw));
      } catch {
        cachedSetup = DEFAULT_BROADCAST_SETUP;
      }
    }
  }
  return cachedSetup;
}

function getServerSnapshot(): BroadcastSetup {
  return DEFAULT_BROADCAST_SETUP;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === BROADCAST_SETUP_KEY) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BROADCAST_SETUP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BROADCAST_SETUP_EVENT, onChange);
  };
}

// Hook de solo lectura para consumidores (Caster Hub). useSyncExternalStore
// resuelve SSR (getServerSnapshot = defaults) sin mismatch de hidratacion y se
// resincroniza ante guardados propios (misma pestaña) o `storage` (otras).
export function useBroadcastSetup(): { setup: BroadcastSetup } {
  const setup = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { setup };
}

// Etiquetas legibles para mostrar en helpers/resumen sin re-mapear en cada vista.
export function layoutLabel(layout: OverlayLayout): string {
  return LAYOUT_OPTIONS.find((option) => option.value === layout)?.label ?? layout;
}

export function themeLabel(theme: BroadcastTheme): string {
  return THEME_OPTIONS.find((option) => option.value === theme)?.label ?? theme;
}
