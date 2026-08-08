import { z } from "zod";
import { env } from "../config/env.js";
import {
  AppError,
  codeFromUpstreamStatus,
  type EditErrorCode,
} from "../errors/AppError.js";
import { delay, fetchWithTimeout } from "../http/fetchWithTimeout.js";
import type {
  EditImageRequest,
  EditImageResult,
  ImageEditProvider,
} from "./types.js";

const BFL_BASE_URL = "https://api.bfl.ai/v1";
const POLL_INTERVAL_MS = 1_500;
const CALL_TIMEOUT_MS = 30_000;

const SubmitResponse = z.object({
  id: z.string().min(1),
  polling_url: z.string().url(),
});

const PollResponse = z.object({
  status: z.string().min(1),
  result: z
    .object({ sample: z.string().url().optional() })
    .nullish(),
});

/**
 * Status terminais que não são sucesso. Qualquer outro valor (`Pending`,
 * `Queued`, `Request Accepted`…) conta como "ainda processando" — assim um
 * status novo inventado pela BFL vira espera, não crash.
 */
const TERMINAL_FAILURES: Readonly<Record<string, EditErrorCode>> = {
  "Request Moderated": "CONTEUDO_BLOQUEADO",
  "Content Moderated": "CONTEUDO_BLOQUEADO",
  "Task not found": "PROVEDOR_FORA",
  Error: "PROVEDOR_FORA",
  Failed: "PROVEDOR_FORA",
};

/**
 * A família Kontext recebe uma imagem em `input_image`; a FLUX.2 recebe uma
 * lista em `input_images`. Só isso muda entre elas no corpo da requisição.
 */
function imageFieldFor(model: string): "input_image" | "input_images" {
  return model.startsWith("flux-2") ? "input_images" : "input_image";
}

export function createBflProvider(): ImageEditProvider {
  const apiKey = env.BFL_API_KEY;
  if (!apiKey) {
    throw new AppError("CONFIG_INVALIDA", "BFL_API_KEY ausente");
  }
  const headers = {
    "x-key": apiKey,
    "content-type": "application/json",
    accept: "application/json",
  };
  const maxPollAttempts = Math.ceil(env.REQUEST_TIMEOUT_MS / POLL_INTERVAL_MS);

  async function submit(request: EditImageRequest): Promise<string> {
    const base64 = request.image.toString("base64");
    const field = imageFieldFor(env.BFL_MODEL);

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      // O botão do chat diz "Baixar PNG", então pedimos PNG de verdade.
      output_format: "png",
      [field]: field === "input_images" ? [base64] : base64,
    };
    if (request.seed !== undefined) body["seed"] = request.seed;

    const response = await fetchWithTimeout(
      `${BFL_BASE_URL}/${env.BFL_MODEL}`,
      { method: "POST", headers, body: JSON.stringify(body) },
      { timeoutMs: CALL_TIMEOUT_MS, signal: request.signal },
    );

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new AppError(
        codeFromUpstreamStatus(response.status, detail),
        `BFL submit HTTP ${response.status}: ${detail}`,
      );
    }

    const parsed = SubmitResponse.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new AppError("RESPOSTA_INVALIDA", "submit sem id/polling_url");
    }
    return parsed.data.polling_url;
  }

  /** Espera a tarefa ficar `Ready` e devolve a URL assinada do resultado. */
  async function pollUntilReady(
    pollingUrl: string,
    signal: AbortSignal,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
      const response = await fetchWithTimeout(
        pollingUrl,
        { method: "GET", headers },
        { timeoutMs: CALL_TIMEOUT_MS, signal },
      );

      if (!response.ok) {
        const detail = await readErrorDetail(response);
        throw new AppError(
          codeFromUpstreamStatus(response.status, detail),
          `BFL poll HTTP ${response.status}: ${detail}`,
        );
      }

      const parsed = PollResponse.safeParse(await readJson(response));
      if (!parsed.success) {
        throw new AppError("RESPOSTA_INVALIDA", "poll fora do schema");
      }

      const { status, result } = parsed.data;
      const failure = TERMINAL_FAILURES[status];
      if (failure) throw new AppError(failure, `BFL status "${status}"`);

      if (status === "Ready") {
        const sample = result?.sample;
        if (!sample) {
          throw new AppError("RESPOSTA_INVALIDA", "Ready sem result.sample");
        }
        return sample;
      }

      await delay(POLL_INTERVAL_MS, signal);
    }

    throw new AppError("TIMEOUT", `sem resposta após ${maxPollAttempts} polls`);
  }

  return {
    id: "bfl",
    async editImage(request: EditImageRequest): Promise<EditImageResult> {
      const pollingUrl = await submit(request);
      const sampleUrl = await pollUntilReady(pollingUrl, request.signal);

      // A URL assinada da BFL expira em 10 minutos. Baixando aqui, o browser
      // recebe os bytes e nunca fica com um link que morre no meio do caminho.
      const download = await fetchWithTimeout(
        sampleUrl,
        { method: "GET" },
        { timeoutMs: CALL_TIMEOUT_MS, signal: request.signal },
      );
      if (!download.ok) {
        throw new AppError(
          codeFromUpstreamStatus(download.status),
          `BFL download HTTP ${download.status}`,
        );
      }

      const image = Buffer.from(await download.arrayBuffer());
      if (image.byteLength === 0) {
        throw new AppError("RESPOSTA_INVALIDA", "resultado vazio");
      }

      return {
        image,
        mimeType: download.headers.get("content-type") ?? "image/png",
      };
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new AppError("RESPOSTA_INVALIDA", "corpo não era JSON");
  }
}

/**
 * Texto do erro do provedor, usado só para classificar e para o log — nunca
 * chega ao browser. A BFL manda `{"detail":"..."}`.
 */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.text();
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
      return String((parsed as { detail: unknown }).detail);
    }
    return body.slice(0, 200);
  } catch {
    return "";
  }
}
