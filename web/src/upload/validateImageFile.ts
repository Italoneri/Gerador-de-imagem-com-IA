import { MAX_UPLOAD_MB, type EditErrorCode } from "../errors/editErrors.js";
import { err, ok, type Result } from "../result.js";

export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Teto da BFL. Acima disso o provedor recusa antes mesmo de gerar. */
export const MAX_MEGAPIXELS = 20;

export const MAX_UPLOAD_BYTES = Math.round(MAX_UPLOAD_MB * 1024 * 1024);

const accepted = new Set<string>(ACCEPTED_MIME_TYPES);

export interface ValidatedImage {
  readonly blob: Blob;
  readonly name: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** Decodifica de verdade — é o único jeito de saber se o arquivo abre. */
export type ImageDecoder = (blob: Blob) => Promise<ImageDimensions>;

const decodeWithBrowser: ImageDecoder = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
};

interface ValidateOptions {
  readonly maxBytes?: number;
  readonly maxMegapixels?: number;
  /** Injetável para teste: em jsdom não existe createImageBitmap. */
  readonly decode?: ImageDecoder;
}

/**
 * Primeira barreira, no browser. O servidor refaz a checagem pelos bytes —
 * essa aqui existe para o usuário saber do problema na hora, sem gastar upload.
 */
export async function validateImageFile(
  file: File,
  options: ValidateOptions = {},
): Promise<Result<ValidatedImage, EditErrorCode>> {
  const {
    maxBytes = MAX_UPLOAD_BYTES,
    maxMegapixels = MAX_MEGAPIXELS,
    decode = decodeWithBrowser,
  } = options;

  if (!accepted.has(file.type)) return err("TIPO_NAO_SUPORTADO");
  if (file.size === 0) return err("IMAGEM_INVALIDA");
  if (file.size > maxBytes) return err("ARQUIVO_GRANDE");

  let dimensions: ImageDimensions;
  try {
    dimensions = await decode(file);
  } catch {
    return err("IMAGEM_INVALIDA");
  }

  if (dimensions.width < 1 || dimensions.height < 1) {
    return err("IMAGEM_INVALIDA");
  }
  if (dimensions.width * dimensions.height > maxMegapixels * 1_000_000) {
    return err("ARQUIVO_GRANDE");
  }

  return ok({
    blob: file,
    name: file.name,
    mimeType: file.type,
    width: dimensions.width,
    height: dimensions.height,
  });
}
