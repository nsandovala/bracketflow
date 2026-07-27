import type { OcrExtractionRow } from "./ocrImageExtraction.d.mts";
import type { OcrDraftPlayerStat, OcrDraftReport } from "./ocrDraftIntake";
import type { TeamResolutionIndex, TeamResolutionTeam } from "./teamResolution.d.mts";

export type OcrReviewStatus =
  | "valida"
  | "equipo_no_reconocido"
  | "equipo_ambiguo"
  | "datos_incompletos"
  | "conflicto"
  | "reporte_oficial_existente"
  | "draft_duplicado"
  | "baja_confianza";

export const OCR_REVIEW_STATUS_LABELS: Record<OcrReviewStatus, string>;
export const OCR_REVIEW_CREATABLE_STATUSES: Set<OcrReviewStatus>;

export type OcrReviewTeam = TeamResolutionTeam;

export type OcrReviewPlayerRow = {
  playerName: string;
  killsInput: string;
  damage: number | null;
  assists: number | null;
  redeploys: number | null;
};

export type OcrCandidateRow = {
  key: string;
  rawTeamName: string;
  teamOverrideId: number | null;
  killsInput: string;
  placementInput: string;
  playerStats: OcrReviewPlayerRow[] | null;
  confidence: number | null;
  extractionWarnings: string[];
  included: boolean;
  edited: {
    team: boolean;
    kills: boolean;
    placement: boolean;
    players: boolean;
  };
};

export type OcrReviewEvaluation = {
  status: OcrReviewStatus;
  teamId: number | null;
  teamName: string;
  ambiguousCandidates: Array<{ id: number; name: string }>;
  kills: number | null;
  placement: number | "" | null;
  playerStats: Array<{ playerName: string; kills: number }> | null;
  warnings: string[];
};

export type OcrReviewContext<T extends OcrReviewTeam = OcrReviewTeam> = {
  teams: T[];
  usesPlacement: boolean;
  effectiveLobbySize: number;
  officialResults: Array<{ team_id: number; kills: number; placement: number }>;
  existingDraftTeamIds: Set<number>;
  lowConfidenceThreshold: number;
};

export type OcrReviewedRow<T extends OcrReviewTeam = OcrReviewTeam> = {
  candidate: OcrCandidateRow;
  evaluation: OcrReviewEvaluation;
  team: T | null;
};

export function createOcrCandidateKey(): string;

export function createOcrCandidateRow(row: OcrExtractionRow): OcrCandidateRow;

export function evaluateOcrCandidate<T extends OcrReviewTeam>(
  candidate: OcrCandidateRow,
  context: OcrReviewContext<T>,
  resolutionIndex: TeamResolutionIndex<T>,
  teamIdsAlreadyValidInBatch: Set<number>
): OcrReviewEvaluation;

export function evaluateOcrBatch<T extends OcrReviewTeam>(
  candidates: OcrCandidateRow[],
  context: OcrReviewContext<T>
): OcrReviewedRow<T>[];

export function getOcrLowConfidenceThreshold(): number;

export function buildOcrDraftReports<T extends OcrReviewTeam>(
  rows: OcrReviewedRow<T>[],
  params: {
    tournamentId: number;
    matchNumber: number;
    activeMatchKey: string;
    imageFileName: string | null;
  }
): OcrDraftReport[];

export type { OcrDraftPlayerStat, OcrDraftReport };
