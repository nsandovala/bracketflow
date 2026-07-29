"use client";

import {
  ChangeEvent,
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
  MatchCompletionPolicy,
  ParticipantImportResult,
  Player,
  Team,
  TeamResultDetail,
  Tournament,
} from "../../lib/api";
import KillRaceResultIntake from "./KillRaceResultIntake";
import { estimateWorldSeriesPoints } from "../../lib/tournamentMode";
import { getEffectiveLobbySize, ResolvedTournamentEngine } from "../../lib/tournamentModel";
import { getOperatorNextAction } from "../../lib/operatorNextAction";
import {
  getOcrDraftStorageKey,
  OcrDraftReport,
  OcrDraftStatus,
  parseOcrDraftReports,
} from "../../lib/ocrDraftIntake";
import {
  parseStatsDraftImport,
  StatsDraftImportResult,
  StatsDraftImportStatus,
} from "../../lib/statsDraftImport";
import {
  getTeamDisplayName,
  getTeamShortDisplayName,
  isTournamentCompleted,
  findChampion,
  getMatchPointStatusFromPolicy,
  getMatchPointStatusMessage,
  getTeamRosterText,
} from "../../lib/tournamentStatus";
import { KillRaceMapDraft, ResultDraft } from "../lib/useWorldSeriesPractice";
import BracketView from "./BracketView";
import ContextBar from "./ContextBar";
import RouletteArena from "./RouletteArena";
import { detectDelimiter, parseDelimitedTable } from "../../lib/statsDraftImport";
import { parsePlayerStatsPaste, validateManualPlayerStats } from "../../lib/manualPlayerStats";
import {
  createBackendOcrProvider,
  getBackendOcrProviderStatus,
  OCR_IMAGE_ACCEPTED_TYPES,
  validateOcrImageFile,
} from "../../lib/ocrImageExtraction.mjs";
import type {
  OcrExtractionOutcome,
  OcrExtractionProvider,
  OcrProviderStatus,
} from "../../lib/ocrImageExtraction.d.mts";
import {
  buildOcrDraftReports,
  createOcrCandidateRow,
  evaluateOcrBatch,
  getOcrLowConfidenceThreshold,
  OCR_REVIEW_STATUS_LABELS,
} from "../../lib/ocrImageDraftReview.mjs";
import type {
  OcrCandidateRow,
  OcrReviewedRow,
  OcrReviewStatus,
} from "../../lib/ocrImageDraftReview.d.mts";

type WorldSeriesOperatorProps = {
  backendOnline: boolean;
  message: string | null;
  selectedTournament: Tournament | null;
  teams: Team[];
  matches: Match[];
  players: Player[];
  activeMatch: Match | null;
  activeMatchResults: TeamResultDetail[];
  pendingTeams: Team[];
  reportsLoaded: number;
  totalTeams: number;
  latestReportedRound: number;
  canCreateNextGame: boolean;
  matchCompletionPolicy: MatchCompletionPolicy | null;
  selectedEngine: ResolvedTournamentEngine | null;
  nextGameNumber: number;
  submitting: boolean;
  teamName: string;
  teamRoster: string;
  teamFormError: string | null;
  resultDrafts: Record<string, ResultDraft>;
  killRaceMapDrafts: Record<number, KillRaceMapDraft>;
  onPreviewParticipants?: (rows: string[]) => Promise<ParticipantImportResult | null>;
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
  onKillRaceResultChanged: () => Promise<unknown>;
  onCreateNextGame: () => void;
  onConfigureMatchPoint: (threshold: number) => Promise<unknown>;
  onRemoveLatestEmptyMatch: () => Promise<unknown>;
  onBulkImportTeams?: (teams: Array<{ name: string; roster: string }>) => Promise<unknown>;
  onSubmitOfficialReport?: (
    matchId: number,
    teamId: number,
    kills: number,
    placement: number | "",
    playerStats?: Array<{ playerName: string; kills: number }>
  ) => Promise<unknown>;
};

type OperatorMode = "op" | "setup" | "bracket";
type ResultFilter = "all" | "pending";
// Fuente de entrada de reportes dentro de la única sección "Reportes de partida".
// No son sistemas paralelos: manual opera las cards oficiales; import y ocr
// crean drafts revisables en la MISMA cola (OcrDraftIntake), solo cambia la
// entrada (tabla pegada/CSV vs imagen).
type ReportSource = "manual" | "import" | "ocr";
type OcrDraftPersistenceState = "loading" | "local" | "memory";

const OCR_DRAFT_STATUS_LABELS: Record<OcrDraftStatus, string> = Object.fromEntries(
  [
    ["pending", "Draft pendiente de revisión"],
    ["confirmed", "Confirmado manualmente"],
    ["disputed", "Disputado / requiere revisión"],
    ["submitted", "Reporte oficial guardado"],
  ]
) as Record<OcrDraftStatus, string>;

const STATS_IMPORT_STATUS_LABELS: Record<StatsDraftImportStatus, string> = {
  valid: "Válida",
  invalid_missing_team: "Falta equipo",
  invalid_unknown_team: "Equipo desconocido",
  invalid_kills: "Kills inválidas",
  invalid_placement: "Placement inválido",
  invalid_player_kills: "Kills de player inválidas",
  player_kills_mismatch: "Kills de players no cuadran / revisar",
  duplicate_existing_draft: "Draft duplicado",
  official_report_exists: "Reporte oficial existente",
  official_conflict: "Conflicto / revisar",
};

function formatPlayerStatsLine(
  stats: Array<{ playerName: string; kills: number }>
) {
  return stats.map((stat) => `${stat.playerName} ${stat.kills}`).join(" · ");
}

function OcrDraftIntake({
  source,
  tournamentId,
  tournamentName,
  matchNumber,
  activeMatchKey,
  activeMatchId,
  teams,
  usesPlacement,
  effectiveLobbySize,
  tournamentFinalized,
  officialResults,
  submitting,
  onSubmitOfficialReport,
}: {
  source: "import" | "ocr";
  tournamentId: number;
  tournamentName: string;
  matchNumber: number;
  activeMatchKey: string | null;
  activeMatchId: number | null;
  teams: Team[];
  usesPlacement: boolean;
  effectiveLobbySize: number;
  tournamentFinalized: boolean;
  officialResults: Array<{ team_id: number; kills: number; placement: number }>;
  submitting: boolean;
  onSubmitOfficialReport?: (
    matchId: number,
    teamId: number,
    kills: number,
    placement: number | "",
    playerStats?: Array<{ playerName: string; kills: number }>
  ) => Promise<unknown>;
}) {
  const storageKey = getOcrDraftStorageKey(tournamentId, matchNumber);
  const [drafts, setDrafts] = useState<OcrDraftReport[]>([]);
  // Fuente sincrona de verdad para mutaciones: un submit oficial async no debe
  // persistir un array capturado antes de que otra accion (confirmar/disputar/
  // descartar) haya cambiado los drafts. Toda escritura pasa por applyDrafts.
  const draftsRef = useRef<OcrDraftReport[]>([]);
  const [persistenceState, setPersistenceState] =
    useState<OcrDraftPersistenceState>("loading");
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<StatsDraftImportResult | null>(
    null
  );
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const raw = window.localStorage.getItem(storageKey);
        const parsed = raw ? parseOcrDraftReports(raw, tournamentId, matchNumber) : [];
        draftsRef.current = parsed;
        setDrafts(parsed);
        setPersistenceState("local");
      } catch {
        draftsRef.current = [];
        setDrafts([]);
        setPersistenceState("memory");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [matchNumber, storageKey, tournamentId]);

  function getDraftTeam(draft: OcrDraftReport) {
    return teams.find((team) => team.id === draft.teamId) ?? null;
  }

  function getDraftTeamLabel(draft: OcrDraftReport) {
    const team = getDraftTeam(draft);
    return team ? getTeamDisplayName(team) : draft.teamName;
  }

  // Razon por la que un draft confirmado NO puede enviarse como reporte oficial.
  // null = envio permitido. El backend es create-only; esto solo adelanta el
  // bloqueo en la UI para evitar reintentos innecesarios.
  function getOfficialSubmitBlocker(draft: OcrDraftReport): string | null {
    if (!onSubmitOfficialReport) {
      return "Envío oficial no disponible en esta vista.";
    }
    if (tournamentFinalized) {
      return "Torneo finalizado: el draft queda solo como revisión local.";
    }
    if (activeMatchId === null) {
      return "Sin partida activa: no se puede guardar reporte oficial.";
    }
    if (draft.activeMatchKey !== null && draft.activeMatchKey !== `match:${activeMatchId}`) {
      return "El draft pertenece a otra partida activa.";
    }
    if (!getDraftTeam(draft)) {
      return "Equipo desconocido: revisa el roster antes de enviar.";
    }
    if (officialResults.some((result) => result.team_id === draft.teamId)) {
      return "Ya existe reporte oficial para este equipo en esta partida.";
    }
    if (!Number.isInteger(draft.kills) || draft.kills < 0) {
      return "Kills inválidas para reporte oficial.";
    }
    if (
      usesPlacement &&
      (draft.placement === "" ||
        draft.placement < 1 ||
        draft.placement > effectiveLobbySize)
    ) {
      return `Placement debe estar entre 1 y ${effectiveLobbySize}.`;
    }
    return null;
  }

  async function handleSubmitOfficialReport(draft: OcrDraftReport) {
    if (!onSubmitOfficialReport || activeMatchId === null || submittingDraftId !== null) {
      return;
    }

    setSubmittingDraftId(draft.id);
    try {
      const result = await onSubmitOfficialReport(
        activeMatchId,
        draft.teamId,
        draft.kills,
        draft.placement,
        draft.playerStats
      );
      // Solo si el backend acepto el reporte marcamos el draft como enviado;
      // si fallo (p. ej. 409 por reporte existente), el draft local se conserva
      // para revision. El updater parte del estado mas reciente: no revive un
      // draft descartado en vuelo ni revierte otros cambios concurrentes.
      if (result) {
        const updatedAt = new Date().toISOString();
        applyDrafts((previous) =>
          previous.map((item) =>
            item.id === draft.id ? { ...item, status: "submitted", updatedAt } : item
          )
        );
      }
    } finally {
      setSubmittingDraftId(null);
    }
  }

  function applyDrafts(updater: (previous: OcrDraftReport[]) => OcrDraftReport[]) {
    const nextDrafts = updater(draftsRef.current);
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    if (persistenceState !== "local") {
      return nextDrafts;
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
    return nextDrafts;
  }

  function updateDraftStatus(id: string, status: OcrDraftStatus) {
    const updatedAt = new Date().toISOString();
    applyDrafts((previous) =>
      previous.map((draft) => (draft.id === id ? { ...draft, status, updatedAt } : draft))
    );
  }

  function discardDraft(id: string) {
    applyDrafts((previous) => previous.filter((draft) => draft.id !== id));
  }

  function buildImportPreview(existingDrafts = draftsRef.current) {
    return parseStatsDraftImport(importText, {
      teams,
      existingDrafts,
      officialResults,
      tournamentId,
      matchNumber,
      usesPlacement,
      effectiveLobbySize,
    });
  }

  function handlePreviewStatsImport() {
    setImportMessage(null);
    setImportError(null);

    if (importText.trim() === "") {
      setImportPreview(null);
      setImportError("Pega una tabla o selecciona un archivo CSV, TSV o TXT.");
      return;
    }

    const preview = buildImportPreview();
    setImportPreview(preview);
    if (preview.delimiter === null) {
      setImportError("No se reconoció una tabla con encabezados separados.");
    } else if (preview.missingColumns.length > 0) {
      setImportError(
        `Faltan columnas requeridas: ${preview.missingColumns.join(", ")}.`
      );
    }
  }

  async function handleStatsImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImportMessage(null);
    setImportError(null);
    setImportPreview(null);

    if (!file) {
      return;
    }

    const normalizedName = file.name.toLocaleLowerCase("es");
    if (normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".xls")) {
      setImportFileName(null);
      setImportError(
        "Por ahora exporta el Excel como CSV o pega la tabla aquí."
      );
      event.target.value = "";
      return;
    }

    if (
      !normalizedName.endsWith(".csv") &&
      !normalizedName.endsWith(".tsv") &&
      !normalizedName.endsWith(".txt")
    ) {
      setImportFileName(null);
      setImportError("Formato no compatible. Usa CSV, TSV, TXT o pega la tabla.");
      event.target.value = "";
      return;
    }

    try {
      const contents = await file.text();
      setImportText(contents);
      setImportFileName(file.name);
      setImportMessage(`${file.name} cargado localmente. Revisa antes de crear drafts.`);
    } catch {
      setImportFileName(null);
      setImportError("No se pudo leer el archivo local.");
    }
  }

  function handleCreateImportedDrafts() {
    setImportMessage(null);
    setImportError(null);

    if (!activeMatchKey) {
      setImportError("Necesitas una partida activa para crear drafts desde una tabla.");
      return;
    }

    const currentPreview = buildImportPreview();
    const validRows = currentPreview.rows.filter((row) => row.status === "valid");
    if (validRows.length === 0) {
      setImportPreview(currentPreview);
      setImportError("No hay filas válidas nuevas para crear.");
      return;
    }

    const timestamp = new Date().toISOString();
    const importedDrafts = validRows.flatMap((row): OcrDraftReport[] => {
      if (row.teamId === null || row.kills === null) {
        return [];
      }

      return [
        {
          id: window.crypto.randomUUID(),
          tournamentId,
          matchNumber,
          activeMatchKey,
          teamId: row.teamId,
          teamName: row.teamName,
          kills: row.kills,
          placement: row.placement,
          ...(row.playerStats ? { playerStats: row.playerStats } : {}),
          source: "CSV_IMPORT",
          note:
            row.note ||
            `Importación CSV · ${importFileName ?? "tabla pegada"} · fila ${row.rowNumber}`,
          status: "pending",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ];
    });
    const nextDrafts = applyDrafts((previous) => [...importedDrafts, ...previous]);
    setImportPreview(
      parseStatsDraftImport(importText, {
        teams,
        existingDrafts: nextDrafts,
        officialResults,
        tournamentId,
        matchNumber,
        usesPlacement,
        effectiveLobbySize,
      })
    );
    setImportMessage(
      `${importedDrafts.length} draft${importedDrafts.length === 1 ? "" : "s"} local${importedDrafts.length === 1 ? "" : "es"} creado${importedDrafts.length === 1 ? "" : "s"} para revisión humana.`
    );
  }

  const importValidCount =
    importPreview?.rows.filter((row) => row.status === "valid").length ?? 0;

  return (
    <section className="opr-panel opr-ocr-intake" aria-labelledby="opr-stats-import-title">
      <div className="opr-ocr-rule">
        <strong>Borradores locales.</strong>
        <span>
          Importar o confirmar aquí no envía nada al torneo. Solo “Guardar reporte
          oficial” sobre un draft confirmado impacta los reportes de la partida.
          {persistenceState === "memory"
            ? " Almacenamiento local no disponible: los drafts viven en memoria y se pierden al recargar."
            : " Los drafts se guardan en este navegador."}
        </span>
      </div>

      {source === "import" ? (
      <section className="opr-stats-import" aria-labelledby="opr-stats-import-title">
        <div className="opr-stats-import-head">
          <div>
            <h3 id="opr-stats-import-title">Importar tabla / CSV</h3>
            <p>
              Pega una tabla exportada desde Excel o sube un CSV. BracketFlow creará
              borradores locales para revisión.
            </p>
          </div>
          <span>CSV · TSV · TXT</span>
        </div>

        <div className="opr-stats-import-inputs">
          <label className="opr-field opr-stats-import-paste" htmlFor="opr-stats-import-text">
            <span>Tabla pegada</span>
            <textarea
              id="opr-stats-import-text"
              value={importText}
              rows={5}
              placeholder={"team,kills,placement,note\nAmon Reapers,23,1,print partida 1"}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportFileName(null);
                setImportPreview(null);
                setImportMessage(null);
                setImportError(null);
              }}
            />
          </label>
          <div className="opr-stats-import-file">
            <input
              ref={importFileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values,text/plain"
              onChange={(event) => void handleStatsImportFile(event)}
            />
            <button
              type="button"
              className="bf-button bf-button-ghost"
              onClick={() => importFileInputRef.current?.click()}
            >
              Seleccionar archivo
            </button>
            <small>{importFileName ?? "El archivo no sale de este navegador."}</small>
          </div>
        </div>

        <div className="opr-stats-import-actions">
          <button
            type="button"
            className="bf-button bf-button-ghost"
            onClick={handlePreviewStatsImport}
            disabled={persistenceState === "loading"}
          >
            Previsualizar
          </button>
          <button
            type="button"
            className="opr-save"
            onClick={handleCreateImportedDrafts}
            disabled={
              persistenceState === "loading" ||
              !activeMatchKey ||
              importValidCount === 0
            }
          >
            Crear drafts locales
          </button>
          {!activeMatchKey ? (
            <small>Sin partida activa: puedes revisar la tabla, pero no crear drafts.</small>
          ) : null}
        </div>

        {importError ? (
          <p className="bf-inline-error" role="alert">
            {importError}
          </p>
        ) : null}
        {importMessage ? (
          <p className="bf-inline-note" role="status">
            {importMessage}
          </p>
        ) : null}

        {importPreview ? (
          <div className="opr-stats-import-preview">
            <div className="opr-stats-import-summary">
              <strong>{importPreview.rows.length} filas</strong>
              <span>{importValidCount} válidas nuevas</span>
            </div>
            <div className="opr-stats-import-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Equipo</th>
                    <th>Kills</th>
                    {usesPlacement ? <th>Placement</th> : null}
                    <th>Players</th>
                    <th>Nota</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row) => {
                    const rowTeam =
                      row.teamId !== null
                        ? teams.find((team) => team.id === row.teamId)
                        : undefined;
                    return (
                    <tr key={row.rowNumber} className={`is-${row.status}`}>
                      <td>{row.rowNumber}</td>
                      <td>{rowTeam ? getTeamDisplayName(rowTeam) : row.teamName || "—"}</td>
                      <td>{row.kills ?? "—"}</td>
                      {usesPlacement ? <td>{row.placement || "—"}</td> : null}
                      <td>
                        {row.playerStats ? formatPlayerStatsLine(row.playerStats) : "—"}
                      </td>
                      <td>{row.note || "—"}</td>
                      <td>
                        <span>{STATS_IMPORT_STATUS_LABELS[row.status]}</span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
      ) : null}

      {source === "ocr" ? (
        <OcrImageIntake
          tournamentId={tournamentId}
          tournamentName={tournamentName}
          matchNumber={matchNumber}
          activeMatchKey={activeMatchKey}
          activeMatchId={activeMatchId}
          teams={teams}
          usesPlacement={usesPlacement}
          effectiveLobbySize={effectiveLobbySize}
          officialResults={officialResults}
          existingDraftTeamIds={
            new Set(
              drafts
                .filter(
                  (draft) =>
                    draft.tournamentId === tournamentId && draft.matchNumber === matchNumber
                )
                .map((draft) => draft.teamId)
            )
          }
          disabled={persistenceState === "loading"}
          onCreateDrafts={(newDrafts) => {
            applyDrafts((previous) => [...newDrafts, ...previous]);
          }}
        />
      ) : null}

      <div className="opr-ocr-queue">
        <div className="opr-ocr-queue-head">
          <div>
            <span>Borradores locales</span>
            <strong>{drafts.length}</strong>
          </div>
          <small>
            Guardados localmente
            {source === "ocr"
              ? " (de cualquier fuente: manual import, CSV/TXT u OCR imagen)."
              : "."}{" "}
            Solo cuentan como reporte al usar “Guardar reporte oficial”.
          </small>
        </div>

        {drafts.length === 0 ? (
          <p className="opr-ocr-empty">
            Sin borradores. Importa una tabla o CSV para crear borradores revisables.
          </p>
        ) : (
          <div className="opr-ocr-drafts">
            {drafts.map((draft) => {
              const submitBlocker =
                draft.status === "confirmed" ? getOfficialSubmitBlocker(draft) : null;

              return (
                <article key={draft.id} className={`opr-ocr-draft is-${draft.status}`}>
                  <div className="opr-ocr-draft-main">
                    <div>
                      <strong>{getDraftTeamLabel(draft)}</strong>
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
                  {draft.playerStats && draft.playerStats.length > 0 ? (
                    <p className="opr-ocr-draft-players">
                      {formatPlayerStatsLine(draft.playerStats)}
                    </p>
                  ) : null}
                  {draft.note ? <p>{draft.note}</p> : null}
                  {submitBlocker ? (
                    <p className="bf-inline-note" role="status">
                      {submitBlocker}
                    </p>
                  ) : null}
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
                    ) : draft.status === "confirmed" ? (
                      <>
                        {submitBlocker === null ? (
                          <button
                            type="button"
                            className="opr-save"
                            disabled={submitting || submittingDraftId !== null}
                            onClick={() => void handleSubmitOfficialReport(draft)}
                          >
                            {submittingDraftId === draft.id
                              ? "Guardando reporte oficial…"
                              : "Guardar reporte oficial"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="bf-button bf-button-ghost"
                          disabled={submittingDraftId === draft.id}
                          onClick={() => updateDraftStatus(draft.id, "disputed")}
                        >
                          Disputar
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="bf-button bf-button-ghost"
                      disabled={submittingDraftId === draft.id}
                      onClick={() => discardDraft(draft.id)}
                    >
                      Descartar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// Fases de la captura OCR (§2 del spec: Sin imagen / Imagen seleccionada /
// Procesando / Extracción completada / Extracción parcial / No se
// detectaron filas / Error de lectura). "revisando" cubre completada/parcial
// a la vez; el label exacto se decide en render segun reviewedRows.
type OcrImagePhase =
  | "sin-imagen"
  | "imagen-seleccionada"
  | "procesando"
  | "revisando"
  | "sin-filas"
  | "error-lectura";

const OCR_IMAGE_PHASE_LABELS: Record<OcrImagePhase, string> = {
  "sin-imagen": "Sin imagen",
  "imagen-seleccionada": "Imagen seleccionada",
  procesando: "Procesando",
  revisando: "Extracción completada",
  "sin-filas": "No se detectaron filas",
  "error-lectura": "Error de lectura",
};

function OcrImageIntake({
  tournamentId,
  tournamentName,
  matchNumber,
  activeMatchKey,
  activeMatchId,
  teams,
  usesPlacement,
  effectiveLobbySize,
  officialResults,
  existingDraftTeamIds,
  disabled,
  onCreateDrafts,
}: {
  tournamentId: number;
  tournamentName: string;
  matchNumber: number;
  activeMatchKey: string | null;
  activeMatchId: number | null;
  teams: Team[];
  usesPlacement: boolean;
  effectiveLobbySize: number;
  officialResults: Array<{ team_id: number; kills: number; placement: number }>;
  existingDraftTeamIds: Set<number>;
  disabled: boolean;
  onCreateDrafts: (drafts: OcrDraftReport[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<OcrImagePhase>("sin-imagen");
  const [fileError, setFileError] = useState<string | null>(null);
  const [extractionMessage, setExtractionMessage] = useState<string | null>(null);
  const [extractionMetadata, setExtractionMetadata] = useState<{
    provider: string;
    model: string;
    confidence: number | null;
  } | null>(null);
  const [providerStatus, setProviderStatus] = useState<OcrProviderStatus | null>(null);
  const [candidates, setCandidates] = useState<OcrCandidateRow[]>([]);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const provider = useMemo<OcrExtractionProvider>(
    () => createBackendOcrProvider({ tournamentId, matchId: activeMatchId }),
    [tournamentId, activeMatchId]
  );

  useEffect(() => {
    let cancelled = false;
    void getBackendOcrProviderStatus().then((status) => {
      if (!cancelled) setProviderStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const reviewContext = useMemo(
    () => ({
      teams,
      usesPlacement,
      effectiveLobbySize,
      officialResults,
      existingDraftTeamIds,
      lowConfidenceThreshold: getOcrLowConfidenceThreshold(),
    }),
    [teams, usesPlacement, effectiveLobbySize, officialResults, existingDraftTeamIds]
  );

  const reviewedRows: OcrReviewedRow<Team>[] = useMemo(
    () => evaluateOcrBatch(candidates, reviewContext),
    [candidates, reviewContext]
  );
  const includedValidCount = reviewedRows.filter(
    (row) => row.candidate.included && row.evaluation.status === "valida"
  ).length;
  const allRowsValid =
    reviewedRows.length > 0 && reviewedRows.every((row) => row.evaluation.status === "valida");
  const phaseLabel =
    phase === "revisando"
      ? allRowsValid
        ? "Extracción completada"
        : "Extracción parcial"
      : OCR_IMAGE_PHASE_LABELS[phase];

  function resetExtraction() {
    setCandidates([]);
    setExtractionMessage(null);
    setExtractionMetadata(null);
    setCreateMessage(null);
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFileError(null);
    resetExtraction();

    if (!selected) {
      return;
    }

    const validation = validateOcrImageFile(selected);
    if (!validation.ok) {
      setFile(null);
      setPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setPhase("sin-imagen");
      setFileError(validation.message);
      return;
    }

    setFile(selected);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(selected);
    });
    setPhase("imagen-seleccionada");
  }

  function handleRemoveImage() {
    setFile(null);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setFileError(null);
    setPhase("sin-imagen");
    resetExtraction();
  }

  async function handleProcessImage() {
    if (!file || phase === "procesando") {
      return;
    }
    setPhase("procesando");
    setExtractionMessage(null);
    setCreateMessage(null);

    const outcome: OcrExtractionOutcome = await provider(file);

    if (!outcome.ok) {
      setPhase("error-lectura");
      setExtractionMessage(outcome.message);
      setCandidates([]);
      return;
    }

    setExtractionMetadata({
      provider: outcome.result.provider ?? "ocr",
      model: outcome.result.model ?? "no informado",
      confidence: outcome.result.confidence ?? null,
    });

    if (outcome.result.rows.length === 0) {
      setPhase("sin-filas");
      setExtractionMessage(
        outcome.result.warnings.length > 0
          ? outcome.result.warnings.join(" ")
          : "No se detectaron filas en la imagen. Prueba con otra captura o usa Manual/CSV."
      );
      setCandidates([]);
      return;
    }

    setCandidates(outcome.result.rows.map((row) => createOcrCandidateRow(row)));
    setExtractionMessage(
      outcome.result.warnings.length > 0 ? outcome.result.warnings.join(" ") : null
    );
    setPhase("revisando");
  }

  function handleDiscardExtraction() {
    resetExtraction();
    setPhase(file ? "imagen-seleccionada" : "sin-imagen");
  }

  function updateCandidate(key: string, patch: Partial<OcrCandidateRow>) {
    setCandidates((previous) =>
      previous.map((candidate) => (candidate.key === key ? { ...candidate, ...patch } : candidate))
    );
  }

  function updateCandidatePlayerKills(key: string, playerIndex: number, value: string) {
    setCandidates((previous) =>
      previous.map((candidate) => {
        if (candidate.key !== key || !candidate.playerStats) {
          return candidate;
        }
        return {
          ...candidate,
          playerStats: candidate.playerStats.map((player, index) =>
            index === playerIndex ? { ...player, killsInput: value } : player
          ),
          edited: { ...candidate.edited, players: true },
        };
      })
    );
  }

  function handleCreateDrafts() {
    if (!activeMatchKey) {
      setCreateMessage("Necesitas una partida activa para crear drafts desde una imagen.");
      return;
    }

    const creatableRows = reviewedRows.filter(
      (row) => row.candidate.included && row.evaluation.status === "valida"
    );
    if (creatableRows.length === 0) {
      setCreateMessage("No hay filas válidas incluidas para crear drafts.");
      return;
    }

    const newDrafts = buildOcrDraftReports(creatableRows, {
      tournamentId,
      matchNumber,
      activeMatchKey,
      imageFileName: file?.name ?? null,
    });
    onCreateDrafts(newDrafts);

    const createdKeys = new Set(creatableRows.map((row) => row.candidate.key));
    setCandidates((previous) => previous.filter((candidate) => !createdKeys.has(candidate.key)));
    setCreateMessage(
      `${newDrafts.length} draft${newDrafts.length === 1 ? "" : "s"} local${
        newDrafts.length === 1 ? "" : "es"
      } creado${newDrafts.length === 1 ? "" : "s"} para revisión humana.`
    );
  }

  return (
    <section className="opr-panel opr-image-intake" aria-labelledby="opr-image-intake-title">
      <div className="opr-stats-import-head">
        <div>
          <h3 id="opr-image-intake-title">OCR imagen</h3>
          <p>
            Sube una captura de los resultados de UNA partida de torneo. BracketFlow
            extrae filas candidatas para revisión humana antes de crear borradores.
            Nunca guarda un resultado oficial automáticamente.
          </p>
        </div>
        <span className={`opr-image-intake-state is-${phase}`}>{phaseLabel}</span>
      </div>

      <div className="opr-image-intake-context">
        <span>
          <strong>{tournamentName}</strong>
        </span>
        <span>Partida {matchNumber}</span>
        <span>{teams.length} equipos esperados</span>
        <span>{officialResults.length} reportes oficiales guardados</span>
        {providerStatus?.configured ? (
          <span>
            OCR configurado: {providerStatus.provider} · {providerStatus.model}
          </span>
        ) : null}
      </div>

      {!activeMatchKey ? (
        <p className="bf-inline-note" role="status">
          Sin partida activa: puedes revisar la imagen, pero no crear drafts.
        </p>
      ) : null}

      <div className="opr-image-intake-inputs">
        <input
          ref={fileInputRef}
          type="file"
          accept={OCR_IMAGE_ACCEPTED_TYPES.join(",")}
          onChange={handleSelectFile}
          disabled={disabled || phase === "procesando"}
        />
        <div className="opr-image-intake-picker">
          <button
            type="button"
            className="bf-button bf-button-ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || phase === "procesando"}
          >
            {file ? "Reemplazar imagen" : "Seleccionar imagen"}
          </button>
          {file ? (
            <button
              type="button"
              className="bf-button bf-button-ghost"
              onClick={handleRemoveImage}
              disabled={phase === "procesando"}
            >
              Quitar imagen
            </button>
          ) : null}
          <small>PNG, JPG/JPEG o WEBP · máx. 8 MB · una imagen a la vez</small>
        </div>
        {previewUrl ? (
          <div className="opr-image-intake-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={file ? `Vista previa de ${file.name}` : "Vista previa"} />
            <span>{file?.name}</span>
          </div>
        ) : null}
      </div>

      {fileError ? (
        <p className="bf-inline-error" role="alert">
          {fileError}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        <div className="opr-stats-import-actions">
          <button
            type="button"
            className="opr-save"
            disabled={!file || phase === "procesando" || disabled}
            onClick={() => void handleProcessImage()}
          >
            {phase === "procesando" ? "Procesando…" : "Procesar imagen"}
          </button>
        </div>
      ) : null}

      {extractionMessage ? (
        <p
          className={phase === "error-lectura" ? "bf-inline-error" : "bf-inline-note"}
          role={phase === "error-lectura" ? "alert" : "status"}
        >
          {extractionMessage}
        </p>
      ) : null}
      {extractionMetadata ? (
        <p className="bf-inline-note" role="status">
          {extractionMetadata.provider} · {extractionMetadata.model}
          {extractionMetadata.confidence === null
            ? ""
            : ` · confianza ${Math.round(extractionMetadata.confidence * 100)}%`}
        </p>
      ) : null}
      {createMessage ? (
        <p className="bf-inline-note" role="status">
          {createMessage}
        </p>
      ) : null}

      {reviewedRows.length > 0 ? (
        <div className="opr-stats-import-table-wrap opr-image-review-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Incluir</th>
                <th>Texto detectado</th>
                <th>Equipo</th>
                <th>Kills</th>
                {usesPlacement ? <th>Placement</th> : null}
                <th>Players</th>
                <th>Estado</th>
                <th>Avisos</th>
              </tr>
            </thead>
            <tbody>
              {reviewedRows.map(({ candidate, evaluation }) => (
                <tr key={candidate.key} className={`is-${evaluation.status}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={candidate.included}
                      aria-label="Incluir fila"
                      onChange={() =>
                        updateCandidate(candidate.key, { included: !candidate.included })
                      }
                    />
                  </td>
                  <td>{candidate.rawTeamName || "—"}</td>
                  <td>
                    <select
                      value={evaluation.teamId ?? ""}
                      onChange={(event) =>
                        updateCandidate(candidate.key, {
                          teamOverrideId:
                            event.target.value === "" ? null : Number(event.target.value),
                          edited: { ...candidate.edited, team: true },
                        })
                      }
                    >
                      <option value="">
                        {evaluation.status === "equipo_ambiguo" ? "Elegir equipo…" : "Sin resolver"}
                      </option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {getTeamDisplayName(team)}
                        </option>
                      ))}
                    </select>
                    {evaluation.status === "equipo_ambiguo" &&
                    evaluation.ambiguousCandidates.length > 0 ? (
                      <small>
                        Coincide con: {evaluation.ambiguousCandidates.map((c) => c.name).join(", ")}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className="opr-image-review-input"
                      value={candidate.killsInput}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateCandidate(candidate.key, {
                          killsInput: event.target.value,
                          edited: { ...candidate.edited, kills: true },
                        })
                      }
                    />
                  </td>
                  {usesPlacement ? (
                    <td>
                      <input
                        className="opr-image-review-input"
                        value={candidate.placementInput}
                        inputMode="numeric"
                        onChange={(event) =>
                          updateCandidate(candidate.key, {
                            placementInput: event.target.value,
                            edited: { ...candidate.edited, placement: true },
                          })
                        }
                      />
                    </td>
                  ) : null}
                  <td>
                    {candidate.playerStats && candidate.playerStats.length > 0 ? (
                      <div className="opr-image-review-players">
                        {candidate.playerStats.map((player, index) => (
                          <label key={`${candidate.key}-${index}`}>
                            <span>
                              {player.playerName}
                              {player.damage === null ? "" : ` · ${player.damage} dmg`}
                              {player.assists === null ? "" : ` · ${player.assists} ast`}
                              {player.redeploys === null ? "" : ` · ${player.redeploys} red`}
                            </span>
                            <input
                              className="opr-image-review-input"
                              value={player.killsInput}
                              inputMode="numeric"
                              onChange={(event) =>
                                updateCandidatePlayerKills(candidate.key, index, event.target.value)
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`opr-image-review-status is-${evaluation.status}`}>
                      {OCR_REVIEW_STATUS_LABELS[evaluation.status as OcrReviewStatus]}
                    </span>
                  </td>
                  <td>
                    {evaluation.warnings.length > 0 ? (
                      <ul className="opr-image-review-warnings">
                        {evaluation.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {reviewedRows.length > 0 ? (
        <div className="opr-stats-import-actions">
          <button
            type="button"
            className="opr-save"
            disabled={!activeMatchKey || disabled || includedValidCount === 0}
            onClick={handleCreateDrafts}
          >
            Crear drafts válidos ({includedValidCount})
          </button>
          <button
            type="button"
            className="bf-button bf-button-ghost"
            onClick={() => void handleProcessImage()}
            disabled={phase === "procesando"}
          >
            Reprocesar imagen
          </button>
          <button
            type="button"
            className="bf-button bf-button-ghost"
            onClick={handleDiscardExtraction}
            disabled={phase === "procesando"}
          >
            Descartar extracción
          </button>
        </div>
      ) : null}
    </section>
  );
}

function getDraftKey(matchId: number, teamId: number) {
  return `${matchId}:${teamId}`;
}

type PlayerStatsPasteHelperProps = {
  roster: Array<{ id: number; name: string }>;
  disabled: boolean;
  onApply: (values: Record<number, string>) => void;
};

function PlayerStatsPasteHelper({ roster, disabled, onApply }: PlayerStatsPasteHelperProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    const parsed = parsePlayerStatsPaste(value, roster);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    setValue("");
    onApply(parsed.values);
  }

  return (
    <div className="opr-player-stats-paste">
      <textarea
        className="opr-player-stats-paste-input"
        value={value}
        rows={1}
        placeholder={"Pegar kills · 5 6 6  ·  VITO 5, JOAN 6, JASFA 6"}
        aria-label="Pegar kills por jugador"
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          if (error) setError(null);
        }}
      />
      <button
        type="button"
        className="bf-button bf-button-ghost opr-player-stats-paste-apply"
        disabled={disabled || value.trim() === ""}
        onClick={handleApply}
      >
        Aplicar
      </button>
      {error ? (
        <p className="opr-player-stats-paste-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function rosterText(team: Team) {
  return team.members.length > 0
    ? team.members.map((member) => member.player.nickname).join(" / ")
    : "Roster pendiente";
}

function isTeamImportHeader(cells: string[]) {
  const first = (cells[0] ?? "").trim().toLocaleLowerCase("es");
  const second = (cells[1] ?? "").trim().toLocaleLowerCase("es");
  return (
    ["team", "equipo", "nombre", "name"].includes(first) &&
    (second.startsWith("player") ||
      second.startsWith("jugador") ||
      second === "roster" ||
      second === "captain")
  );
}

function parseBulkTeamImport(text: string) {
  const delimiter = detectDelimiter(text) ?? ",";
  const rows = parseDelimitedTable(text, delimiter);
  const dataRows = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  const normalizedRows = isTeamImportHeader(dataRows[0] ?? []) ? dataRows.slice(1) : dataRows;

  return normalizedRows
    .map((cells) => ({
      name: (cells[0] ?? "").trim(),
      rosterAliases: cells
        .slice(1)
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0),
    }))
    .filter((entry) => entry.name.length > 0 && entry.rosterAliases.length > 0)
    .map((entry) => ({
      name: entry.name,
      roster: entry.rosterAliases.join(", "),
      rosterAliases: entry.rosterAliases,
    }));
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
  matchCompletionPolicy,
  selectedEngine,
  nextGameNumber,
  submitting,
  teamName,
  teamRoster,
  teamFormError,
  resultDrafts,
  onPreviewParticipants,
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
  onSelectKillRaceMatch,
  onSaveTeamReport,
  onKillRaceResultChanged,
  onCreateNextGame,
  onConfigureMatchPoint,
  onRemoveLatestEmptyMatch,
  onBulkImportTeams,
  onSubmitOfficialReport,
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
      : searchParams.get("tab") === "bracket"
        ? "bracket"
        : "op"
  );
  // ?tab=ocr abre Reportes con la fuente OCR imagen (ya funcional).
  const [reportSource, setReportSource] = useState<ReportSource>(
    searchParams.get("tab") === "ocr" ? "ocr" : "manual"
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
      setMode("op");
      setReportSource("ocr");
    } else if (tabParam === "bracket") {
      setMode("bracket");
    }
  }
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [teamImportMessage, setTeamImportMessage] = useState<string | null>(null);
  const [matchPointThresholdDraft, setMatchPointThresholdDraft] = useState("");
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
      ? getMatchPointStatusFromPolicy({
          policy: matchCompletionPolicy,
          teams,
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
    matchCompletionPolicy,
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
    const parsed = parseBulkTeamImport(text);

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
            {matchPointStatus.state === "champion"
              ? "Campeon por Match Point"
              : matchPointStatus.state === "not_configured"
                ? "Configuración requerida"
                : "Estado Match Point"}
          </span>
          <strong className="bf-status-banner-title">
            {matchPointStatus.state === "champion"
              ? matchPointStatus.championLabel
              : matchPointStatus.state === "not_configured"
                ? "Match Point no configurado"
                : matchPointStatus.state === "threshold_reached"
                  ? "Match Point alcanzado"
                  : matchPointStatus.state === "disabled"
                    ? "Match Point desactivado"
                    : "Motor sin Match Point"}
          </strong>
          <span className="bf-status-banner-sub">
            {matchPointStatus.state === "champion"
              ? `${matchPointRoster}${selectedTournament?.status === "completed" ? " - Torneo finalizado." : ""}`
              : matchPointMessage}
          </span>
        </section>
      ) : null}

      {matchCompletionPolicy?.state === "match_point_not_configured" ? (
        <section className="opr-panel bf-match-point-repair" aria-labelledby="match-point-repair-title">
          <div className="opr-eyebrow">Reparación de configuración</div>
          <h2 id="match-point-repair-title">Configurar Match Point</h2>
          <p className="sub">{matchCompletionPolicy.reason}</p>
          <div className="bf-hub-form-actions">
            <label className="bf-field">
              <span>Umbral de puntos</span>
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Ej. 125"
                value={matchPointThresholdDraft}
                onChange={(event) => setMatchPointThresholdDraft(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="opr-save"
              disabled={
                submitting ||
                !Number.isInteger(Number(matchPointThresholdDraft)) ||
                Number(matchPointThresholdDraft) < 1
              }
              onClick={() => void onConfigureMatchPoint(Number(matchPointThresholdDraft))}
            >
              Guardar umbral
            </button>
          </div>
        </section>
      ) : null}

      {matchCompletionPolicy?.action === "remove_empty_latest_match" &&
      matchCompletionPolicy.canRemoveLatestEmptyMatch ? (
        <section className="opr-panel bf-match-point-repair" aria-label="Resolver partida vacía">
          <div className="opr-eyebrow">Resolución segura</div>
          <h2>Retirar Partida {matchCompletionPolicy.latestMatchRound} vacía</h2>
          <p className="sub">{matchCompletionPolicy.reason}</p>
          <button
            type="button"
            className="opr-save"
            disabled={submitting}
            onClick={() => void onRemoveLatestEmptyMatch()}
          >
            Retirar partida vacía y reevaluar
          </button>
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
                  <KillRaceResultIntake
                    match={activeMatch}
                    leftTeam={activeMatchTeamA}
                    rightTeam={activeMatchTeamB}
                    onChanged={onKillRaceResultChanged}
                  />
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
                ) : null}
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
                {matchCompletionPolicy?.state === "match_point_not_configured" ? (
                  <span className="bf-inline-note">
                    Configura Match Point antes de crear otra partida.
                  </span>
                ) : matchCompletionPolicy?.action === "remove_empty_latest_match" ? (
                  <button
                    type="button"
                    className="opr-next is-ready"
                    disabled={submitting}
                    onClick={() => void onRemoveLatestEmptyMatch()}
                  >
                    Retirar Partida {matchCompletionPolicy.latestMatchRound} vacía
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`opr-next${canCreateNextGame ? " is-ready" : ""}`}
                    disabled={!canCreateNextGame || submitting}
                    onClick={onCreateNextGame}
                  >
                    Crear Partida {nextGameNumber} <span className="arrow">→</span>
                  </button>
                )}
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
                      {leaderTeam ? getTeamDisplayName(leaderTeam) : gameStats.leader.team_name} ·{" "}
                      <em>{gameStats.leader.total_points.toFixed(1)}</em> pts
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                {gameStats && leaderTeam && rosterText(leaderTeam) !== getTeamDisplayName(leaderTeam) ? (
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
                    <div className="opr-stat-sub">
                      por{" "}
                      {(() => {
                        const bestTeam = teams.find(
                          (team) => team.id === gameStats.bestPlacementResult?.team_id
                        );
                        return bestTeam
                          ? getTeamDisplayName(bestTeam)
                          : gameStats.bestPlacementResult.team_name;
                      })()}
                    </div>
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

          {/* ---- Fuente de reportes: una sola sección, varias entradas ---- */}
          {mode === "op" ? (
            <div className="opr-controls opr-report-sources">
              <span className="opr-chips-label">Reportes de partida · Fuente:</span>
              <div className="opr-filter">
                <button
                  type="button"
                  className={reportSource === "manual" ? "is-on" : ""}
                  onClick={() => setReportSource("manual")}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={reportSource === "import" ? "is-on" : ""}
                  onClick={() => setReportSource("import")}
                >
                  CSV/TXT
                </button>
                <button
                  type="button"
                  className={reportSource === "ocr" ? "is-on" : ""}
                  onClick={() => setReportSource("ocr")}
                >
                  OCR imagen
                </button>
              </div>
            </div>
          ) : null}

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
                  {getTeamShortDisplayName(team, 2).replace(/^TEAM\s+/i, "")}
                </button>
              ))}
            </div>
          ) : null}

          {/* ---- Entradas no manuales: drafts revisables dentro de la misma sección ---- */}
          {mode === "op" && (reportSource === "import" || reportSource === "ocr") ? (
            <OcrDraftIntake
              key={`${selectedTournament.id}:${currentGame}:${reportSource}`}
              source={reportSource}
              tournamentId={selectedTournament.id}
              tournamentName={selectedTournament.name}
              matchNumber={currentGame}
              activeMatchKey={activeMatch ? `match:${activeMatch.id}` : null}
              activeMatchId={activeMatch?.id ?? null}
              teams={teams}
              usesPlacement={usesPlacement}
              effectiveLobbySize={effectiveLobbySize}
              tournamentFinalized={isFinalized}
              officialResults={activeMatchResults}
              submitting={submitting}
              onSubmitOfficialReport={onSubmitOfficialReport}
            />
          ) : null}

          {/* ---- OPERACIÓN: grilla de reportes oficiales ---- */}
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
                    playerKills: resultDrafts[key]?.playerKills,
                  };
                  const playerRows = team.members.map((member) => ({
                    id: member.player.id,
                    name: member.player.nickname,
                  }));
                  const savedPlayerKills = new Map(
                    (savedResult?.player_stats ?? []).map((stat) => [stat.player_name, stat.kills])
                  );
                  const playerKillValues = Object.fromEntries(
                    playerRows.map((player) => [
                      player.id,
                      draft.playerKills?.[player.id] ??
                        (savedPlayerKills.has(player.name)
                          ? String(savedPlayerKills.get(player.name))
                          : ""),
                    ])
                  );
                  const playerStatsValidation = validateManualPlayerStats(
                    playerRows,
                    playerKillValues,
                    draft.kills
                  );
                  // Pre-validacion de placement: solo advertimos si el operador ya
                  // escribio un entero. Empty/default no bloquea. Ignora al propio
                  // equipo por si edita una vez y vuelve a guardar (aunque hoy
                  // los reportes son read-only tras guardar).
                  const trimmedPlacement = String(draft.placement ?? "").trim();
                  const parsedPlacement = /^\d+$/.test(trimmedPlacement)
                    ? Number(trimmedPlacement)
                    : null;
                  const placementConflictResult =
                    usesPlacement && parsedPlacement !== null
                      ? activeMatchResults.find(
                          (result) =>
                            result.team_id !== team.id &&
                            result.placement === parsedPlacement
                        ) ?? null
                      : null;
                  const placementConflictTeam = placementConflictResult
                    ? teams.find((t) => t.id === placementConflictResult.team_id) ?? null
                    : null;
                  const placementConflictLabel = placementConflictResult
                    ? placementConflictTeam
                      ? getTeamDisplayName(placementConflictTeam)
                      : placementConflictResult.team_name
                    : null;
                  const estimatedTotal =
                    savedResult?.total_points.toFixed(1) ??
                    (usesPlacement
                                      ? estimateWorldSeriesPoints(
                          draft.kills,
                          draft.placement,
                         selectedEngine?.engineKey
                        )
                      : draft.kills);
                  const isSaved = Boolean(savedResult);
                  const reportLocked = isFinalized || isSaved;
                  const hasVal = estimatedTotal != null && estimatedTotal !== "";
                  const teamLabel = getTeamDisplayName(team);
                  const teamRosterLine = rosterText(team);

                  return (
                    <article
                      key={team.id}
                      id={`opr-card-${team.id}`}
                      className={`opr-card ${isSaved ? "is-saved" : "is-pending"}${isFinalized ? " is-finalized" : ""}`}
                    >
                      <div className="opr-card-head">
                        <div>
                          <div className="opr-team-name">{teamLabel}</div>
                          {teamRosterLine !== teamLabel ? (
                            <p className="opr-team-roster">{teamRosterLine}</p>
                          ) : null}
                        </div>
                        <span className={`opr-tag ${isSaved ? "t-saved" : "t-pending"}`}>
                          <i />
                          {isFinalized
                            ? "Finalizado"
                            : isSaved
                              ? "Reporte oficial guardado"
                              : "Pendiente"}
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
                            disabled={reportLocked}
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
                              disabled={reportLocked}
                              aria-invalid={placementConflictLabel !== null}
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

                      {placementConflictLabel ? (
                        <p className="opr-placement-conflict" role="alert">
                          Placement ya reportado por {placementConflictLabel} en esta partida.
                        </p>
                      ) : null}

                      {playerRows.length > 0 ? (
                        <div className="opr-player-stats">
                          <div className="opr-player-stats-head">
                            <div>
                              <strong>Player stats</strong>
                              <span>Opcional · detalle para MVP y caster</span>
                            </div>
                            <span>No cambia el scoring</span>
                          </div>
                          <PlayerStatsPasteHelper
                            roster={playerRows}
                            disabled={reportLocked}
                            onApply={(values) =>
                              onUpdateDraft(activeMatch.id, team.id, {
                                playerKills: { ...draft.playerKills, ...values },
                              })
                            }
                          />
                          <div className="opr-player-stats-grid">
                            {playerRows.map((player) => (
                              <label key={player.id} className="opr-player-stat-row">
                                <span>{player.name}</span>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  step="1"
                                  value={playerKillValues[player.id]}
                                  placeholder="—"
                                  aria-label={`Kills de ${player.name}`}
                                  disabled={reportLocked}
                                  onChange={(event) =>
                                    onUpdateDraft(activeMatch.id, team.id, {
                                      playerKills: {
                                        ...draft.playerKills,
                                        [player.id]: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          {!playerStatsValidation.ok ? (
                            <p className="opr-player-stats-error" role="alert">
                              {playerStatsValidation.message}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="opr-card-foot">
                        <button
                          type="button"
                          className="opr-save"
                          disabled={
                            submitting ||
                            reportLocked ||
                            !playerStatsValidation.ok ||
                            placementConflictLabel !== null
                          }
                          onClick={() => onSaveTeamReport(activeMatch.id, team.id)}
                        >
                          {isFinalized
                            ? "Torneo finalizado"
                            : isSaved
                              ? "Reporte oficial guardado"
                              : "Guardar reporte"}
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
