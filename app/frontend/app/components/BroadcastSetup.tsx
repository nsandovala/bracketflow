"use client";

import { FormEvent, useState } from "react";

import {
  BroadcastSetup as BroadcastSetupType,
  DEFAULT_BROADCAST_SETUP,
  LAYOUT_OPTIONS,
  OBS_TARGET_OPTIONS,
  THEME_OPTIONS,
  saveBroadcastSetup,
  useBroadcastSetup,
} from "../lib/broadcastSetup";

// Panel de configuracion de presentacion broadcast (vive en /ajustes dentro del
// shell del operador). El valor persistido viene de useBroadcastSetup (SSR-safe);
// `draft` es la edicion local no guardada. `form = draft ?? persisted`, asi no
// hay setState dentro de un efecto y no hay mismatch de hidratacion.
export default function BroadcastSetup() {
  const { setup: persisted } = useBroadcastSetup();
  const [draft, setDraft] = useState<BroadcastSetupType | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const form = draft ?? persisted;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(persisted);

  function setField<K extends keyof BroadcastSetupType>(key: K, value: BroadcastSetupType[K]) {
    setDraft({ ...form, [key]: value });
    setJustSaved(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveBroadcastSetup(form);
    setDraft(null);
    setJustSaved(true);
  }

  function handleReset() {
    saveBroadcastSetup(DEFAULT_BROADCAST_SETUP);
    setDraft(null);
    setJustSaved(false);
  }

  const statusLabel = dirty
    ? "Cambios sin guardar"
    : justSaved
      ? "Guardado"
      : "Sincronizado";
  const statusTone = dirty ? "is-dirty" : justSaved ? "is-saved" : "is-idle";

  return (
    <section className="bf-bset" aria-label="Broadcast Setup">
      <header className="bf-bset-head">
        <div>
          <span className="bf-bset-eyebrow">Broadcast / OBS</span>
          <h2>Broadcast Setup</h2>
          <p>Perfil de transmisión y valores por defecto para overlays y Caster Hub. Se guarda en este navegador.</p>
        </div>
        <span className={`bf-bset-status ${statusTone}`}>
          <i />
          {statusLabel}
        </span>
      </header>

      <form className="bf-bset-form" onSubmit={handleSubmit}>
        <div className="bf-bset-grid">
          <label className="bf-bset-field">
            <span>Nombre del evento</span>
            <input
              type="text"
              value={form.eventName}
              maxLength={80}
              placeholder="World Series of Warzone R2"
              onChange={(event) => setField("eventName", event.target.value)}
            />
          </label>

          <label className="bf-bset-field">
            <span>Producción / organizador</span>
            <input
              type="text"
              value={form.organizer}
              maxLength={80}
              placeholder="Gedeon Esport"
              onChange={(event) => setField("organizer", event.target.value)}
            />
          </label>

          <label className="bf-bset-field">
            <span>Caster</span>
            <input
              type="text"
              value={form.casterName}
              maxLength={80}
              placeholder="Nombre del caster"
              onChange={(event) => setField("casterName", event.target.value)}
            />
          </label>

          <label className="bf-bset-field">
            <span>Marca / brand corto</span>
            <input
              type="text"
              value={form.brandMark}
              maxLength={24}
              placeholder="BF"
              onChange={(event) => setField("brandMark", event.target.value)}
            />
          </label>

          <label className="bf-bset-field">
            <span>Overlay por defecto</span>
            <select
              value={form.defaultLayout}
              onChange={(event) =>
                setField("defaultLayout", event.target.value as BroadcastSetupType["defaultLayout"])
              }
            >
              {LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="bf-bset-field">
            <span>Tema visual</span>
            <select
              value={form.theme}
              onChange={(event) =>
                setField("theme", event.target.value as BroadcastSetupType["theme"])
              }
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="bf-bset-field">
            <span>Target OBS</span>
            <select
              value={form.obsTarget}
              onChange={(event) =>
                setField("obsTarget", event.target.value as BroadcastSetupType["obsTarget"])
              }
            >
              {OBS_TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="bf-bset-field">
            <span>Fondo transparente por defecto</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.transparentDefault}
              className={`bf-bset-switch${form.transparentDefault ? " is-on" : ""}`}
              onClick={() => setField("transparentDefault", !form.transparentDefault)}
            >
              <i />
              <span>{form.transparentDefault ? "Habilitado" : "Deshabilitado"}</span>
            </button>
          </div>
        </div>

        <footer className="bf-bset-actions">
          <button type="submit" className="bf-bset-save" disabled={!dirty}>
            Guardar
          </button>
          <button type="button" className="bf-bset-reset" onClick={handleReset}>
            Restablecer
          </button>
        </footer>
      </form>
    </section>
  );
}
