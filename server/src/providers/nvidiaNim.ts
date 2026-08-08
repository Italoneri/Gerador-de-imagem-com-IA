import { z } from "zod";
import { env } from "../config/env.js";
import { AppError, codeFromUpstreamStatus } from "../errors/AppError.js";
import { fetchWithTimeout } from "../http/fetchWithTimeout.js";
import type {
  EditImageRequest,
  EditImageResult,
  ImageEditProvider,
} from "./types.js";

const NimResponse = z.object({
  artifacts: z
    .array(
      z.object({
        base64: z.string().min(1),
        finishReason: z.string().optional(),
      }),
    )
    .min(1),
});

/**
 * NVIDIA NIM hospeda o FLUX.1 Kontext [dev] com o contrato padrão de imagem da
 * NVIDIA: bearer token, imagem de entrada como data URI e resultado em
 * `artifacts[0].base64`.
 *
 * Endpoint e modelo saem do .env porque a NVIDIA move os caminhos de catálogo
 * com alguma frequência — confira o seu em build.nvidia.com antes de ligar.
 */
export function createNimProvider(): ImageEditProvider {
  const apiKey = env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new AppError("CONFIG_INVALIDA", "NVIDIA_NIM_API_KEY ausente");
  }

  return {
    id: "nim",
    async editImage(request: EditImageRequest): Promise<EditImageResult> {
      const dataUri = `data:${request.mimeType};base64,${request.image.toString("base64")}`;

      const body: Record<string, unknown> = {
        prompt: request.prompt,
        image: dataUri,
        cfg_scale: 5,
        steps: 50,
      };
      if (request.seed !== undefined) body["seed"] = request.seed;

      const response = await fetchWithTimeout(
        `${env.NVIDIA_NIM_BASE_URL}/${env.NVIDIA_NIM_MODEL}`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(body),
        },
        { timeoutMs: env.REQUEST_TIMEOUT_MS, signal: request.signal },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new AppError(
          codeFromUpstreamStatus(response.status, detail),
          `NIM HTTP ${response.status}: ${detail.slice(0, 200)}`,
        );
      }

      const parsed = NimResponse.safeParse(await response.json());
      if (!parsed.success) {
        throw new AppError("RESPOSTA_INVALIDA", "resposta sem artifacts");
      }

      const artifact = parsed.data.artifacts[0]!;
      if (artifact.finishReason === "CONTENT_FILTERED") {
        throw new AppError("CONTEUDO_BLOQUEADO", "NIM filtrou o conteúdo");
      }

      return {
        image: Buffer.from(artifact.base64, "base64"),
        // A NIM devolve JPEG nesse endpoint.
        mimeType: "image/jpeg",
      };
    },
  };
}
