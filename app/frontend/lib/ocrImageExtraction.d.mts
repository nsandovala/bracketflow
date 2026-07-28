export type OcrExtractionPlayerStat = {
  playerName: string;
  kills: number | null;
  damage?: number | null;
  assists?: number | null;
  redeploys?: number | null;
};

export type OcrExtractionRow = {
  rawTeamName: string;
  kills: number | null;
  placement: number | null;
  playerStats?: OcrExtractionPlayerStat[];
  // 0..1. null = el proveedor no informa confianza para esta fila.
  confidence: number | null;
  // Avisos crudos del proveedor. Convencion: "uncertain_digit:kills" /
  // "uncertain_digit:placement" marcan un digito ambiguo (1 vs 7, 0 vs 8, 5
  // vs 6) que NUNCA se normaliza en silencio; solo se senala para revision.
  warnings: string[];
};

export type OcrExtractionResult = {
  source: "ocr-image";
  provider?: string;
  model?: string;
  confidence?: number | null;
  rows: OcrExtractionRow[];
  warnings: string[];
  rawText?: string | null;
};

export type OcrExtractionFailureReason = "provider_unavailable" | "unreadable_image";

export type OcrExtractionOutcome =
  | { ok: true; result: OcrExtractionResult }
  | { ok: false; reason: OcrExtractionFailureReason; message: string };

export type OcrExtractionProvider = (file: File) => Promise<OcrExtractionOutcome>;

export const OCR_IMAGE_ACCEPTED_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
export const OCR_IMAGE_MAX_BYTES: number;

export type OcrImageFileValidation =
  | { ok: true }
  | { ok: false; reason: "unsupported_file" | "file_too_large"; message: string };

export function validateOcrImageFile(file: File): OcrImageFileValidation;

export const unavailableOcrProvider: OcrExtractionProvider;

export type OcrProviderStatus = {
  provider: string;
  model: string;
  configured: boolean;
  remote_verified: false;
};

export function getBackendOcrProviderStatus(
  fetchImpl?: typeof fetch
): Promise<OcrProviderStatus>;

export function createBackendOcrProvider(params: {
  tournamentId: number;
  matchId: number | null;
  fetchImpl?: typeof fetch;
}): OcrExtractionProvider;
