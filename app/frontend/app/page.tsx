"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import AppTopbar from "./components/AppTopbar";
import { useWorldSeriesPractice } from "./lib/useWorldSeriesPractice";

export default function Home() {
  const {
    backendOnline,
    loading,
    submitting,
    message,
    tournaments,
    createWorldSeriesTournament,
  } = useWorldSeriesPractice();

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentGame, setTournamentGame] = useState("Warzone");

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
        subtitle="World Series Practice · Warzone LATAM"
        showBackendStatus
        backendOnline={backendOnline}
      />

      {message ? <p className="bf-message">{message}</p> : null}

      {/* ---- Hero: crear torneo ---- */}
      <section className="bf-hub-hero">
        <div className="bf-hub-hero-copy">
          <span className="bf-hub-eyebrow">World Series Practice</span>
          <h2 className="bf-hub-title">
            Tu torneo,<br />listo para transmitir.
          </h2>
          <p className="bf-hub-sub">
            Carga partidas, calcula puntos y saca standings al stream en segundos.
          </p>
        </div>

        <form className="bf-hub-form" onSubmit={handleCreateTournament}>
          <label className="bf-field">
            <span>Nombre del torneo</span>
            <input
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="WS Practice LATAM"
              required
            />
          </label>
          <label className="bf-field">
            <span>Juego</span>
            <input
              value={tournamentGame}
              onChange={(e) => setTournamentGame(e.target.value)}
              placeholder="Warzone"
              required
            />
          </label>
          <button
            type="submit"
            className="bf-button bf-button-primary bf-button-hero"
            disabled={submitting}
          >
            {submitting ? "Creando…" : "Crear torneo"}
          </button>
        </form>
      </section>

      {/* ---- Prácticas en curso ---- */}
      {loading || tournaments.length > 0 ? (
        <section className="bf-hub-active">
          <span className="bf-hub-section-kicker">Prácticas en curso</span>
          {loading ? (
            <p className="bf-empty">Cargando torneos…</p>
          ) : (
            <div className="bf-hub-tournament-list">
              {tournaments.map((tournament) => (
                <article key={tournament.id} className="bf-hub-tournament-card">
                  <div className="bf-hub-tournament-info">
                    <strong className="bf-hub-tournament-name">{tournament.name}</strong>
                    <span className="bf-hub-tournament-meta">
                      <span className="bf-hub-tournament-game">{tournament.game}</span>
                      <span className="bf-hub-tournament-status">{tournament.status}</span>
                    </span>
                  </div>
                  <div className="bf-hub-tournament-actions">
                    <Link
                      href={`/operator?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-primary"
                    >
                      Operator
                    </Link>
                    <Link
                      href={`/standings?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-ghost"
                    >
                      Standings
                    </Link>
                    <Link
                      href={`/stream?tournamentId=${tournament.id}`}
                      className="bf-button bf-button-ghost"
                    >
                      Stream
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ---- Formatos alternativos (comprimido) ---- */}
      <section className="bf-hub-formats">
        <span className="bf-hub-section-kicker">Otros formatos</span>
        <div className="bf-hub-format-chips">
          <span className="bf-hub-format-chip">Classic Bracket</span>
          <span className="bf-hub-format-chip">Kill Race 2v2</span>
          <span className="bf-hub-format-chip">Kill Race 3v3</span>
          <span className="bf-hub-format-chip">Round Robin</span>
        </div>
      </section>
    </main>
  );
}
