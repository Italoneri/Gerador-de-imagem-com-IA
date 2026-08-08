import { toEditErrorCode, type EditErrorCode } from "../errors/editErrors.js";
import { err, ok, type Result } from "../result.js";

/** Um pouco acima do teto do servidor, para o erro dele chegar antes do nosso. */
const CLIENT_TIMEOUT_MS = 130_000;

export interface EditImageInput {
  readonly image: Blob;
  readonly fileName: string;
  readonly prompt: string;
  readonly seed?: number;
  /** Cancelamento do usuário (trocou de conversa, fechou a aba). */
  readonly signal?: AbortSignal;
}

export interface EditedImage {
  readonly blob: Blob;
  readonly mimeType: string;
}

/**
 * Única porta de saída do front. Fala com o nosso proxy, nunca com o provedor —
 * é isso que mantém a chave fora do bundle.
 */
export async function editImage(
  input: EditImageInput,
): Promise<Result<EditedImage, EditErrorCode>> {
  const body = new FormData();
  body.append("image", input.image, input.fileName);
  body.append("prompt", input.prompt);
  if (input.seed !== undefined) body.append("seed", String(input.seed));

  const deadline = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const signal = input.signal
    ? AbortSignal.any([deadline, input.signal])
    : deadline;

  let response: Response;
  try {
    response = await fetch("/api/edit", { method: "POST", body, signal });
  } catch (cause) {
    return err(abortReason(cause, input.signal));
  }

  if (!response.ok) {
    return err(await codeFromResponse(response));
  }

  const blob = await response.blob();
  if (blob.size === 0) return err("RESPOSTA_INVALIDA");

  return ok({ blob, mimeType: blob.type || "image/png" });
}

function abortReason(cause: unknown, userSignal?: AbortSignal): EditErrorCode {
  if (userSignal?.aborted) return "CANCELADO";
  const name = cause instanceof Error ? cause.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "TIMEOUT";
  return "SEM_REDE";
}

async function codeFromResponse(response: Response): Promise<EditErrorCode> {
  try {
    const payload: unknown = await response.json();
    const code =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as { error?: { code?: unknown } }).error?.code
        : undefined;
    return toEditErrorCode(code);
  } catch {
    // Servidor caiu no meio ou devolveu HTML de proxy: o status ainda informa.
    return response.status === 429 ? "LIMITE_EXCEDIDO" : "PROVEDOR_FORA";
  }
}
