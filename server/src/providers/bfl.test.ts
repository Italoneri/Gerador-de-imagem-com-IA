import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.js";
import { createBflProvider } from "./bfl.js";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const imageResponse = () =>
  new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
    status: 200,
    headers: { "content-type": "image/png" },
  });

const SUBMITTED = { id: "abc", polling_url: "https://api.bfl.ai/v1/get_result?id=abc" };
const READY = { status: "Ready", result: { sample: "https://cdn.bfl.ai/abc.png" } };

function request() {
  return {
    image: Buffer.from("foto"),
    mimeType: "image/png",
    prompt: "troca o fundo",
    seed: undefined,
    signal: new AbortController().signal,
  };
}

/** Encadeia respostas na ordem em que o adaptador as pede. */
function mockFetchSequence(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "SEM_ERRO";
  } catch (cause) {
    return cause instanceof AppError ? cause.code : `INESPERADO:${String(cause)}`;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createBflProvider", () => {
  it("devolve os bytes da imagem quando a tarefa fica pronta no primeiro poll", async () => {
    mockFetchSequence(jsonResponse(SUBMITTED), jsonResponse(READY), imageResponse());

    const result = await createBflProvider().editImage(request());

    expect(result.mimeType).toBe("image/png");
    expect(result.image.subarray(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it("continua no polling enquanto o status for Pending", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(SUBMITTED),
      jsonResponse({ status: "Pending" }),
      jsonResponse(READY),
      imageResponse(),
    );

    await createBflProvider().editImage(request());

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("baixa o resultado no servidor em vez de devolver a URL assinada", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(SUBMITTED),
      jsonResponse(READY),
      imageResponse(),
    );

    await createBflProvider().editImage(request());

    expect(fetchMock.mock.calls[2]?.[0]).toBe(READY.result.sample);
  });

  it("manda o prompt e a imagem em base64 no campo input_image", async () => {
    const fetchMock = mockFetchSequence(
      jsonResponse(SUBMITTED),
      jsonResponse(READY),
      imageResponse(),
    );

    await createBflProvider().editImage(request());

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.prompt).toBe("troca o fundo");
    expect(body.input_image).toBe(Buffer.from("foto").toString("base64"));
    expect(body.output_format).toBe("png");
  });

  const upstreamFailures = [
    { caso: "402", status: 402, body: {}, expected: "SEM_CREDITO" },
    { caso: "429", status: 429, body: {}, expected: "LIMITE_EXCEDIDO" },
    { caso: "401", status: 401, body: {}, expected: "CONFIG_INVALIDA" },
    { caso: "403", status: 403, body: { detail: "Not authenticated" }, expected: "CONFIG_INVALIDA" },
    { caso: "500", status: 500, body: {}, expected: "PROVEDOR_FORA" },
    // A BFL responde 422 para toda falha de validação, não só moderação.
    {
      caso: "422 de chave malformada",
      status: 422,
      body: { detail: "Invalid API key format" },
      expected: "CONFIG_INVALIDA",
    },
    {
      caso: "422 de moderação",
      status: 422,
      body: { detail: "Request blocked by content policy" },
      expected: "CONTEUDO_BLOQUEADO",
    },
    {
      caso: "422 de parâmetro inválido",
      status: 422,
      body: { detail: "aspect_ratio out of range" },
      expected: "RESPOSTA_INVALIDA",
    },
  ] as const;

  it.each(upstreamFailures)(
    "traduz $caso do submit em $expected",
    async ({ status, body, expected }) => {
      mockFetchSequence(jsonResponse(body, status));

      expect(await codeOf(createBflProvider().editImage(request()))).toBe(expected);
    },
  );

  const moderationStatuses = ["Content Moderated", "Request Moderated"] as const;

  it.each(moderationStatuses)("trata o status %s como conteúdo bloqueado", async (status) => {
    mockFetchSequence(jsonResponse(SUBMITTED), jsonResponse({ status }));

    expect(await codeOf(createBflProvider().editImage(request()))).toBe(
      "CONTEUDO_BLOQUEADO",
    );
  });

  it("reporta resposta inválida quando o submit não traz polling_url", async () => {
    mockFetchSequence(jsonResponse({ id: "abc" }));

    expect(await codeOf(createBflProvider().editImage(request()))).toBe(
      "RESPOSTA_INVALIDA",
    );
  });

  it("reporta resposta inválida quando fica Ready sem sample", async () => {
    mockFetchSequence(jsonResponse(SUBMITTED), jsonResponse({ status: "Ready" }));

    expect(await codeOf(createBflProvider().editImage(request()))).toBe(
      "RESPOSTA_INVALIDA",
    );
  });

  it("desiste com TIMEOUT quando a tarefa nunca sai de Pending", async () => {
    const pending = () => jsonResponse({ status: "Pending" });
    mockFetchSequence(jsonResponse(SUBMITTED), pending(), pending(), pending());

    expect(await codeOf(createBflProvider().editImage(request()))).toBe("TIMEOUT");
  });

  it("classifica falha de conexão como SEM_REDE", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await codeOf(createBflProvider().editImage(request()))).toBe("SEM_REDE");
  });
});
