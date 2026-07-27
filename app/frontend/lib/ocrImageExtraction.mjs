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
