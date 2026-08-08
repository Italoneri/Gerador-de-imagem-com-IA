import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import type { EditErrorCode } from "../errors/AppError.js";
import { err, ok, type Result } from "../result.js";

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

const allowed = new Set<string>(ALLOWED_MIME_TYPES);

const FieldsSchema = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  seed: z.coerce.number().int().optional(),
});

export interface ValidEditRequest {
  readonly image: Buffer;
  readonly mimeType: string;
  readonly prompt: string;
  readonly seed: number | undefined;
}

/**
 * Porta de entrada da rota: nada passa daqui sem ser exatamente o que diz ser.
 *
 * O MIME que o browser manda é só uma string no multipart — dá para renomear um
 * `.txt` para `.jpg` e enganar. Por isso a decisão sai dos bytes do arquivo
 * (`fileTypeFromBuffer`), não do cabeçalho.
 */
export async function validateEditRequest(
  file: { readonly buffer: Buffer } | undefined,
  fields: unknown,
): Promise<Result<ValidEditRequest, EditErrorCode>> {
  if (!file || file.buffer.byteLength === 0) {
    return err("IMAGEM_INVALIDA");
  }

  const parsedFields = FieldsSchema.safeParse(fields);
  if (!parsedFields.success) {
    return err("PROMPT_INVALIDO");
  }

  const sniffed = await fileTypeFromBuffer(file.buffer);
  if (!sniffed) return err("IMAGEM_INVALIDA");
  if (!allowed.has(sniffed.mime)) return err("TIPO_NAO_SUPORTADO");

  return ok({
    image: file.buffer,
    mimeType: sniffed.mime,
    prompt: parsedFields.data.prompt,
    seed: parsedFields.data.seed,
  });
}
