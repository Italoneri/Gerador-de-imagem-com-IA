import { z } from "zod";
import { env } from "../config/env.js";
import { AppError, codeFromUpstreamStatus } from "../errors/AppError.js";
import { fetchWithTimeout } from "../http/fetchWithTimeout.js";
import type {
  EditImageRequest,
  EditImageResult,
  ImageEditProvider,
} from "./types.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

const ImagePart = z.object({
  type: z.literal("image"),
  data: z.string().min(1),
  mime_type: z.string().optional(),
});

const GeminiResponse = z.object({
  steps: z
    .array(z.object({ content: z.array(z.unknown()).optional() }))
    .optional(),
});

/**
 * Gemini ("Nano Banana") é síncrono: manda texto + imagem e o resultado já vem
 * no corpo em base64. Nada de polling, ao contrário da BFL.
 */
export function createGeminiProvider(): ImageEditProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError("CONFIG_INVALIDA", "GEMINI_API_KEY ausente");
  }

  return {
    id: "gemini",
    async editImage(request: EditImageRequest): Promise<EditImageResult> {
      const response = await fetchWithTimeout(
        GEMINI_URL,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: env.GEMINI_MODEL,
            input: [
              { type: "text", text: request.prompt },
              {
                type: "image",
                mime_type: request.mimeType,
                data: request.image.toString("base64"),
              },
            ],
          }),
        },
        { timeoutMs: env.REQUEST_TIMEOUT_MS, signal: request.signal },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          codeFromUpstreamStatus(response.status, detail),
          `Gemini HTTP ${response.status}: ${detail.slice(0, 200)}`,
        );
      }

      const parsed = GeminiResponse.safeParse(await response.json());
      if (!parsed.success) {
        throw new AppError("RESPOSTA_INVALIDA", "resposta fora do schema");
      }

      const imagePart = (parsed.data.steps ?? [])
        .flatMap((step) => step.content ?? [])
        .map((part) => ImagePart.safeParse(part))
        .find((result) => result.success)?.data;

      if (!imagePart) {
        // Sem imagem na resposta normalmente é filtro de conteúdo: o modelo
        // devolve só texto explicando por que recusou.
        throw new AppError("CONTEUDO_BLOQUEADO", "resposta sem parte de imagem");
      }

      return {
        image: Buffer.from(imagePart.data, "base64"),
        mimeType: imagePart.mime_type ?? "image/png",
      };
    },
  };
}
