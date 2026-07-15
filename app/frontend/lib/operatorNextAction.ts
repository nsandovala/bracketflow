export type OperatorNextActionStatus = "ready" | "blocked" | "info";

export type OperatorNextActionId =
  | "select_tournament"
  | "prepare_roster"
  | "generate_roulette"
  | "lock_roster"
  | "open_bracket_respin"
  | "generate_bracket"
  | "operate_series"
  | "create_game"
  | "load_reports"
  | "resolve_tie"
  | "review_completed";

export type OperatorNextAction = {
  id: OperatorNextActionId;
  title: string;
  description: string;
  status: OperatorNextActionStatus;
  ctaLabel?: string;
  targetTab?: "op" | "setup" | "bracket";
  reason: string;
};

type OperatorNextActionInput = {
  hasTournament: boolean;
  isFinalized: boolean;
  primaryView: "standings" | "bracket" | null;
  requiresRoulette: boolean;
  playerCount: number;
  teamCount: number;
  rosterStatus?: "participants_pending" | "respin_open" | "locked";
  bracketStatus?: "pending" | "respin_open" | "locked" | "running" | "completed";
  matchCount: number;
  hasActiveMatch: boolean;
  pendingReportCount: number;
  hasKillRaceTie: boolean;
  nextGameNumber: number;
};

export function getOperatorNextAction(input: OperatorNextActionInput): OperatorNextAction {
  if (!input.hasTournament) {
    return {
      id: "select_tournament",
      title: "Selecciona un torneo",
      description: "Push Mode necesita un torneo activo para leer su estado operativo.",
      status: "blocked",
      reason: "No hay un torneo seleccionado.",
    };
  }

  if (input.isFinalized || input.bracketStatus === "completed") {
    return {
      id: "review_completed",
      title: "Operación completada",
      description: "Los resultados ya decididos pueden revisarse en la vista pública del torneo.",
      status: "info",
      ctaLabel: input.primaryView === "bracket" ? "Ver bracket" : "Ver standings",
      targetTab: input.primaryView === "bracket" ? "bracket" : undefined,
      reason: "El torneo figura como finalizado; Push Mode no habilita nuevas mutaciones.",
    };
  }

  if (input.teamCount === 0) {
    if (input.requiresRoulette && input.playerCount > 0) {
      return {
        id: "generate_roulette",
        title: "Generar equipos de ruleta",
        description: "Usa los participantes reales cargados para preparar los equipos.",
        status: "ready",
        ctaLabel: "Generar ruleta",
        targetTab: "setup",
        reason: `Hay ${input.playerCount} participantes y todavía no existen equipos.`,
      };
    }
    return {
      id: "prepare_roster",
      title: input.requiresRoulette ? "Carga participantes reales" : "Carga equipos y roster",
      description: "Completa el setup antes de iniciar partidas o construir el bracket.",
      status: "blocked",
      ctaLabel: "Ir a setup",
      targetTab: "setup",
      reason: "El torneo todavía no tiene equipos operables.",
    };
  }

  if (input.primaryView === "bracket") {
    if (input.rosterStatus !== "locked") {
      return {
        id: "lock_roster",
        title: "Confirmar equipos",
        description: "Revisa el roster y confírmalo para habilitar la preparación del bracket.",
        status: "ready",
        ctaLabel: "Confirmar equipos",
        targetTab: "setup",
        reason: `Hay ${input.teamCount} equipos, pero el roster aún no está bloqueado.`,
      };
    }
    if (input.bracketStatus === "pending") {
      return {
        id: "open_bracket_respin",
        title: "Preparar ventana de bracket",
        description: "Abre la ventana manual de respin antes de generar la llave.",
        status: "ready",
        ctaLabel: "Abrir respin · 3 min",
        targetTab: "bracket",
        reason: "El roster está confirmado y el bracket sigue pendiente.",
      };
    }
    if (input.bracketStatus === "respin_open") {
      return {
        id: "generate_bracket",
        title: "Generar bracket",
        description: "La ventana está abierta; confirma la generación de la llave con los equipos actuales.",
        status: "ready",
        ctaLabel: "Generar bracket",
        targetTab: "bracket",
        reason: "El respin de bracket está activo.",
      };
    }
    return {
      id: "operate_series",
      title: input.hasActiveMatch ? "Cargar el próximo mapa" : "Revisar estado del bracket",
      description: input.hasActiveMatch
        ? "Abre la serie jugable y registra únicamente los kills confirmados por el operador."
        : "No hay una serie jugable ahora; revisa avances, BYEs y oponentes pendientes.",
      status: input.hasActiveMatch ? "ready" : "info",
      ctaLabel: input.hasActiveMatch ? "Ir a la serie" : "Ver bracket",
      targetTab: input.hasActiveMatch ? "op" : "bracket",
      reason: input.hasActiveMatch
        ? "El bracket tiene una serie con ambos oponentes definidos."
        : `El bracket existe con ${input.matchCount} series, pero ninguna está lista para operar.`,
    };
  }

  if (!input.hasActiveMatch) {
    return {
      id: "create_game",
      title: `Crear partida ${input.nextGameNumber}`,
      description: "Crea una partida vacía para comenzar a recibir reportes reales.",
      status: "ready",
      ctaLabel: `Crear partida ${input.nextGameNumber}`,
      reason: "Hay equipos cargados y todavía no existe una partida activa.",
    };
  }

  if (input.pendingReportCount > 0) {
    return {
      id: "load_reports",
      title: `Completar ${input.pendingReportCount} reporte${input.pendingReportCount === 1 ? "" : "s"}`,
      description: "Carga los resultados faltantes antes de habilitar la siguiente partida.",
      status: "ready",
      ctaLabel: "Ir al primer pendiente",
      targetTab: "op",
      reason: "La partida activa aún no tiene reportes para todos los equipos.",
    };
  }

  if (input.hasKillRaceTie) {
    return {
      id: "resolve_tie",
      title: "Resolver empate manualmente",
      description: "No avances hasta que el desempate tenga un resultado real y verificable.",
      status: "blocked",
      reason: "La partida cerró con empate en kills y no existe una resolución automática segura.",
    };
  }

  return {
    id: "create_game",
    title: `Crear partida ${input.nextGameNumber}`,
    description: "Todos los reportes están guardados; puedes abrir la siguiente partida.",
    status: "ready",
    ctaLabel: `Crear partida ${input.nextGameNumber}`,
    reason: "La partida actual tiene un reporte guardado por cada equipo.",
  };
}
