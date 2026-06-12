"use client";

import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";
import WorldSeriesStreamView from "../components/WorldSeriesStreamView";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function StreamPageClient() {
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));
  const { selectedTournament, sortedStandings, latestReportedRound } =
    useWorldSeriesPractice(preferredTournamentId);

  return (
    <WorldSeriesStreamView
      tournament={selectedTournament}
      afterGameNumber={latestReportedRound}
      standings={sortedStandings}
    />
  );
}

export default function StreamPage() {
  return (
    <Suspense fallback={<main className="bf-stream-page"><p className="bf-stream-empty">Cargando stream view...</p></main>}>
      <StreamPageClient />
    </Suspense>
  );
}
