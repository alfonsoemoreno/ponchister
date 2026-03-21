import { extractYoutubeId } from "../lib/autoGameQueue";
import type {
  YoutubeValidationResult,
  YoutubeValidationStatus,
} from "./types";

function buildResult(
  status: YoutubeValidationStatus,
  message: string,
  options?: {
    code?: number | null;
    videoId?: string | null;
  }
): YoutubeValidationResult {
  return {
    status,
    message,
    code: options?.code ?? null,
    videoId: options?.videoId ?? null,
  };
}

export function validateYoutubeUrlFormat(url: string): YoutubeValidationResult {
  const videoId = extractYoutubeId(url.trim());

  if (!videoId) {
    return buildResult(
      "invalid",
      "El enlace de YouTube no es válido. Verifica que el video tenga un identificador correcto."
    );
  }

  return buildResult("checking", "Validando enlace de YouTube...", {
    videoId,
  });
}

export function createUncheckedYoutubeValidation(): YoutubeValidationResult {
  return buildResult(
    "unchecked",
    "El enlace todavía no ha sido validado manualmente."
  );
}

export function createOperationalYoutubeValidation(
  videoId: string | null
): YoutubeValidationResult {
  return buildResult(
    "operational",
    "El enlace de YouTube está operativo y puede reproducirse en la aplicación.",
    { videoId }
  );
}

export function interpretYoutubePlayerError(
  code: number | null,
  videoId: string | null
): YoutubeValidationResult {
  if (code === 101 || code === 150) {
    return buildResult(
      "restricted",
      "No es posible usar este enlace porque YouTube restringe la reproducción de este video fuera de su plataforma.",
      { code, videoId }
    );
  }

  if (code === 100) {
    return buildResult(
      "unavailable",
      "El video no está disponible en YouTube o fue retirado.",
      { code, videoId }
    );
  }

  if (code === 2) {
    return buildResult(
      "invalid",
      "El enlace de YouTube no es válido para reproducirse.",
      { code, videoId }
    );
  }

  return buildResult(
    "unavailable",
    "No se pudo validar la reproducción de este video en YouTube.",
    { code, videoId }
  );
}

export function getYoutubeStatusLabel(status: YoutubeValidationStatus): string {
  switch (status) {
    case "unchecked":
      return "Sin validar";
    case "checking":
      return "Validando";
    case "operational":
      return "Operativo";
    case "restricted":
      return "Restringido";
    case "unavailable":
      return "No disponible";
    case "invalid":
      return "Inválido";
    default:
      return "Desconocido";
  }
}
