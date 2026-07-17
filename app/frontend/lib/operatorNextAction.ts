import type { Match, Tournament } from "./api";
import type { ResolvedTournamentEngine } from "./tournamentModel";
import type { MatchPointStatus } from "./tournamentStatus";
import { isTournamentCompleted } from "./tournamentStatus";

export type PushModeActionKind =
  | "NO_TOURNAMENT"
  | "SETUP_REQUIRED"
  | "ROULETTE_REQUIRED"
  | "ROSTER_READY"
  | "CREATE_FIRST_MATCH"
  | "LOAD_REPORTS"
  | "CLOSE_MATCH"
  | "MATCH_POINT_REACHED"
  | "RESOLVE_TIE"
  | "CREATE_NEXT_MATCH"
  | "BRACKET_READY"
  | "BRACKET_ACTIVE"
  | "TOURNAMENT_COMPLETED"
  | "BACKEND_OFFLINE";

export type PushModeAction = {
  kind: PushModeActionKind;
  label: string;
  description: string;
  reason: string;
  ctaLabel: string;
  href: string;
  tone: "ready" | "pending" | "warning" | "done" | "blocked";
  priority: number;
  pendingCount?: number;
};

export type PushModeContext = {
  tournament: Tournament | null;
  engine?: ResolvedTournamentEngine | null;
  backendOnline?: boolean;
  teamsCount?: number;
  participantsCount?: number;
  matches?: readonly Match[];
  activeMatch?: Match | null;
  reportsLoaded?: number;
  totalTeams?: number;
  matchPointStatus?: MatchPointStatus;
  canCreateNextMatch?: boolean;
};

function action(
  value: Omit<PushModeAction, "href"> & { href?: string },
  tournamentId?: number,
): PushModeAction {
  const query = tournamentId ? `?tournamentId=${tournamentId}` : "";
  return { ...value, href: value.href ?? `/operator${query}` };
}

export function getOperatorNextAction(context: PushModeContext): PushModeAction {
  const { tournament, engine } = context;

  if (context.backendOnline === false) {
    return action({
      kind: "BACKEND_OFFLINE",
      label: "Backend sin conexión",
      description: "No hay lectura confiable del estado operativo.",
      reason: "Push Mode necesita datos actuales antes de sugerir una mutación.",
      ctaLabel: "Ir a Torneos",
      href: "/torneos",
      tone: "blocked",
      priority: 100,
    });
  }

  if (!tournament) {
    return action({
      kind: "NO_TOURNAMENT",
      label: "Seleccionar torneo",
      description: "El cockpit todavía no tiene contexto activo.",
      reason: "Selecciona o crea un torneo antes de operar.",
      ctaLabel: "Ir a Torneos",
      href: "/torneos",
      tone: "pending",
      priority: 90,
    });
  }

  const tournamentId = tournament.id;
  const operatorHref = `/operator?tournamentId=${tournamentId}`;
  const standingsHref = `/standings?tournamentId=${tournamentId}`;
  const bracketHref = `/operator?tournamentId=${tournamentId}&tab=bracket`;
  const matches = context.matches;
  const matchPointStatus = context.matchPointStatus;
  const bracketCompleted = engine?.primaryView === "bracket" && matches
    ? isTournamentCompleted([...matches])
    : false;
  const championConfirmed =
    tournament.status === "completed" ||
    (typeof tournament.config?.championTeamId === "number" && tournament.config.championTeamId > 0) ||
    matchPointStatus?.state === "champion" ||
    bracketCompleted;

  if (championConfirmed) {
    return action({
      kind: "TOURNAMENT_COMPLETED",
      label: engine?.primaryView === "bracket" ? "Ver bracket final" : "Ver resultado final",
      description: "El torneo ya tiene un cierre confirmado.",
      reason: "Ya existe campeón o estado final persistido.",
      ctaLabel: engine?.primaryView === "bracket" ? "Ver bracket final" : "Ver Standings",
      href: engine?.primaryView === "bracket" ? bracketHref : standingsHref,
      tone: "done",
      priority: 80,
    }, tournamentId);
  }

  if (matchPointStatus?.state === "threshold_reached") {
    const tie = matchPointStatus.reason === "tie";
    return action({
      kind: tie ? "RESOLVE_TIE" : "MATCH_POINT_REACHED",
      label: tie ? "Resolver desempate" : "Resolver Match Point",
      description: "El umbral competitivo ya fue alcanzado.",
      reason: tie
        ? "La tabla mantiene un empate que bloquea la coronación."
        : "Falta cerrar la partida completa o confirmar el avance.",
      ctaLabel: "Ir a Operator",
      href: operatorHref,
      tone: "warning",
      priority: 75,
    }, tournamentId);
  }

  const rouletteConfirmed = tournament.config?.rouletteStatus === "confirmed";
  const explicitNoTeams = context.teamsCount === 0;
  const metadataNeedsSetup =
    tournament.status === "draft" ||
    tournament.roster_status === "participants_pending";

  if (engine?.rosterPolicy === "roulette" && !rouletteConfirmed) {
    return action({
      kind: "ROULETTE_REQUIRED",
      label: "Generar equipos por ruleta",
      description: "Este motor necesita convertir participantes en equipos confirmados.",
      reason: context.participantsCount === 0
        ? "Primero carga el pool de participantes y luego confirma la ruleta."
        : "La ruleta aún no figura como confirmada.",
      ctaLabel: "Ir a Ruleta",
      href: `${operatorHref}&roulette=1`,
      tone: "pending",
      priority: 70,
    }, tournamentId);
  }

  if (explicitNoTeams || metadataNeedsSetup) {
    return action({
      kind: "SETUP_REQUIRED",
      label: "Completar setup",
      description: "El torneo todavía no tiene equipos listos para operar.",
      reason: "Falta completar o confirmar el roster.",
      ctaLabel: "Ir a Setup",
      href: operatorHref,
      tone: "pending",
      priority: 65,
    }, tournamentId);
  }

  if (engine?.primaryView === "bracket") {
    if (!matches || matches.length === 0 || tournament.bracket_status === "pending") {
      return action({
        kind: "BRACKET_READY",
        label: "Preparar bracket",
        description: "El roster está listo para generar o revisar la llave.",
        reason: "Todavía no hay series operables confirmadas.",
        ctaLabel: "Ir a Bracket",
        href: bracketHref,
        tone: "ready",
        priority: 60,
      }, tournamentId);
    }

    return action({
      kind: "BRACKET_ACTIVE",
      label: "Continuar bracket",
      description: "La llave tiene series por operar o propagar.",
      reason: "Existe un bracket activo sin campeón confirmado.",
      ctaLabel: "Ir a Bracket",
      href: bracketHref,
      tone: "ready",
      priority: 55,
    }, tournamentId);
  }

  if (context.activeMatch) {
    const totalTeams = context.totalTeams ?? context.teamsCount;
    const reportsLoaded = context.reportsLoaded;
    const pendingCount = totalTeams !== undefined && reportsLoaded !== undefined
      ? Math.max(totalTeams - reportsLoaded, 0)
      : undefined;

    if (pendingCount !== undefined && pendingCount > 0) {
      return action({
        kind: "LOAD_REPORTS",
        label: `Cargar ${pendingCount} ${pendingCount === 1 ? "reporte" : "reportes"}`,
        description: "La partida activa todavía está incompleta.",
        reason: `Faltan ${pendingCount} ${pendingCount === 1 ? "equipo" : "equipos"} por reportar.`,
        ctaLabel: "Ir a Operator",
        href: operatorHref,
        tone: "pending",
        priority: 50,
        pendingCount,
      }, tournamentId);
    }

    if (pendingCount === 0) {
      return action({
        kind: "CLOSE_MATCH",
        label: "Cerrar partida activa",
        description: "Todos los reportes están cargados.",
        reason: "Falta revisar el cierre y confirmar el siguiente avance.",
        ctaLabel: "Ir a Operator",
        href: operatorHref,
        tone: "ready",
        priority: 45,
      }, tournamentId);
    }
  }

  if (context.canCreateNextMatch && matches && matches.length > 0) {
    return action({
      kind: "CREATE_NEXT_MATCH",
      label: "Crear siguiente partida",
      description: "La partida anterior ya quedó completa.",
      reason: "El torneo está listo para continuar su calendario.",
      ctaLabel: "Ir a Operator",
      href: operatorHref,
      tone: "ready",
      priority: 40,
    }, tournamentId);
  }

  if ((matches && matches.length === 0) || tournament.status === "teams_generated") {
    return action({
      kind: "CREATE_FIRST_MATCH",
      label: "Crear primera partida",
      description: "El roster está listo y todavía no hay una partida cargable.",
      reason: "Ya existen equipos para iniciar la operación.",
      ctaLabel: "Ir a Operator",
      href: operatorHref,
      tone: "ready",
      priority: 35,
    }, tournamentId);
  }

  return action({
    kind: "ROSTER_READY",
    label: "Revisar operación",
    description: "El torneo tiene contexto operativo disponible.",
    reason: "Abre Operator para confirmar el siguiente estado antes de avanzar.",
    ctaLabel: "Ir a Operator",
    href: operatorHref,
    tone: "ready",
    priority: 20,
  }, tournamentId);
}
