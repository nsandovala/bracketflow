"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import AppTopbar from "./components/AppTopbar";
import GlassPanel from "./components/GlassPanel";
import ModeCard from "./components/ModeCard";
import SectionHeader from "./components/SectionHeader";
import StatusBadge from "./components/StatusBadge";
import { useWorldSeriesPractice } from "./lib/useWorldSeriesPractice";

export default function Home() {
  const {
    backendOnline,
    loading,
    submitting,
    message,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    createWorldSeriesTournament,
    selectTournament,
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");

  const activeQuery = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";

  const documentedModes = useMemo(
    () => [
      {
        id: "classic",
        label: "Classic Bracket",
        description: "Documentado para eliminacion directa.",
      },
      {
        id: "kill-race-2v2",
        label: "Kill Race 2v2",
        description: "Documentado para parejas con kills.",
      },
      {
        id: "kill-race-3v3",
        label: "Kill Race 3v3",
        description: "Documentado para trios con kills.",
      },
      {
        id: "round-robin",
        label: "Round Robin",
        description: "Proximamente.",
      },
    ],
    []
  );

  async function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const created = await createWorldSeriesTournament({
      name: tournamentName,
      game: tournamentGame,
    });

    if (created) {
      setTournamentName("");
      setTournamentGame("Warzone");
    }
  }

  return (
    <main className="bf-page">
      <AppTopbar
        title="BracketFlow"
        subtitle="World Series Practice para Warzone y esports LATAM."
        showBackendStatus
        backendOnline={backendOnline}
      />

      {message ? <p className="bf-message">{message}</p> : null}

      <section className="bf-home-grid">
        <GlassPanel className="bf-home-hero">
          <SectionHeader
            eyebrow="Main Mode"
            title="World Series Practice"
            subtitle="Tu torneo, listo para transmitir. Carga partidas, calcula puntos y saca standings al stream en segundos."
          />

          <div className="bf-chip-cloud">
            <StatusBadge tone="live" label="Warzone LATAM" />
            <StatusBadge tone="neutral" label="Operator / Standings / Stream" />
          </div>

          <form className="bf-form bf-home-form" onSubmit={handleCreateTournament}>
            <div className="bf-form-grid">
              <label className="bf-field">
                <span>Nombre del torneo</span>
                <input
                  value={tournamentName}
                  onChange={(event) => setTournamentName(event.target.value)}
                  placeholder="WS Practice LATAM"
                  required
                />
              </label>

              <label className="bf-field">
                <span>Juego</span>
                <input
                  value={tournamentGame}
                  onChange={(event) => setTournamentGame(event.target.value)}
                  placeholder="Warzone"
                  required
                />
              </label>
            </div>

            <button type="submit" className="bf-button bf-button-primary" disabled={submitting}>
              {submitting ? "Creando..." : "Crear torneo"}
            </button>
          </form>
        </GlassPanel>

        <GlassPanel className="bf-home-side">
          <SectionHeader
            eyebrow="Torneos Activos"
            title="Practicas en curso"
            subtitle="Selecciona un torneo y abre la vista que necesitas."
          />

          {loading ? <p className="bf-empty">Cargando torneos...</p> : null}
          {!loading && tournaments.length === 0 ? (
            <p className="bf-empty">Todavia no hay torneos World Series Practice.</p>
          ) : null}

          {!loading && tournaments.length > 0 ? (
            <div className="bf-list">
              {tournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  type="button"
                  className={`bf-list-card ${selectedTournamentId === tournament.id ? "is-selected" : ""}`}
                  onClick={() => selectTournament(tournament.id)}
                >
                  <strong>{tournament.name}</strong>
                  <span>{tournament.game}</span>
                  <small>{tournament.status}</small>
                </button>
              ))}
            </div>
          ) : null}

          {selectedTournament ? (
            <div className="bf-home-cta-grid">
              <Link href={`/operator${activeQuery}`} className="bf-button bf-button-primary">
                Abrir Operator
              </Link>
              <Link href={`/standings${activeQuery}`} className="bf-button bf-button-ghost">
                Abrir Standings
              </Link>
              <Link href={`/stream${activeQuery}`} className="bf-button bf-button-ghost">
                Abrir Stream
              </Link>
            </div>
          ) : null}
        </GlassPanel>
      </section>

      <GlassPanel className="bf-home-secondary">
        <SectionHeader
          eyebrow="Otros Modos"
          title="Formatos alternativos"
        />

        <div className="bf-hub-options">
          {documentedModes.map((mode, index) => (
            <ModeCard
              key={mode.id}
              index={index + 1}
              label={mode.label}
              description={mode.description}
              selected={false}
              disabled
              badge="Secundario"
              onSelect={() => {}}
            />
          ))}
        </div>
      </GlassPanel>
    </main>
  );
}
