"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import WorldSeriesStandings from "../../components/WorldSeriesStandings";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";

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
    totalTeams,
    teams,
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
      totalTeams={totalTeams}
      teams={teams}
      onSelectTournament={(tournamentId) => {
        selectTournament(tournamentId);
        router.replace(`/standings?tournamentId=${tournamentId}`);
      }}
    />
  );
}

export default function StandingsPage() {
  return (
    <Suspense fallback={<div className="bf-dash-empty">Cargando standings…</div>}>
      <StandingsPageClient />
    </Suspense>
  );
}
