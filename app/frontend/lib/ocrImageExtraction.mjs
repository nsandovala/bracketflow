// Limite de la extraccion OCR: convierte pixeles en filas candidatas crudas.
// No conoce equipos de torneo, drafts ni reportes oficiales — eso vive en
// ocrImageDraftReview.mjs. Cualquier motor real (tesseract.js, un endpoint de
// backend, etc.) solo necesita implementar la firma de OcrExtractionProvider
// (ver ocrImageExtraction.d.mts). Modulo plano (.mjs) a proposito: se
// ejecuta directo con `node --test`, sin paso de build (mismo patron que
// lib/playerBroadcastProfile.mjs).

export const OCR_IMAGE_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const OCR_IMAGE_ACCEPTED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
// Limite inicial conservador para screenshots de scoreboard: suficiente para
// una captura de pantalla completa sin permitir subidas de video/RAW.
export const OCR_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export function validateOcrImageFile(file) {
  const typeOk =
    OCR_IMAGE_ACCEPTED_TYPES.includes(file.type) || OCR_IMAGE_ACCEPTED_EXTENSIONS.test(file.name);
  if (!typeOk) {
    return {
      ok: false,
      reason: "unsupported_file",
      message: "Formato no compatible. Usa PNG, JPG/JPEG o WEBP.",
    };
  }
  if (file.size === 0) {
    return {
      ok: false,
      reason: "unsupported_file",
      message: "El archivo está vacío o no se pudo leer.",
    };
  }
  if (file.size > OCR_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      reason: "file_too_large",
      message: `La imagen supera el máximo permitido (${Math.round(
        OCR_IMAGE_MAX_BYTES / (1024 * 1024)
      )} MB).`,
    };
  }
  return { ok: true };
}

// Proveedor por defecto: este build no trae un motor OCR real todavia. Esto
// es una limitacion tecnica honesta (ver reporte del sprint / PARKING_LOT),
// no un placeholder que finge exito. Reemplazar esta funcion por un motor
// real (tesseract.js, un endpoint de backend, etc.) no requiere tocar la UI
// de revision ni el pipeline de drafts: ambos solo dependen de la forma
// OcrExtractionProvider / OcrExtractionOutcome.
export const unavailableOcrProvider = async () => ({
  ok: false,
  reason: "provider_unavailable",
  message:
    "El motor de OCR todavía no está disponible en este build. Usa Manual o CSV/TXT mientras tanto.",
});

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return typeof payload.detail === "string" ? payload.detail : "No se pudo procesar la imagen.";
  } catch {
    return "No se pudo procesar la imagen.";
  }
}

export async function getBackendOcrProviderStatus(fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${getApiBaseUrl()}/ocr/provider`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        provider: "unavailable",
        model: "none",
        configured: false,
        remote_verified: false,
      };
    }
    return response.json();
  } catch {
    return {
      provider: "unavailable",
      model: "none",
      configured: false,
      remote_verified: false,
    };
  }
}

export function createBackendOcrProvider({
  tournamentId,
  matchId,
  fetchImpl = fetch,
}) {
  return async (file) => {
    if (!matchId) {
      return unavailableOcrProvider(file);
    }
    try {
      const endpoint =
        `${getApiBaseUrl()}/tournaments/${tournamentId}/matches/${matchId}` +
        `/ocr/extract?filename=${encodeURIComponent(file.name)}`;
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        return {
          ok: false,
          reason: response.status === 503 ? "provider_unavailable" : "unreadable_image",
          message: await readErrorMessage(response),
        };
      }
      const payload = await response.json();
      return {
        ok: true,
        result: {
          source: "ocr-image",
          provider: payload.provider,
          model: payload.model,
          confidence: payload.confidence,
          warnings: payload.warnings ?? [],
          rawText: payload.raw_text ?? null,
          rows: (payload.rows ?? []).map((row) => ({
            rawTeamName: row.raw_team_name ?? "",
            kills: row.kills ?? null,
            placement: row.placement ?? null,
            playerStats: row.player_stats?.map((stat) => ({
              playerName: stat.player_name,
              kills: stat.kills ?? null,
              damage: stat.damage ?? null,
              assists: stat.assists ?? null,
              redeploys: stat.redeploys ?? null,
            })),
            confidence: row.confidence ?? null,
            warnings: row.warnings ?? [],
          })),
        },
      };
    } catch {
      return {
        ok: false,
        reason: "unreadable_image",
        message: "No se pudo conectar con el proveedor OCR. Intenta nuevamente.",
      };
    }
  };
}
