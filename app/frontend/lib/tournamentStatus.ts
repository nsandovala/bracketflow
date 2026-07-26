import type {
  Match,
  MatchCompletionPolicy,
  Team,
} from "./api";

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
  displayName: string;
  finalScore: string;
  rosterText: string;
  round: number;
  matchId: number;
};

export type MatchPointStatus =
  | { state: "idle" }
  | {
      state: "not_configured";
      code: "MATCH_POINT_NOT_CONFIGURED";
      action: "configure_match_point";
      reason: string;
    }
  | { state: "disabled"; reason: string }
  | { state: "unsupported"; reason: string }
  | {
      state: "champion";
      champion: Team;
      championLabel: string;
      threshold: number;
      decidedAt?: string;
    }
  | {
      state: "threshold_reached";
      leaderName: string;
      leaderPoints: number;
      threshold: number;
      reason: "incomplete_match" | "tie" | "pending_sync";
    };

export function getMatchPointStatusFromPolicy({
  policy,
  teams,
}: {
  policy: MatchCompletionPolicy | null;
  teams: Team[];
}): MatchPointStatus {
  if (!policy) {
    return { state: "idle" };
  }
  if (policy.state === "match_point_not_configured") {
    return {
      state: "not_configured",
      code: "MATCH_POINT_NOT_CONFIGURED",
      action: "configure_match_point",
      reason: policy.reason,
    };
  }
  if (policy.state === "disabled") {
    return { state: "disabled", reason: policy.reason };
  }
  if (policy.state === "unsupported") {
    return { state: "unsupported", reason: policy.reason };
  }
  if (
    policy.state === "completed" &&
    policy.championTeamId !== null &&
    policy.matchPointThreshold !== null
  ) {
    const champion = teams.find((team) => team.id === policy.championTeamId);
    if (champion) {
      return {
        state: "champion",
        champion,
        championLabel: policy.championTeamName ?? getTeamDisplayName(champion),
        threshold: policy.matchPointThreshold,
      };
    }
  }
  if (
    policy.state === "threshold_reached" &&
    policy.leaderTeamName &&
    policy.leaderPoints !== null &&
    policy.matchPointThreshold !== null
  ) {
    return {
      state: "threshold_reached",
      leaderName: policy.leaderTeamName,
      leaderPoints: policy.leaderPoints,
      threshold: policy.matchPointThreshold,
      reason:
        policy.code === "MATCH_POINT_TIE"
          ? "tie"
          : policy.code === "MATCH_POINT_PENDING_CONFIRMATION"
            ? "pending_sync"
            : "incomplete_match",
    };
  }
  return { state: "idle" };
}

const GENERIC_TEAM_NAME = /^(team|equipo)\s+\d+$/i;

export function isGenericTeamName(name: string | null | undefined) {
  return GENERIC_TEAM_NAME.test((name ?? "").trim());
}

export function getTeamRosterText(team: Team) {
  return team.members
    .map((m) => m.player.nickname.trim())
    .filter((nickname) => nickname.length > 0)
    .join(" / ");
}

export function getTeamDisplayName(team: Team, fallback = "Equipo sin nombre") {
  const rosterText = getTeamRosterText(team);
  const name = team.name.trim();
  if (name.length > 0 && !isGenericTeamName(name)) {
    return name;
  }
  return rosterText || fallback;
}

export function getTeamShortDisplayName(team: Team, maxNames: number, fallback = "Equipo sin nombre") {
  const roster = getTeamRosterText(team);
  if (roster.length > 0 && isGenericTeamName(team.name)) {
    const players = roster.split(" / ");
    const visible = players.slice(0, maxNames).join(" / ");
    return players.length > maxNames ? `${visible} +${players.length - maxNames}` : visible;
  }
  return getTeamDisplayName(team, fallback);
}

export function getMatchPointStatusMessage(status: MatchPointStatus) {
  if (status.state === "not_configured") {
    return status.reason;
  }
  if (status.state === "disabled" || status.state === "unsupported") {
    return status.reason;
  }
  if (status.state === "champion") {
    return `Campeón por Match Point: ${status.championLabel}.`;
  }
  if (status.state !== "threshold_reached") {
    return null;
  }
  return "Match Point alcanzado: falta cerrar partida completa o resolver desempate.";
}

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
        const roster = getTeamRosterText(championTeam);
        const finalScore = `${match.maps_won_a ?? 0}-${match.maps_won_b ?? 0}`;
        return {
          team: championTeam,
          displayName: getTeamDisplayName(championTeam),
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
