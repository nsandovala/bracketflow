"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import RouletteArena from "../../components/RouletteArena";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function EquiposPageClient() {
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const {
    loading,
    submitting,
    message,
    selectedTournament,
    selectedEngine,
    players,
    teams,
    importParticipants,
    removeParticipant,
    clearParticipants,
    openRosterWindow,
    closeRosterWindow,
    lockRosterWindow,
    generateRouletteForSelected,
  } = useWorldSeriesPractice(preferredTournamentId);

  if (loading) {
    return <main className="bf-page"><p className="bf-empty">Cargando equipos...</p></main>;
  }

  if (!selectedTournament || !selectedEngine) {
    return <main className="bf-page"><p className="bf-empty">No hay torneo activo.</p></main>;
  }

  return (
    <main className="bf-page">
      {message ? <p className="bf-message">{message}</p> : null}
      {selectedEngine.rosterPolicy === "roulette" ? (
        <>
          {/* No duplicar el H1 en titulos internos. */}
          <RouletteArena
            tournament={selectedTournament}
            engine={selectedEngine}
            players={players}
            teams={teams}
            submitting={submitting}
            onImportParticipants={importParticipants}
            onRemoveParticipant={removeParticipant}
            onClearParticipants={clearParticipants}
            onSpinRoulette={generateRouletteForSelected}
            onOpenRosterRespin={openRosterWindow}
            onCloseRosterRespin={closeRosterWindow}
            onLockRosterRespin={lockRosterWindow}
          />
        </>
      ) : (
        <section className="opr-panel">
          {/* No duplicar el H1 en titulos internos. */}
          <div className="opr-eyebrow">Squad fijo</div>
          <h2>Setup de roster</h2>
          <p className="sub">
            Este motor usa squad fijo. La carga de equipos se mantiene en Operator.
          </p>
        </section>
      )}
    </main>
  );
}

export default function EquiposPage() {
  return (
    <Suspense fallback={<main className="bf-page"><p className="bf-empty">Cargando equipos...</p></main>}>
      <EquiposPageClient />
    </Suspense>
  );
}
