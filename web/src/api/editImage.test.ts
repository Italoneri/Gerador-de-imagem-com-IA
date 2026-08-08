import { afterEach, describe, expect, it, vi } from "vitest";
import { editImage } from "./editImage.js";

const input = () => ({
  image: new Blob(["png"], { type: "image/png" }),
  fileName: "foto.png",
  prompt: "troca o fundo",
});

// O Response do jsdom não aceita Blob como corpo — ele faz String(blob) e o
// corpo vira "[object Blob]". Por isso os corpos aqui são texto ou null.
const imageResponse = () =>
  new Response("bytes-da-imagem", {
    status: 200,
    headers: { "content-type": "image/png" },
  });

function resolvesWith(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Separado de `resolvesWith` porque DOMException não é `instanceof Error` no jsdom. */
function rejectsWith(cause: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(cause);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const errorResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? "<html>proxy</html>" : JSON.stringify(body), {
    status,
    headers: {
      "content-type": body === undefined ? "text/html" : "application/json",
    },
  });

async function errorOf(promise: ReturnType<typeof editImage>): Promise<string> {
  const result = await promise;
  return result.ok ? "SEM_ERRO" : result.error;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editImage", () => {
  it("devolve o blob quando o servidor responde a imagem", async () => {
    resolvesWith(imageResponse());

    const result = await editImage(input());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("image/png");
      expect(result.value.blob.size).toBeGreaterThan(0);
    }
  });

  it("envia multipart com imagem e prompt para /api/edit", async () => {
    const fetchMock = resolvesWith(imageResponse());

    await editImage(input());

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/edit");
    expect(init?.method).toBe("POST");
    const body = init?.body as FormData;
    expect(body.get("prompt")).toBe("troca o fundo");
    expect(body.get("image")).toBeInstanceOf(Blob);
    expect(body.get("seed")).toBeNull();
  });

  it("inclui a semente só quando pedida", async () => {
    const fetchMock = resolvesWith(imageResponse());

    await editImage({ ...input(), seed: 7 });

    expect((fetchMock.mock.calls[0]![1]?.body as FormData).get("seed")).toBe("7");
  });

  it("repassa o código que o servidor mandou", async () => {
    resolvesWith(errorResponse(422, { error: { code: "CONTEUDO_BLOQUEADO" } }));

    expect(await errorOf(editImage(input()))).toBe("CONTEUDO_BLOQUEADO");
  });

  it("normaliza código desconhecido para RESPOSTA_INVALIDA", async () => {
    resolvesWith(errorResponse(500, { error: { code: "ALGO_NOVO" } }));

    expect(await errorOf(editImage(input()))).toBe("RESPOSTA_INVALIDA");
  });

  const withoutJson = [
    { caso: "429 sem corpo JSON", status: 429, expected: "LIMITE_EXCEDIDO" },
    { caso: "502 sem corpo JSON", status: 502, expected: "PROVEDOR_FORA" },
  ] as const;

  it.each(withoutJson)("cai no status em $caso", async ({ status, expected }) => {
    resolvesWith(errorResponse(status));

    expect(await errorOf(editImage(input()))).toBe(expected);
  });

  it("trata corpo vazio como resposta inválida", async () => {
    resolvesWith(new Response(null, { status: 200 }));

    expect(await errorOf(editImage(input()))).toBe("RESPOSTA_INVALIDA");
  });

  it("classifica queda de conexão como SEM_REDE", async () => {
    rejectsWith(new TypeError("Failed to fetch"));

    expect(await errorOf(editImage(input()))).toBe("SEM_REDE");
  });

  it("distingue cancelamento do usuário de timeout", async () => {
    rejectsWith(new DOMException("aborted", "AbortError"));
    const controller = new AbortController();
    controller.abort();

    expect(await errorOf(editImage({ ...input(), signal: controller.signal }))).toBe(
      "CANCELADO",
    );
  });

  it("classifica abort sem pedido do usuário como TIMEOUT", async () => {
    rejectsWith(new DOMException("timed out", "TimeoutError"));

    expect(await errorOf(editImage(input()))).toBe("TIMEOUT");
  });
});
