"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import WorldSeriesOperator from "../../components/WorldSeriesOperator";
import { useWorldSeriesPractice } from "../../lib/useWorldSeriesPractice";

function parseTournamentId(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function OperatorPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferredTournamentId = parseTournamentId(searchParams.get("tournamentId"));

  const {
    backendOnline,
    message,
    tournaments,
    selectedTournamentId,
    selectedTournament,
    teams,
    matches,
    players,
    activeMatch,
    activeMatchResults,
    pendingTeams,
    reportsLoaded,
    totalTeams,
    latestReportedRound,
    canCreateNextGame,
    selectedEngine,
    nextGameNumber,
    submitting,
    resultDrafts,
    killRaceMapDrafts,
    updateResultDraft,
    updateKillRaceMapDraft,
    selectTournament,
    importParticipants,
    removeParticipant,
    clearParticipants,
    createTeamWithRoster,
    lockBracketWindow,
    lockRosterWindow,
    openBracketWindow,
    openRosterWindow,
    generateRouletteForSelected,
    generateBracketForSelected,
    createNextGame,
    saveTeamReport,
    saveKillRaceMap,
  } = useWorldSeriesPractice(preferredTournamentId);

  const [teamName, setTeamName] = useState("");
  const [teamRoster, setTeamRoster] = useState("");
  const [teamFormError, setTeamFormError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTournamentId !== null && selectedTournamentId !== preferredTournamentId) {
      router.replace(`/operator?tournamentId=${selectedTournamentId}`);
    }
  }, [preferredTournamentId, router, selectedTournamentId]);

  async function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTeamFormError(null);

    try {
      await createTeamWithRoster({ name: teamName, roster: teamRoster });
      setTeamName("");
      setTeamRoster("");
    } catch (error) {
      if (error instanceof Error) {
        setTeamFormError(error.message);
      } else {
        setTeamFormError("No se pudo crear el equipo.");
      }
    }
  }

  async function handleBulkImportTeams(teamsToImport: Array<{ name: string; roster: string }>) {
    setTeamFormError(null);
    const errors: string[] = [];
    for (const team of teamsToImport) {
      try {
        await createTeamWithRoster(team);
      } catch {
        errors.push(team.name);
      }
    }
    if (errors.length > 0) {
      setTeamFormError(`No se pudieron importar: ${errors.join(", ")}`);
    }
  }

  return (
    <WorldSeriesOperator
      backendOnline={backendOnline}
      message={message}
      tournaments={tournaments}
      selectedTournamentId={selectedTournamentId}
      selectedTournament={selectedTournament}
      teams={teams}
      matches={matches}
      players={players}
      activeMatch={activeMatch}
      activeMatchResults={activeMatchResults}
      pendingTeams={pendingTeams}
      reportsLoaded={reportsLoaded}
      totalTeams={totalTeams}
      latestReportedRound={latestReportedRound}
      canCreateNextGame={canCreateNextGame}
      selectedEngine={selectedEngine}
      nextGameNumber={nextGameNumber}
      submitting={submitting}
      teamName={teamName}
      teamRoster={teamRoster}
      teamFormError={teamFormError}
      resultDrafts={resultDrafts}
      killRaceMapDrafts={killRaceMapDrafts}
      onSelectTournament={(tournamentId) => {
        selectTournament(tournamentId);
        router.replace(`/operator?tournamentId=${tournamentId}`);
      }}
      onTeamNameChange={setTeamName}
      onTeamRosterChange={setTeamRoster}
      onCreateTeam={handleCreateTeam}
      onImportParticipants={importParticipants}
      onRemoveParticipant={removeParticipant}
      onClearParticipants={clearParticipants}
      onGenerateRoulette={generateRouletteForSelected}
      onGenerateBracket={generateBracketForSelected}
      onOpenRosterRespin={openRosterWindow}
      onLockRosterRespin={lockRosterWindow}
      onOpenBracketRespin={openBracketWindow}
      onLockBracketRespin={lockBracketWindow}
      onUpdateDraft={updateResultDraft}
      onUpdateKillRaceMapDraft={updateKillRaceMapDraft}
      onSaveTeamReport={(matchId, teamId) => {
        void saveTeamReport(matchId, teamId);
      }}
      onSaveKillRaceMap={(matchId) => {
        void saveKillRaceMap(matchId);
      }}
      onCreateNextGame={() => {
        void createNextGame();
      }}
      onBulkImportTeams={handleBulkImportTeams}
    />
  );
}

export default function OperatorPage() {
  return (
    <Suspense fallback={<main className="bf-page"><p className="bf-empty">Cargando operator view...</p></main>}>
      <OperatorPageClient />
    </Suspense>
  );
}
