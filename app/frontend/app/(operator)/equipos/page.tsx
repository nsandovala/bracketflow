"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import RouletteArena from "../../components/RouletteArena";
import ContextBar from "../../components/ContextBar";
import IdentityRegistry from "../../components/IdentityRegistry";
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
    previewParticipantImport,
    importParticipants,
    removeParticipant,
    clearParticipants,
    openRosterWindow,
    lockRosterWindow,
    generateRouletteForSelected,
  } = useWorldSeriesPractice(preferredTournamentId);

  return (
    <main className="bf-page">
      <IdentityRegistry />
      <div className="identity-tournament-divider">
        <span>Setup del torneo activo</span>
      </div>
      {message ? <p className="bf-message">{message}</p> : null}
      {loading ? <p className="bf-empty">Cargando equipos del torneo...</p> : null}
      {!loading && (!selectedTournament || !selectedEngine) ? (
        <p className="bf-empty">
          No hay torneo activo. El registro de identidad sigue disponible.
        </p>
      ) : null}
      {selectedTournament && selectedEngine ? (
        <>
          <ContextBar
            engineKey={selectedEngine.engineKey}
            tournamentName={selectedTournament.name}
            tournamentId={selectedTournament.id}
            teams={teams}
            tournamentStatus={selectedTournament.status}
          />
          {selectedEngine.rosterPolicy === "roulette" ? (
            <>
              {/* No duplicar el H1 en titulos internos. */}
              <RouletteArena
                tournament={selectedTournament}
                engine={selectedEngine}
                players={players}
                teams={teams}
                submitting={submitting}
                onPreviewParticipants={previewParticipantImport}
                onImportParticipants={importParticipants}
                onRemoveParticipant={removeParticipant}
                onClearParticipants={clearParticipants}
                onConfirmRoulette={generateRouletteForSelected}
                onOpenRosterRespin={openRosterWindow}
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
        </>
      ) : null}
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
