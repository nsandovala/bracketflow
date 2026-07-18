export type OcrDraftSource = "MANUAL" | "PRINT" | "OCR_DRAFT" | "CSV_IMPORT";
export type OcrDraftStatus = "pending" | "confirmed" | "disputed" | "submitted";

export type OcrDraftReport = {
  id: string;
  tournamentId: number;
  matchNumber: number;
  activeMatchKey: string | null;
  teamId: number;
  teamName: string;
  kills: number;
  placement: number | "";
  source: OcrDraftSource;
  note: string;
  status: OcrDraftStatus;
  createdAt: string;
  updatedAt: string;
};

const OCR_DRAFT_SOURCES: OcrDraftSource[] = [
  "MANUAL",
  "PRINT",
  "OCR_DRAFT",
  "CSV_IMPORT",
];
const OCR_DRAFT_STATUSES: OcrDraftStatus[] = [
  "pending",
  "confirmed",
  "disputed",
  "submitted",
];

export function getOcrDraftStorageKey(tournamentId: number, matchNumber: number) {
  return `bracketflow:operator:ocr-draft-intake:v0.1:tournament:${tournamentId}:match:${matchNumber}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isOcrDraftReport(
  value: unknown,
  tournamentId: number,
  matchNumber: number
): value is OcrDraftReport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.tournamentId === tournamentId &&
    value.matchNumber === matchNumber &&
    (value.activeMatchKey === null || typeof value.activeMatchKey === "string") &&
    typeof value.teamId === "number" &&
    Number.isFinite(value.teamId) &&
    typeof value.teamName === "string" &&
    value.teamName.length > 0 &&
    typeof value.kills === "number" &&
    Number.isInteger(value.kills) &&
    value.kills >= 0 &&
    (value.placement === "" ||
      (typeof value.placement === "number" &&
        Number.isInteger(value.placement) &&
        value.placement >= 1)) &&
    typeof value.source === "string" &&
    OCR_DRAFT_SOURCES.includes(value.source as OcrDraftSource) &&
    typeof value.note === "string" &&
    typeof value.status === "string" &&
    OCR_DRAFT_STATUSES.includes(value.status as OcrDraftStatus) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

export function parseOcrDraftReports(
  raw: string,
  tournamentId: number,
  matchNumber: number
): OcrDraftReport[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((draft) => isOcrDraftReport(draft, tournamentId, matchNumber));
  } catch {
    return [];
  }
}
