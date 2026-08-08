import { AppError } from "../errors/AppError.js";

interface TimedFetchOptions {
  readonly timeoutMs: number;
  /** Cancelamento vindo de cima (cliente desistiu, requisição estourou o total). */
  readonly signal?: AbortSignal;
}

/**
 * `fetch` com prazo obrigatório. Nenhuma chamada externa neste projeto usa o
 * default da lib — todas passam por aqui e morrem em `timeoutMs`.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  { timeoutMs, signal }: TimedFetchOptions,
): Promise<Response> {
  const deadline = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([deadline, signal]) : deadline;

  try {
    return await fetch(url, { ...init, signal: combined });
  } catch (cause) {
    throw toAppError(cause);
  }
}

function toAppError(cause: unknown): AppError {
  if (cause instanceof AppError) return cause;

  const name = cause instanceof Error ? cause.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new AppError("TIMEOUT", "prazo da chamada externa estourou");
  }
  // fetch só rejeita com TypeError quando a conexão em si falhou (DNS, TLS,
  // rede fora). Status HTTP de erro chega como Response normal.
  return new AppError(
    "SEM_REDE",
    cause instanceof Error ? cause.message : String(cause),
  );
}

/** Pausa cancelável — usada entre tentativas de polling. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AppError("TIMEOUT", "cancelado antes do polling"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new AppError("TIMEOUT", "cancelado durante o polling"));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
