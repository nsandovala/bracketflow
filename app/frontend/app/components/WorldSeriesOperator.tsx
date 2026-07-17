"use client";

import {
  ChangeEvent,
  FormEvent,
  FormEventHandler,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  Match,
  ParticipantImportResult,
  Player,
  Team,
  TeamResultDetail,
  Tournament,
} from "../../lib/api";
import { estimateWorldSeriesPoints } from "../../lib/tournamentMode";
import { getEffectiveLobbySize, ResolvedTournamentEngine } from "../../lib/tournamentModel";
import { getOperatorNextAction } from "../../lib/operatorNextAction";
import {
  getOcrDraftStorageKey,
  OcrDraftReport,
  OcrDraftSource,
  OcrDraftStatus,
  parseOcrDraftReports,
} from "../../lib/ocrDraftIntake";
import {
  getTeamDisplayName,
  isTournamentCompleted,
  findChampion,
  getMatchPointStatus,
  getMatchPointStatusMessage,
  getTeamRosterText,
} from "../../lib/tournamentStatus";
import { KillRaceMapDraft, ResultDraft, WorldSeriesStanding } from "../lib/useWorldSeriesPractice";
import BracketView from "./BracketView";
import ContextBar from "./ContextBar";
import RouletteArena from "./RouletteArena";

type WorldSeriesOperatorProps = {
  backendOnline: boolean;
  message: string | null;
  tournaments: Tournament[];
  selectedTournamentId: number | null;
  selectedTournament: Tournament | null;
  teams: Team[];
  matches: Match[];
  players: Player[];
  standings: WorldSeriesStanding[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  pendingTeams: Team[];
  reportsLoaded: number;
  totalTeams: number;
  latestReportedRound: number;
  canCreateNextGame: boolean;
  selectedEngine: ResolvedTournamentEngine | null;
  nextGameNumber: number;
  submitting: boolean;
  teamName: string;
  teamRoster: string;
  teamFormError: string | null;
  resultDrafts: Record<string, ResultDraft>;
  killRaceMapDrafts: Record<number, KillRaceMapDraft>;
  onPreviewParticipants?: (rows: string[]) => Promise<ParticipantImportResult | null>;
  onSelectTournament: (tournamentId: number) => void;
  onTeamNameChange: (value: string) => void;
  onTeamRosterChange: (value: string) => void;
  onCreateTeam: FormEventHandler<HTMLFormElement>;
  onImportParticipants: (nicknames: string[]) => Promise<unknown>;
  onRemoveParticipant: (playerId: number) => Promise<unknown>;
  onClearParticipants: () => Promise<unknown>;
  onGenerateRoulette: (shuffleSeed?: string | number) => Promise<unknown>;
  onOpenRosterRespin: (durationMinutes: number) => Promise<unknown>;
  onLockRosterRespin: () => Promise<unknown>;
  onGenerateBracket: () => Promise<unknown>;
  onOpenBracketRespin: (durationMinutes: number) => Promise<unknown>;
  onLockBracketRespin: () => Promise<unknown>;
  onUpdateDraft: (matchId: number, teamId: number, patch: Partial<ResultDraft>) => void;
  onUpdateKillRaceMapDraft: (matchId: number, patch: Partial<KillRaceMapDraft>) => void;
  onSelectKillRaceMatch: (matchId: number | null) => void;
  onSaveTeamReport: (matchId: number, teamId: number) => void;
  onSaveKillRaceMap: (matchId: number) => void;
  onCreateNextGame: () => void;
  onBulkImportTeams?: (teams: Array<{ name: string; roster: string }>) => Promise<unknown>;
};

type OperatorMode = "op" | "setup" | "bracket" | "ocr";
type ResultFilter = "all" | "pending";
type OcrDraftViewStatus = "empty" | "evidence" | "review" | "confirmed" | "disputed";
type OcrDraftPersistenceState = "loading" | "local" | "memory";

const OCR_DRAFT_STATES: Array<{ status: OcrDraftViewStatus; label: string }> = [
  { status: "empty", label: "Sin evidencia" },
  { status: "evidence", label: "Evidencia cargada / pegada" },
  { status: "review", label: "Draft pendiente de revisión" },
  { status: "confirmed", label: "Confirmado manualmente" },
  { status: "disputed", label: "Disputado / requiere revisión" },
];

const OCR_DRAFT_STATUS_LABELS: Record<OcrDraftStatus, string> = Object.fromEntries(
  [
    ["pending", "Draft pendiente de revisión"],
    ["confirmed", "Confirmado manualmente"],
    ["disputed", "Disputado / requiere revisión"],
  ]
) as Record<OcrDraftStatus, string>;

function OcrDraftIntake({
  tournamentId,
  matchNumber,
  activeMatchKey,
  teams,
  usesPlacement,
  effectiveLobbySize,
}: {
  tournamentId: number;
  matchNumber: number;
  activeMatchKey: string | null;
  teams: Team[];
  usesPlacement: boolean;
  effectiveLobbySize: number;
}) {
  const storageKey = getOcrDraftStorageKey(tournamentId, matchNumber);
  const [drafts, setDrafts] = useState<OcrDraftReport[]>([]);
  const [persistenceState, setPersistenceState] =
    useState<OcrDraftPersistenceState>("loading");
  const [teamId, setTeamId] = useState("");
  const [kills, setKills] = useState("");
  const [placement, setPlacement] = useState("");
  const [source, setSource] = useState<OcrDraftSource>("MANUAL");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const raw = window.localStorage.getItem(storageKey);
        setDrafts(raw ? parseOcrDraftReports(raw, tournamentId, matchNumber) : []);
        setPersistenceState("local");
      } catch {
        setDrafts([]);
        setPersistenceState("memory");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [matchNumber, storageKey, tournamentId]);

  const formIsDirty =
    teamId !== "" ||
    kills !== "" ||
    placement !== "" ||
    source !== "MANUAL" ||
    note.trim() !== "";
  const hasTextEvidence = note.trim() !== "";
  const intakeStatus: OcrDraftViewStatus = drafts.some(
    (draft) => draft.status === "disputed"
  )
    ? "disputed"
    : drafts.some((draft) => draft.status === "pending")
      ? "review"
      : hasTextEvidence
        ? "evidence"
        : drafts.length > 0 && drafts.every((draft) => draft.status === "confirmed")
          ? "confirmed"
          : "empty";

  function persistDrafts(nextDrafts: OcrDraftReport[]) {
    setDrafts(nextDrafts);
    if (persistenceState !== "local") {
      return;
    }

    try {
      if (nextDrafts.length === 0) {
        window.localStorage.removeItem(storageKey);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
      }
    } catch {
      setPersistenceState("memory");
    }
  }

  function clearForm() {
    setTeamId("");
    setKills("");
    setPlacement("");
    setSource("MANUAL");
    setNote("");
    setFormError(null);
  }

  function handleCreateDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedKills = Number(kills);
    const parsedPlacement = Number(placement);
    const selectedTeam = teams.find((team) => team.id === Number(teamId));
    if (!selectedTeam) {
      setFormError("Selecciona un equipo real del torneo.");
      return;
    }
    if (kills === "" || !Number.isInteger(parsedKills) || parsedKills < 0) {
      setFormError("Kills debe ser un número entero igual o mayor que 0.");
      return;
    }
    if (
      usesPlacement &&
      (placement === "" ||
        !Number.isInteger(parsedPlacement) ||
        parsedPlacement < 1 ||
        parsedPlacement > effectiveLobbySize)
    ) {
      setFormError(`Placement debe estar entre 1 y ${effectiveLobbySize}.`);
      return;
    }

    const timestamp = new Date().toISOString();
    const draft: OcrDraftReport = {
      id: window.crypto.randomUUID(),
      tournamentId,
      matchNumber,
      activeMatchKey,
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
      kills: parsedKills,
      placement: usesPlacement ? parsedPlacement : "",
      source,
      status: "pending",
      note: note.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    persistDrafts([draft, ...drafts]);
    clearForm();
  }

  function updateDraftStatus(id: string, status: OcrDraftStatus) {
    const updatedAt = new Date().toISOString();
    persistDrafts(
      drafts.map((draft) => (draft.id === id ? { ...draft, status, updatedAt } : draft))
    );
  }

  function discardDraft(id: string) {
    persistDrafts(drafts.filter((draft) => draft.id !== id));
  }

  return (
    <section className="opr-panel opr-ocr-intake" aria-labelledby="opr-ocr-title">
      <div className="opr-ocr-head">
        <div>
          <div className="opr-eyebrow">Captura asistida · V0</div>
          <h2 id="opr-ocr-title">OCR Draft Intake</h2>
          <p className="sub">
            Próxima capa: leer captura, crear borrador y confirmar manualmente.
          </p>
        </div>
        <span className="opr-ocr-safety">
          {persistenceState === "memory"
            ? "Local · solo memoria"
            : "Local · este navegador"}
        </span>
      </div>

      <div className="opr-ocr-rule">
        <strong>Separado de resultados reales.</strong>
        <span>
          Esta vista no procesa imágenes ni ejecuta OCR. Confirmar aquí solo cambia el estado
          local del draft; no suma reportes, no modifica standings y no activa campeón. Los
          borradores se guardan en este navegador para el torneo y la partida actuales.
        </span>
      </div>

      {persistenceState === "memory" ? (
        <p className="bf-inline-note" role="status">
          El almacenamiento local no está disponible. Los drafts seguirán funcionando en
          memoria, pero se perderán al recargar.
        </p>
      ) : null}

      <ol className="opr-ocr-states" aria-label="Estados de OCR Draft Intake">
        {OCR_DRAFT_STATES.map((item) => (
          <li
            key={item.status}
            className={`is-${item.status}${intakeStatus === item.status ? " is-current" : ""}`}
            aria-current={intakeStatus === item.status ? "step" : undefined}
          >
            <i aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ol>

      <form className="opr-ocr-form" onSubmit={handleCreateDraft}>
        <div className="opr-field">
          <label htmlFor="opr-ocr-team">Equipo</label>
          <select
            id="opr-ocr-team"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={persistenceState === "loading"}
          >
            <option value="">Seleccionar equipo</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>
        <div className="opr-field">
          <label htmlFor="opr-ocr-kills">Kills</label>
          <input
            id="opr-ocr-kills"
            type="number"
            inputMode="numeric"
            min="0"
            value={kills}
            placeholder="0"
            onChange={(event) => setKills(event.target.value)}
          />
        </div>
        {usesPlacement ? (
          <div className="opr-field">
            <label htmlFor="opr-ocr-placement">Placement</label>
            <input
              id="opr-ocr-placement"
              type="number"
              inputMode="numeric"
              min="1"
              max={effectiveLobbySize}
              value={placement}
              placeholder={`1-${effectiveLobbySize}`}
              onChange={(event) => setPlacement(event.target.value)}
            />
          </div>
        ) : null}
        <div className="opr-field">
          <label htmlFor="opr-ocr-source">Fuente</label>
          <select
            id="opr-ocr-source"
            value={source}
            onChange={(event) => setSource(event.target.value as OcrDraftSource)}
          >
            <option value="MANUAL">MANUAL</option>
            <option value="PRINT">PRINT</option>
            <option value="OCR_DRAFT">OCR_DRAFT</option>
          </select>
        </div>
        <div className="opr-field opr-ocr-note">
          <label htmlFor="opr-ocr-note">Nota o evidencia textual · opcional</label>
          <textarea
            id="opr-ocr-note"
            value={note}
            rows={2}
            placeholder="Pega una referencia visible o deja una nota para revisión."
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div className="opr-ocr-form-actions">
          <button
            type="submit"
            className="opr-save"
            disabled={persistenceState === "loading"}
          >
            Crear draft para revisión
          </button>
          {formIsDirty ? (
            <button type="button" className="bf-button bf-button-ghost" onClick={clearForm}>
              Limpiar entrada
            </button>
          ) : null}
        </div>
      </form>

      {formError ? (
        <p className="bf-inline-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="opr-ocr-queue">
        <div className="opr-ocr-queue-head">
          <div>
            <span>Borradores locales</span>
            <strong>{drafts.length}</strong>
          </div>
          <small>Guardados localmente. No cuentan como reportes cargados.</small>
        </div>

        {drafts.length === 0 ? (
          <p className="opr-ocr-empty">
            Sin borradores. La operación real continúa en Push Mode.
          </p>
        ) : (
          <div className="opr-ocr-drafts">
            {drafts.map((draft) => (
              <article key={draft.id} className={`opr-ocr-draft is-${draft.status}`}>
                <div className="opr-ocr-draft-main">
                  <div>
                    <strong>{draft.teamName}</strong>
                    <span>
                      {draft.kills} kills
                      {usesPlacement ? ` · #${draft.placement}` : ""} · {draft.source}
                    </span>
                  </div>
                  <span className={`opr-ocr-status is-${draft.status}`}>
                    <i aria-hidden="true" />
                    {OCR_DRAFT_STATUS_LABELS[draft.status]}
                  </span>
                </div>
                {draft.note ? <p>{draft.note}</p> : null}
                <div className="opr-ocr-draft-actions">
                  {draft.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="opr-save"
                        onClick={() => updateDraftStatus(draft.id, "confirmed")}
                      >
                        Confirmar draft local
                      </button>
                      <button
                        type="button"
                        className="bf-button bf-button-ghost"
                        onClick={() => updateDraftStatus(draft.id, "disputed")}
                      >
                        Marcar disputado
                      </button>
                    </>
                  ) : draft.status === "disputed" ? (
                    <button
                      type="button"
                      className="bf-button bf-button-ghost"
                      onClick={() => updateDraftStatus(draft.id, "pending")}
                    >
                      Volver a revisión
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bf-button bf-button-ghost"
                      onClick={() => updateDraftStatus(draft.id, "disputed")}
                    >
                      Disputar
                    </button>
                  )}
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    onClick={() => discardDraft(draft.id)}
                  >
                    Descartar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

function rosterText(team: Team) {
  return team.members.length > 0
    ? team.members.map((member) => member.player.nickname).join(" / ")
    : "Roster pendiente";
}

function jumpToTeam(teamId: number) {
  const el = document.getElementById(`opr-card-${teamId}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.querySelector<HTMLInputElement>("input")?.focus();
}

function formatCountdown(deadline: string | null, now: number) {
  if (!deadline) {
    return null;
  }
  const diffMs = new Date(deadline).getTime() - now;
  if (diffMs <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function WorldSeriesOperator({
  backendOnline,
  message,
  tournaments,
  selectedTournamentId,
  selectedTournament,
  teams,
  matches,
  players,
  standings,
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
  teamName,
  teamRoster,
  teamFormError,
  resultDrafts,
  killRaceMapDrafts,
  onPreviewParticipants,
  onSelectTournament,
  onTeamNameChange,
  onTeamRosterChange,
  onCreateTeam,
  onImportParticipants,
  onRemoveParticipant,
  onClearParticipants,
  onGenerateRoulette,
  onOpenRosterRespin,
  onLockRosterRespin,
  onGenerateBracket,
  onOpenBracketRespin,
  onLockBracketRespin,
  onUpdateDraft,
  onUpdateKillRaceMapDraft,
  onSelectKillRaceMatch,
  onSaveTeamReport,
  onSaveKillRaceMap,
  onCreateNextGame,
  onBulkImportTeams,
}: WorldSeriesOperatorProps) {
  const searchParams = useSearchParams();
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [mode, setMode] = useState<OperatorMode>(
    searchParams.get("roulette") === "1"
      ? "setup"
      : searchParams.get("tab") === "ocr"
        ? "ocr"
      : searchParams.get("tab") === "bracket"
        ? "bracket"
        : "op"
  );

  const rouletteParam = searchParams.get("roulette");
  const tabParam = searchParams.get("tab");

  // "Ver bracket" navega con ?tab=bracket, pero el operator puede estar ya montado.
  // Sin este sync, mode se calculaba solo en el mount y el link parecia no hacer nada.
  // Patron oficial de React: reconciliar en render cuando cambia el parametro de nav,
  // en vez de setState dentro de un effect.
  const navKey = `${rouletteParam ?? ""}|${tabParam ?? ""}`;
  const [syncedNavKey, setSyncedNavKey] = useState(navKey);
  if (navKey !== syncedNavKey) {
    setSyncedNavKey(navKey);
    if (rouletteParam === "1") {
      setMode("setup");
    } else if (tabParam === "ocr") {
      setMode("ocr");
    } else if (tabParam === "bracket") {
      setMode("bracket");
    }
  }
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [teamImportMessage, setTeamImportMessage] = useState<string | null>(null);
  const teamFileInputRef = useRef<HTMLInputElement>(null);

  const currentGame = activeMatch ? activeMatch.round : nextGameNumber;
  const pendingCount = pendingTeams.length;
  const progressPct = totalTeams > 0 ? (reportsLoaded / totalTeams) * 100 : 0;
  const visibleTeams = filter === "pending" ? pendingTeams : teams;
  const usesPlacement = selectedEngine?.usesPlacement ?? true;
  const isKillRace = selectedEngine?.scoringProfile === "kill_race";
  const requiresRoulette = selectedEngine?.rosterPolicy === "roulette";
  const canRegenerateRoulette = latestReportedRound === 0;
  const effectiveLobbySize = selectedEngine
    ? getEffectiveLobbySize(selectedEngine, totalTeams)
    : totalTeams;
  const matchPointStatus =
    selectedTournament && selectedEngine && !isKillRace
      ? getMatchPointStatus({
          tournament: selectedTournament,
          threshold: selectedEngine.matchPointThreshold,
          standings,
          teams,
          matches,
        })
      : { state: "idle" as const };
  const matchPointMessage = isKillRace ? null : getMatchPointStatusMessage(matchPointStatus);
  const matchPointRoster =
    matchPointStatus.state === "champion"
      ? getTeamRosterText(matchPointStatus.champion) || "Roster pendiente"
      : null;
  // Torneo finalizado: no se opera despues de campeon / Match Point resuelto.
  // No inventamos campeon en frontend; solo reflejamos estado ya decidido por backend.
  const isFinalized =
    selectedTournament?.status === "completed" ||
    (typeof selectedTournament?.config?.championTeamId === "number" &&
      selectedTournament.config.championTeamId > 0) ||
    matchPointStatus.state === "champion";
  const pushModeAction = getOperatorNextAction({
    tournament: selectedTournament,
    engine: selectedEngine,
    backendOnline,
    teamsCount: totalTeams,
    participantsCount: players.length,
    matches,
    activeMatch,
    reportsLoaded,
    totalTeams,
    matchPointStatus,
    canCreateNextMatch: canCreateNextGame,
  });
  const importFormatExample = useMemo(() => {
    const expectedTeamSize = Math.max(selectedEngine?.teamSize ?? 3, 1);
    const playersHint = Array.from(
      { length: expectedTeamSize },
      (_, index) => `player${index + 1}`
    ).join(", ");
    return `Team Name, ${playersHint}`;
  }, [selectedEngine?.teamSize]);

  const gameStats = useMemo(() => {
    if (activeMatchResults.length === 0) {
      return null;
    }
    const leader = activeMatchResults.reduce((best, result) =>
      result.total_points > best.total_points ? result : best
    );
    const totalKills = activeMatchResults.reduce((sum, result) => sum + result.kills, 0);
    const bestPlacement = activeMatchResults.reduce(
      (min, result) => (result.placement < min ? result.placement : min),
      activeMatchResults[0].placement
    );
    const bestPlacementResult = activeMatchResults.find(
      (result) => result.placement === bestPlacement
    );
    return { leader, totalKills, bestPlacement, bestPlacementResult };
  }, [activeMatchResults]);

  const leaderTeam = gameStats
    ? teams.find((team) => team.id === gameStats.leader.team_id)
    : undefined;
  const activeMatchTeamA = activeMatch?.team_a_id
    ? teams.find((team) => team.id === activeMatch.team_a_id) ?? null
    : null;
  const activeMatchTeamB = activeMatch?.team_b_id
    ? teams.find((team) => team.id === activeMatch.team_b_id) ?? null
    : null;
  const activeMatchTeamALabel = activeMatchTeamA ? getTeamDisplayName(activeMatchTeamA) : "";
  const activeMatchTeamBLabel = activeMatchTeamB ? getTeamDisplayName(activeMatchTeamB) : "";
  const bracketCountdown = formatCountdown(
    selectedTournament?.bracket_respin_deadline_at ?? null,
    now
  );
  const bracketOpen =
    selectedTournament?.bracket_status === "respin_open" && bracketCountdown !== "00:00";
  const killRaceDraft = activeMatch
    ? killRaceMapDrafts[activeMatch.id] ?? {
        mapNumber: String(Math.min(activeMatch.maps.length + 1, activeMatch.best_of)),
        killsA: "",
        killsB: "",
      }
    : null;
  const activeKillRaceSeriesClosed = activeMatch
    ? activeMatch.winner_id !== null ||
      activeMatch.status === "completed" ||
      activeMatch.maps_won_a >= Math.ceil(activeMatch.best_of / 2) ||
      activeMatch.maps_won_b >= Math.ceil(activeMatch.best_of / 2)
    : false;
  const killRaceChampion = isKillRace ? findChampion(matches, teams) : null;
  const nextReadyKillRaceMatch = activeMatch
    ? matches
        .filter(
          (match) =>
            match.id !== activeMatch.id &&
            match.team_a_id !== null &&
            match.team_b_id !== null &&
            match.winner_id === null &&
            match.status !== "completed"
        )
        .sort((left, right) => left.round - right.round || left.id - right.id)[0] ?? null
    : null;
  const bracketViewActions =
    !selectedTournament || mode !== "bracket"
      ? null
      : matches.length > 0
        ? (
            <Link
              href={`/standings?tournamentId=${selectedTournament.id}`}
              className="bf-button bf-button-ghost"
            >
              Ver bracket
            </Link>
          )
        : selectedTournament.roster_status !== "locked"
          ? (
              <div className="bf-bracket-cta-stack">
                <span className="bf-bracket-cta-note">
                  Cierra el respin y bloquea equipos para habilitar la llave final.
                </span>
                <button
                  type="button"
                  className="opr-save"
                  disabled={submitting}
                  onClick={() => void onLockRosterRespin()}
                >
                  Cerrar respin y bloquear equipos
                </button>
              </div>
            )
        : bracketOpen
          ? (
              <div className="bf-bracket-cta-stack">
                <div className="bf-bracket-cta-chip">Respin activo · {bracketCountdown}</div>
                <span className="bf-bracket-cta-note">
                  Respin de bracket activo. Genera la llave antes de que termine la ventana.
                </span>
                <div className="bf-hub-form-actions">
                  <button
                    type="button"
                    className="opr-save"
                    disabled={submitting}
                    onClick={() => void onGenerateBracket()}
                  >
                    Generar bracket
                  </button>
                  <button
                    type="button"
                    className="bf-button bf-button-ghost"
                    disabled={submitting}
                    onClick={() => void onLockBracketRespin()}
                  >
                    Bloquear bracket ahora
                  </button>
                </div>
              </div>
            )
          : selectedTournament.bracket_status === "pending"
            ? (
                <div className="bf-bracket-cta-stack">
                  <span className="bf-bracket-cta-note">
                    Abre una ventana de respin de bracket para generar la llave.
                  </span>
                  <div className="bf-hub-form-actions">
                    <button
                      type="button"
                      className="opr-save"
                      disabled={submitting}
                      onClick={() => void onOpenBracketRespin(3)}
                    >
                      Abrir respin de bracket
                    </button>
                    {[4, 5].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className="bf-button bf-button-ghost"
                        disabled={submitting}
                        onClick={() => void onOpenBracketRespin(minutes)}
                      >
                        Abrir respin de bracket ({minutes} min)
                      </button>
                    ))}
                  </div>
                </div>
              )
            : (
                <Link
                  href={`/standings?tournamentId=${selectedTournament.id}`}
                  className="bf-button bf-button-ghost"
                >
                  Ver bracket
                </Link>
              );

  async function handleTeamImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !onBulkImportTeams) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const parsed: Array<{ name: string; roster: string }> = [];

    for (const line of lines) {
      const parts = line.split(/,\s*|,/);
      if (parts.length < 2) continue;
      const name = parts[0].trim();
      const roster = parts
        .slice(1)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
      if (name && roster) {
        parsed.push({ name, roster });
      }
    }

    if (parsed.length === 0) {
      setTeamImportMessage(`No se detectaron equipos validos. Formato esperado: ${importFormatExample}.`);
      return;
    }

    await onBulkImportTeams(parsed);
    setTeamImportMessage(`${parsed.length} equipo(s) importado(s).`);
    if (teamFileInputRef.current) {
      teamFileInputRef.current.value = "";
    }
  }

  return (
    <main className="bf-page bf-page-operator">
      <div className="opr-amb" aria-hidden="true" />

      {!isKillRace && matchPointStatus.state !== "idle" ? (
        <section className={`bf-status-banner ${matchPointStatus.state === "champion" ? "is-success" : "is-warning"}`}>
          <span className="bf-status-banner-kicker">
            {matchPointStatus.state === "champion" ? "Campeon por Match Point" : "Estado Match Point"}
          </span>
          <strong className="bf-status-banner-title">
            {matchPointStatus.state === "champion"
              ? matchPointStatus.championLabel
              : "Match Point alcanzado"}
          </strong>
          <span className="bf-status-banner-sub">
            {matchPointStatus.state === "champion"
              ? `${matchPointRoster}${selectedTournament?.status === "completed" ? " - Torneo finalizado." : ""}`
              : matchPointMessage}
          </span>
        </section>
      ) : null}

      {message ? <p className="bf-message">{message}</p> : null}

      {!selectedTournament ? (
        <p className="bf-empty">No hay torneo seleccionado.</p>
      ) : totalTeams === 0 && requiresRoulette && selectedEngine ? (
        <>
          {/* No duplicar el H1 en titulos internos. */}
          <div className="opr-controls bf-roulette-tabs">
            <div className="opr-seg">
              <button type="button" className="is-on">
                Setup de ruleta
              </button>
              <button type="button" disabled>
                Operación
              </button>
            </div>
          </div>
          <RouletteArena
            tournament={selectedTournament}
            engine={selectedEngine}
            players={players}
            teams={teams}
            submitting={submitting}
            onPreviewParticipants={onPreviewParticipants}
            onImportParticipants={onImportParticipants}
            onRemoveParticipant={onRemoveParticipant}
            onClearParticipants={onClearParticipants}
            onConfirmRoulette={onGenerateRoulette}
            onOpenRosterRespin={onOpenRosterRespin}
            onLockRosterRespin={async () => {
              const result = await onLockRosterRespin();
              if (result) {
                setMode("bracket");
              }
              return result;
            }}
            onGenerateBracket={onGenerateBracket}
            canRegenerate={canRegenerateRoulette}
          />
        </>
      ) : totalTeams === 0 ? (
        <section className="opr-panel">
          <div className="opr-eyebrow">Setup requerido</div>
          <h2>Agrega equipos antes de operar la partida.</h2>
          <p className="sub">
            Primero deja listo el roster del torneo. Puedes importar TXT/CSV desde aqui o cargar un equipo manualmente.
          </p>
          <input
            ref={teamFileInputRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            className="bf-roulette-file-input"
            onChange={(event) => void handleTeamImportChange(event)}
            disabled={submitting}
          />
          <div className="bf-hub-form-actions">
            <button
              type="button"
              className="bf-button bf-button-primary"
              onClick={() => setMode("setup")}
            >
              Agregar equipo
            </button>
            <button
              type="button"
              className="bf-button bf-button-ghost"
              onClick={() => teamFileInputRef.current?.click()}
              disabled={submitting || !onBulkImportTeams}
            >
              Importar TXT/CSV
            </button>
            <Link href="/torneos" className="bf-button bf-button-ghost">
              Volver a Torneos
            </Link>
          </div>
          <p className="bf-inline-note">Formato esperado: {importFormatExample}</p>
          {teamImportMessage ? <p className="bf-inline-note">{teamImportMessage}</p> : null}

          {mode === "setup" && !requiresRoulette ? (
            <form className="opr-form" onSubmit={onCreateTeam}>
              <div className="opr-field">
                <label>Nombre del equipo</label>
                <input
                  value={teamName}
                  onChange={(event) => onTeamNameChange(event.target.value)}
                  placeholder="Team Alpha"
                  required
                />
              </div>
              <div className="opr-field">
                <label>Roster</label>
                <input
                  value={teamRoster}
                  onChange={(event) => onTeamRosterChange(event.target.value)}
                  placeholder="player1, player2, player3"
                  required
                />
              </div>
              <button type="submit" className="opr-save" disabled={submitting}>
                Agregar equipo
              </button>
            </form>
          ) : null}

          {!requiresRoulette && teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}
        </section>
      ) : isKillRace ? (
        <>
          <ContextBar
            engineKey={selectedEngine?.engineKey}
            tournamentName={selectedTournament?.name}
            tournamentId={selectedTournament?.id}
            matches={matches}
            teams={teams}
            tournamentStatus={selectedTournament?.status}
          />

        <section className="opr-panel">
          <div className="opr-eyebrow">Kill Race · {selectedEngine?.teamSize ?? 2}v{selectedEngine?.teamSize ?? 2}</div>
          <h2>Bracket</h2>
          <p className="sub">
            {totalTeams > 0
              ? `${totalTeams} equipos de ${selectedEngine?.teamSize ?? 2} jugadores. Serie BO3: gana quien tenga más kills por mapa. Primero a 2 mapas avanza.`
              : "Falta generar equipos. Ve a Setup de ruleta para cargar participantes."}
          </p>

          <div className="opr-stats">
            <div className="opr-stat">
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Regla de avance</div>
                <div className="opr-stat-value">Más kills</div>
                <div className="opr-stat-sub">Sin placement</div>
              </div>
            </div>
            <div className="opr-stat">
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16"/><path d="M4 12h10"/><path d="M4 19h7"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Formato</div>
                <div className="opr-stat-value">Llave lista</div>
                <div className="opr-stat-sub">
                  {selectedEngine?.tournamentStructure === "double_elim"
                    ? "Double elim"
                    : "Single elim"}
                </div>
              </div>
            </div>
          </div>

          <div className="opr-controls">
            <div className="opr-seg">
              <button
                type="button"
                className={mode === "bracket" || mode === "op" ? "is-on" : ""}
                onClick={() => setMode("bracket")}
              >
                Bracket
              </button>
              <button
                type="button"
                className={mode === "setup" ? "is-on" : ""}
                onClick={() => setMode("setup")}
              >
                Setup
              </button>
            </div>
          </div>

          {mode === "bracket" || mode === "op" ? (
            <BracketView
              tournament={selectedTournament}
              engine={selectedEngine}
              teams={teams}
              matches={matches}
              mode="operator"
              actions={bracketViewActions}
            />
          ) : null}

          {mode !== "setup" ? (
            activeMatch && activeMatchTeamA && activeMatchTeamB ? (
              <section className="opr-panel">
                <div className="opr-eyebrow">Serie actual</div>
                <h2>{activeMatchTeamALabel} vs {activeMatchTeamBLabel}</h2>
                <p className="sub">
                  Match {activeMatch.id} · Round {activeMatch.round} · BO{activeMatch.best_of} · Serie {activeMatch.maps_won_a}-{activeMatch.maps_won_b}
                </p>

                <div className="opr-teamgrid">
                  <div className="opr-teamcard">
                    <div className="h">
                      <span className="n">{activeMatchTeamALabel}</span>
                      <span className="opr-tag t-saved">
                        <i />
                        {activeMatch.maps_won_a} mapas
                      </span>
                    </div>
                    <span className="r">{rosterText(activeMatchTeamA)}</span>
                  </div>
                  <div className="opr-teamcard">
                    <div className="h">
                      <span className="n">{activeMatchTeamBLabel}</span>
                      <span className="opr-tag t-saved">
                        <i />
                        {activeMatch.maps_won_b} mapas
                      </span>
                    </div>
                    <span className="r">{rosterText(activeMatchTeamB)}</span>
                  </div>
                </div>

                {activeKillRaceSeriesClosed ? (
                  <div className="opr-teamgrid">
                    <div className="opr-teamcard">
                      <div className="h">
                        <span className="n">Serie cerrada</span>
                        <span className="opr-tag t-saved">
                          <i />
                          {activeMatch.maps_won_a}-{activeMatch.maps_won_b}
                        </span>
                      </div>
                      <span className="r">El ganador ya avanzó al siguiente match.</span>
                    </div>
                  </div>
                ) : (
                  <div className="opr-inputs">
                    <div className="opr-field">
                      <label>Mapa</label>
                      <input
                        type="number"
                        min="1"
                        max={activeMatch.best_of}
                        value={killRaceDraft?.mapNumber ?? ""}
                        onChange={(event) =>
                          onUpdateKillRaceMapDraft(activeMatch.id, { mapNumber: event.target.value })
                        }
                      />
                    </div>
                    <div className="opr-field">
                      <label>Kills · {activeMatchTeamALabel}</label>
                      <input
                        type="number"
                        min="0"
                        value={killRaceDraft?.killsA ?? ""}
                        onChange={(event) =>
                          onUpdateKillRaceMapDraft(activeMatch.id, { killsA: event.target.value })
                        }
                      />
                    </div>
                    <div className="opr-field">
                      <label>Kills · {activeMatchTeamBLabel}</label>
                      <input
                        type="number"
                        min="0"
                        value={killRaceDraft?.killsB ?? ""}
                        onChange={(event) =>
                          onUpdateKillRaceMapDraft(activeMatch.id, { killsB: event.target.value })
                        }
                      />
                    </div>
                    <div className="opr-total">
                      <label>Estado</label>
                      <b className="has-val">{activeMatch.maps_won_a}-{activeMatch.maps_won_b}</b>
                    </div>
                  </div>
                )}

                {activeMatch.maps.length > 0 ? (
                  <div className="opr-teamgrid">
                    {activeMatch.maps
                      .slice()
                      .sort((left, right) => left.map_number - right.map_number)
                      .map((map) => (
                        <div key={map.id} className="opr-teamcard">
                          <div className="h">
                            <span className="n">Mapa {map.map_number}</span>
                            <span className="opr-tag t-saved">
                              <i />
                              {map.kills_a}-{map.kills_b}
                            </span>
                          </div>
                          <span className="r">
                            {map.map_winner_id === activeMatch.team_a_id
                              ? `Gana ${activeMatchTeamALabel}`
                              : `Gana ${activeMatchTeamBLabel}`}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}

                {activeKillRaceSeriesClosed ? (
                  <div className="bf-hub-form-actions">
                    <button
                      type="button"
                      className="bf-button bf-button-ghost"
                      onClick={() => setMode("bracket")}
                    >
                      Ver bracket actualizado
                    </button>
                    {nextReadyKillRaceMatch ? (
                      <button
                        type="button"
                        className="opr-save"
                        disabled={submitting}
                        onClick={() => {
                          onSelectKillRaceMatch(nextReadyKillRaceMatch.id);
                          setMode("op");
                        }}
                      >
                        Continuar con siguiente serie
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="bf-hub-form-actions">
                    <button
                      type="button"
                      className="opr-save"
                      disabled={submitting}
                      onClick={() => onSaveKillRaceMap(activeMatch.id)}
                    >
                      Guardar mapa
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <section className="opr-panel">
                {isTournamentCompleted(matches) ? (
                  <>
                    <div className="opr-eyebrow">Torneo finalizado</div>
                    <h2>Campeón: {killRaceChampion?.displayName ?? "—"}</h2>
                    <p className="sub">
                      No quedan series pendientes. El bracket está completo.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="opr-eyebrow">Serie actual</div>
                    <h2>
                      {matches.length === 0
                        ? bracketOpen
                          ? "Respin de bracket activo"
                          : "Falta generar bracket"
                        : "No hay serie jugable"}
                    </h2>
                    <p className="sub">
                      {matches.length === 0
                        ? bracketOpen
                          ? `Ventana abierta. Puedes generar la llave ahora (${bracketCountdown}).`
                          : "Genera la llave para habilitar el BO3."
                        : "No hay serie jugable. Revisa propagación de BYE en bracket."}
                    </p>
                  </>
                )}
                {matches.length === 0 && !isTournamentCompleted(matches) ? (
                  <div className="bf-hub-form-actions">
                    <span className="bf-empty">
                      {bracketOpen
                        ? `Respin de bracket activo. Genera la llave antes de ${bracketCountdown}.`
                        : "Abre respin de bracket para generar la llave."}
                    </span>
                  </div>
                ) : null}
              </section>
            )
          ) : null}

          {mode === "setup" ? (
            selectedEngine ? (
              <RouletteArena
                tournament={selectedTournament}
                engine={selectedEngine}
                players={players}
                teams={teams}
                submitting={submitting}
                onPreviewParticipants={onPreviewParticipants}
                onImportParticipants={onImportParticipants}
                onRemoveParticipant={onRemoveParticipant}
                onClearParticipants={onClearParticipants}
                onConfirmRoulette={onGenerateRoulette}
                onOpenRosterRespin={onOpenRosterRespin}
                onLockRosterRespin={async () => {
                  const result = await onLockRosterRespin();
                  if (result) {
                    setMode("bracket");
                  }
                  return result;
                }}
                onGenerateBracket={async () => {
                  const result = await onGenerateBracket();
                  if (result) {
                    setMode("bracket");
                  }
                  return result;
                }}
                canRegenerate={canRegenerateRoulette}
              />
            ) : null
          ) : null}
        </section>
        </>
      ) : (
        <>
          <ContextBar
            engineKey={selectedEngine?.engineKey}
            tournamentName={selectedTournament?.name}
            tournamentId={selectedTournament?.id}
            matches={matches}
            teams={teams}
            tournamentStatus={selectedTournament?.status}
          />

          {/* ---- Command bar ---- */}
          {requiresRoulette ? (
            <section className="opr-panel opr-setup-ready">
              <div className="opr-eyebrow">Equipos generados por ruleta</div>
              <h2>Listo para operar</h2>
              <p className="sub">
                La ruleta confirmó {totalTeams} equipos. Ya puedes crear partida y cargar resultados.
              </p>
            </section>
          ) : null}

          <section className={`opr-command${isFinalized ? " is-finalized" : ""}`}>
            <div className="opr-game">
              <div>
                <div className="eye">Operando</div>
                <strong>Partida {currentGame}</strong>
              </div>
              <span className="t">{totalTeams} equipos</span>
              <span className="t">{selectedEngine?.label ?? "World Series BR"}</span>
              <span className="t">
                {selectedEngine?.scoringProfile === "kill_race"
                  ? "Kill race"
                  : `Lobby ${effectiveLobbySize}`}
              </span>
              {usesPlacement && selectedEngine?.requiresUniquePlacement ? (
                <span className="t">Placement unico</span>
              ) : null}
              {selectedEngine?.rosterPolicy === "roulette" ? (
                <span className="t">Roster policy: roulette</span>
              ) : null}
              {selectedEngine?.engineKey === "roulette_ws" ? (
                <span className="t">Scoring profile: wsow_like</span>
              ) : null}
            </div>

            <div className="opr-progress">
              <div className="opr-progress-top">
                <span>Reportes de la partida</span>
                <b>
                  <em>{reportsLoaded}</em>/{totalTeams} cargados ·{" "}
                  <span className="opr-pending-n">{pendingCount}</span> pendientes
                </b>
              </div>
              <div className="opr-bar">
                <i style={{ width: `${progressPct}%` }} aria-hidden="true" />
              </div>
            </div>

            {isFinalized ? (
              <div className="opr-finalized-cta">
                <span className="bf-inline-note">
                  Torneo finalizado. No se crean nuevas partidas.
                </span>
                <div className="bf-hub-form-actions">
                  <Link
                    href={`/standings?tournamentId=${selectedTournament.id}`}
                    className="bf-button bf-button-ghost"
                  >
                    Ver Standings
                  </Link>
                  <Link
                    href={`/stream?tournamentId=${selectedTournament.id}`}
                    className="bf-button bf-button-ghost"
                  >
                    Ver Stream
                  </Link>
                  <Link href="/dashboard" className="bf-button bf-button-ghost">
                    Dashboard
                  </Link>
                  <Link href="/torneos" className="bf-button bf-button-ghost">
                    Volver a Torneos
                  </Link>
                </div>
              </div>
            ) : (
              <div className="opr-command-actions">
                <nav className="opr-command-links" aria-label="Vistas del torneo">
                  <Link href={`/standings?tournamentId=${selectedTournament.id}`}>Standings</Link>
                  <Link href={`/stream?tournamentId=${selectedTournament.id}`}>Stream</Link>
                  <Link href="/dashboard">Dashboard</Link>
                </nav>
                <button
                  type="button"
                  className={`opr-next${canCreateNextGame ? " is-ready" : ""}`}
                  disabled={!canCreateNextGame || submitting}
                  onClick={onCreateNextGame}
                >
                  Crear Partida {nextGameNumber} <span className="arrow">→</span>
                </button>
              </div>
            )}
          </section>

          <div className="opr-stats">
            <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Líder de la partida</div>
                <div className="opr-stat-value">
                  {gameStats ? (
                    <>
                      {gameStats.leader.team_name} · <em>{gameStats.leader.total_points.toFixed(1)}</em> pts
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                {gameStats && leaderTeam ? (
                  <div className="opr-stat-sub">{rosterText(leaderTeam)}</div>
                ) : null}
              </div>
            </div>

            <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
              <span className="opr-stat-ico" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 13c0-1 1-2 2-2s2 1 2 2-1 5 5 5 5-4 5-5 1-2 2-2 2 1 2 2c0 3.5-3 6-9 6s-9-2.5-9-6Z"/><path d="M12 2v4"/><path d="m4.93 6.93 1.41 1.41"/><path d="m17.66 8.34 1.41-1.41"/></svg>
              </span>
              <div className="opr-stat-body">
                <div className="opr-stat-label">Kills totales de la partida</div>
                <div className="opr-stat-value">{gameStats ? gameStats.totalKills : "—"}</div>
                {gameStats ? (
                  <div className="opr-stat-sub">sumados de {activeMatchResults.length} reportes</div>
                ) : null}
              </div>
            </div>

            {usesPlacement ? (
              <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
                <span className="opr-stat-ico" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>
                </span>
                <div className="opr-stat-body">
                  <div className="opr-stat-label">Mejor placement reportado</div>
                  <div className="opr-stat-value">
                    {gameStats ? <em>#{gameStats.bestPlacement}</em> : "—"}
                  </div>
                  {gameStats && gameStats.bestPlacementResult ? (
                    <div className="opr-stat-sub">por {gameStats.bestPlacementResult.team_name}</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className={`opr-stat${gameStats ? "" : " is-empty"}`}>
                <span className="opr-stat-ico" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>
                </span>
                <div className="opr-stat-body">
                  <div className="opr-stat-label">Regla de avance</div>
                  <div className="opr-stat-value">Más kills</div>
                  <div className="opr-stat-sub">Empates requieren desempate manual</div>
                </div>
              </div>
            )}
          </div>

          {/* ---- Toggle modo + filtro ---- */}
          <div className="opr-controls">
            <div className="opr-seg">
              <button
                type="button"
                className={mode === "op" ? "is-on" : ""}
                onClick={() => setMode("op")}
              >
                Push Mode · {pushModeAction.label}
              </button>
              <button
                type="button"
                className={mode === "setup" ? "is-on" : ""}
                onClick={() => setMode("setup")}
              >
                {requiresRoulette ? "Setup de ruleta" : "Equipos & Roster"}
              </button>
              <button
                type="button"
                className={mode === "ocr" ? "is-on" : ""}
                onClick={() => setMode("ocr")}
              >
                OCR Draft Intake
              </button>
            </div>

            {mode === "op" ? (
              <div className="opr-filter">
                <button
                  type="button"
                  className={filter === "all" ? "is-on" : ""}
                  onClick={() => setFilter("all")}
                >
                  Todos <span className="c">{totalTeams}</span>
                </button>
                <button
                  type="button"
                  className={filter === "pending" ? "is-on" : ""}
                  onClick={() => setFilter("pending")}
                >
                  Pendientes <span className="c">{pendingCount}</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* ---- Chips de pendientes (saltar a) ---- */}
          {mode === "op" && pendingCount > 0 ? (
            <div className="opr-chips">
              <span className="opr-chips-label">Saltar a:</span>
              {pendingTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  className="opr-chip"
                  onClick={() => jumpToTeam(team.id)}
                >
                  <i />
                  {team.name.replace(/^TEAM\s+/i, "")}
                </button>
              ))}
            </div>
          ) : null}

          {/* ---- OPERACIÓN: grilla de reportes ---- */}
          {mode === "op" ? (
            activeMatch ? (
              <div className="opr-grid">
                {visibleTeams.map((team) => {
                  const savedResult = activeMatchResults.find(
                    (result) => result.team_id === team.id
                  );
                  const key = getDraftKey(activeMatch.id, team.id);
                  const draft = {
                    kills: resultDrafts[key]?.kills ?? (savedResult ? String(savedResult.kills) : ""),
                    placement:
                      resultDrafts[key]?.placement ??
                      (savedResult ? String(savedResult.placement) : ""),
                  };
                  const estimatedTotal =
                    savedResult?.total_points.toFixed(1) ??
                    (usesPlacement
                      ? estimateWorldSeriesPoints(
                          draft.kills,
                          draft.placement,
                          totalTeams
                        )
                      : draft.kills);
                  const isSaved = Boolean(savedResult);
                  const hasVal = estimatedTotal != null && estimatedTotal !== "";

                  return (
                    <article
                      key={team.id}
                      id={`opr-card-${team.id}`}
                      className={`opr-card ${isSaved ? "is-saved" : "is-pending"}${isFinalized ? " is-finalized" : ""}`}
                    >
                      <div className="opr-card-head">
                        <div>
                          <div className="opr-team-name">{team.name}</div>
                          <p className="opr-team-roster">{rosterText(team)}</p>
                        </div>
                        <span className={`opr-tag ${isSaved ? "t-saved" : "t-pending"}`}>
                          <i />
                          {isFinalized ? "Finalizado" : isSaved ? "Guardado" : "Pendiente"}
                        </span>
                      </div>

                      <div className="opr-inputs">
                        <div className="opr-field">
                          <label>Kills</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={draft.kills}
                            placeholder="0"
                            disabled={isFinalized}
                            onChange={(event) =>
                              onUpdateDraft(activeMatch.id, team.id, { kills: event.target.value })
                            }
                          />
                        </div>
                        {usesPlacement ? (
                          <div className="opr-field">
                            <label>Placement</label>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={draft.placement}
                              placeholder={`1-${effectiveLobbySize}`}
                              disabled={isFinalized}
                              onChange={(event) =>
                                onUpdateDraft(activeMatch.id, team.id, {
                                  placement: event.target.value,
                                })
                              }
                            />
                          </div>
                        ) : null}
                        <div className="opr-total">
                          <label>{usesPlacement ? "Total" : "Kills"}</label>
                          <b className={hasVal ? "has-val" : ""}>{hasVal ? estimatedTotal : "—"}</b>
                        </div>
                      </div>

                      <div className="opr-card-foot">
                        <button
                          type="button"
                          className="opr-save"
                          disabled={submitting || isFinalized}
                          onClick={() => onSaveTeamReport(activeMatch.id, team.id)}
                        >
                          {isFinalized ? "Torneo finalizado" : isSaved ? "Editar" : "Guardar reporte"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="bf-empty">Crea la primera partida para comenzar a cargar reportes.</p>
            )
          ) : null}

          {mode === "ocr" ? (
            <OcrDraftIntake
              key={`${selectedTournament.id}:${currentGame}`}
              tournamentId={selectedTournament.id}
              matchNumber={currentGame}
              activeMatchKey={activeMatch ? `match:${activeMatch.id}` : null}
              teams={teams}
              usesPlacement={usesPlacement}
              effectiveLobbySize={effectiveLobbySize}
            />
          ) : null}

          {/* ---- SETUP: equipos ---- */}
          {mode === "setup" ? (
            requiresRoulette && selectedEngine ? (
              <RouletteArena
                tournament={selectedTournament}
                engine={selectedEngine}
                players={players}
                teams={teams}
                submitting={submitting}
                onImportParticipants={onImportParticipants}
                onRemoveParticipant={onRemoveParticipant}
                onClearParticipants={onClearParticipants}
                onConfirmRoulette={onGenerateRoulette}
                onOpenRosterRespin={onOpenRosterRespin}
                onLockRosterRespin={onLockRosterRespin}
                onGenerateBracket={onGenerateBracket}
                canRegenerate={canRegenerateRoulette}
              />
            ) : (
            <div className="opr-panel">
              <div className="opr-eyebrow">Equipos</div>
              <h2>Agregar equipo real</h2>
              <p className="sub">
                Carga nombre del equipo y roster real en una sola accion. O importa un archivo TXT/CSV con el formato: {importFormatExample}
              </p>

              <input
                ref={teamFileInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                className="bf-roulette-file-input"
                onChange={(event) => void handleTeamImportChange(event)}
                disabled={submitting}
              />
              <div className="bf-hub-form-actions" style={{ marginBottom: 14 }}>
                <button
                  type="button"
                  className="bf-button bf-button-ghost"
                  onClick={() => teamFileInputRef.current?.click()}
                  disabled={submitting || !onBulkImportTeams}
                >
                  Importar TXT/CSV
                </button>
                {teamImportMessage ? (
                  <span className="bf-inline-note">{teamImportMessage}</span>
                ) : null}
              </div>

              <form className="opr-form" onSubmit={onCreateTeam}>
                <div className="opr-field">
                  <label>Nombre del equipo</label>
                  <input
                    value={teamName}
                    onChange={(event) => onTeamNameChange(event.target.value)}
                    placeholder="Team Alpha"
                    required
                  />
                </div>
                <div className="opr-field">
                  <label>Roster</label>
                  <input
                    value={teamRoster}
                    onChange={(event) => onTeamRosterChange(event.target.value)}
                    placeholder="player1, player2, player3"
                    required
                  />
                </div>
                <button type="submit" className="opr-save" disabled={submitting}>
                  Agregar equipo
                </button>
              </form>

              {teamFormError ? <p className="bf-inline-error">{teamFormError}</p> : null}

              {teams.length > 0 ? (
                <div className="opr-teamgrid">
                  {teams.map((team) => (
                    <div key={team.id} className="opr-teamcard">
                      <div className="h">
                        <span className="n">{team.name}</span>
                        <span className="opr-tag t-saved">
                          <i />
                          {team.members.length} players
                        </span>
                      </div>
                      <span className="r">{rosterText(team)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            )
          ) : null}
        </>
      )}
    </main>
  );
}
