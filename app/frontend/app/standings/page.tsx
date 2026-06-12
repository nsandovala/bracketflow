"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import WorldSeriesStandings from "../components/WorldSeriesStandings";
import { useWorldSeriesPractice } from "../lib/useWorldSeriesPractice";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function StandingsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    tournaments,
    selectedTournamentId,
    selectedTournament,
    sortedStandings,
    latestReportedRound,
    selectTournament,
  } = useWorldSeriesPractice(preferredTournamentId);

  useEffect(() => {
    if (selectedTournamentId !== null && selectedTournamentId !== preferredTournamentId) {
      router.replace(`/standings?tournamentId=${selectedTournamentId}`);
    }
  }, [preferredTournamentId, router, selectedTournamentId]);

  return (
    <WorldSeriesStandings
      tournaments={tournaments}
      selectedTournamentId={selectedTournamentId}
      selectedTournament={selectedTournament}
      standings={sortedStandings}
      afterGameNumber={latestReportedRound}
      onSelectTournament={(tournamentId) => {
        selectTournament(tournamentId);
        router.replace(`/standings?tournamentId=${tournamentId}`);
      }}
    />
  );
}

export default function StandingsPage() {
  return (
    <Suspense fallback={<main className="bf-page"><p className="bf-empty">Cargando standings...</p></main>}>
      <StandingsPageClient />
    </Suspense>
  );
}
