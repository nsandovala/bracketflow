import type { Match, Team } from "./api";

export const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  teams_generated: "Equipos listos",
  bracket_generated: "Bracket listo",
  bracket_ready: "Bracket listo",
  running: "En operación",
  completed: "Finalizado",
  archived: "Archivado",
  pending: "Pendiente",
  ready: "Listo",
  in_progress: "En vivo",
  waiting_opponent: "Esperando oponente",
  respin_open: "Respin abierto",
  locked: "Bloqueado",
};

export function getTournamentStatusLabel(status: string | null | undefined): string {
  if (!status) return "Estado desconocido";
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

export function getMatchStatusLabel(status: string | null | undefined): string {
  if (!status) return "Pendiente";
  return STATUS_LABELS[status.toLowerCase()] ?? status;
}

export type ChampionInfo = {
  team: Team;
  finalScore: string;
  rosterText: string;
  round: number;
  matchId: number;
};

export function findChampion(matches: Match[], teams: Team[]): ChampionInfo | null {
  if (matches.length === 0 || teams.length === 0) {
    return null;
  }

  const finalRound = Math.max(...matches.map((m) => m.round));
  const finalMatches = matches.filter((m) => m.round === finalRound);

  for (const match of finalMatches) {
    if (match.status === "completed" && match.winner_id !== null) {
      const championTeam = teams.find((t) => t.id === match.winner_id);
      if (championTeam) {
        const roster = championTeam.members
          .map((m) => m.player.nickname)
          .join(" / ");
        const finalScore = `${match.maps_won_a ?? 0}-${match.maps_won_b ?? 0}`;
        return {
          team: championTeam,
          finalScore,
          rosterText: roster || "Roster pendiente",
          round: match.round,
          matchId: match.id,
        };
      }
    }
  }

  return null;
}

export function isTournamentCompleted(matches: Match[]): boolean {
  if (matches.length === 0) return false;
  const finalRound = Math.max(...matches.map((m) => m.round));
  const finalMatches = matches.filter((m) => m.round === finalRound);
  return finalMatches.every((m) => m.status === "completed" && m.winner_id !== null);
}

export function getTournamentPhase(matches: Match[], tournamentStatus?: string | null): string {
  if (!matches.length) {
    if (tournamentStatus === "teams_generated") return "Equipos listos";
    return "Setup";
  }

  if (isTournamentCompleted(matches)) return "Finalizado";

  const hasInProgress = matches.some((m) => m.status === "in_progress");
  if (hasInProgress) return "En operación";

  const hasReady = matches.some((m) => m.status === "ready");
  if (hasReady) return "Listo para operar";

  return "En operación";
}
