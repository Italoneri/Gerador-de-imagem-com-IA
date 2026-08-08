import { describe, expect, it } from "vitest";
import { validateEditRequest } from "./validateEditRequest.js";

const fromBase64 = (data: string) => ({ buffer: Buffer.from(data, "base64") });

const PNG = fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
);
const GIF = fromBase64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
const TEXTO = { buffer: Buffer.from("isto e um txt renomeado para .jpg") };

const validFields = { prompt: "troca o fundo pra Paris" };

async function errorOf(
  file: { buffer: Buffer } | undefined,
  fields: unknown,
): Promise<string> {
  const result = await validateEditRequest(file, fields);
  return result.ok ? "SEM_ERRO" : result.error;
}

describe("validateEditRequest", () => {
  it("aceita PNG com prompt válido", async () => {
    const result = await validateEditRequest(PNG, validFields);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.mimeType).toBe("image/png");
      expect(result.value.prompt).toBe("troca o fundo pra Paris");
      expect(result.value.seed).toBeUndefined();
    }
  });

  it("converte seed de string para número", async () => {
    const result = await validateEditRequest(PNG, { ...validFields, seed: "42" });

    expect(result.ok && result.value.seed).toBe(42);
  });

  it("apara espaços em volta do prompt", async () => {
    const result = await validateEditRequest(PNG, { prompt: "  deixa p&b  " });

    expect(result.ok && result.value.prompt).toBe("deixa p&b");
  });

  const rejections = [
    {
      caso: "arquivo ausente",
      file: undefined,
      fields: validFields,
      expected: "IMAGEM_INVALIDA",
    },
    {
      caso: "arquivo vazio",
      file: { buffer: Buffer.alloc(0) },
      fields: validFields,
      expected: "IMAGEM_INVALIDA",
    },
    {
      caso: "txt disfarçado de imagem",
      file: TEXTO,
      fields: validFields,
      expected: "IMAGEM_INVALIDA",
    },
    {
      caso: "tipo real fora da allowlist",
      file: GIF,
      fields: validFields,
      expected: "TIPO_NAO_SUPORTADO",
    },
    {
      caso: "prompt vazio",
      file: PNG,
      fields: { prompt: "   " },
      expected: "PROMPT_INVALIDO",
    },
    {
      caso: "prompt ausente",
      file: PNG,
      fields: {},
      expected: "PROMPT_INVALIDO",
    },
    {
      caso: "prompt longo demais",
      file: PNG,
      fields: { prompt: "a".repeat(2_001) },
      expected: "PROMPT_INVALIDO",
    },
  ] as const;

  it.each(rejections)("rejeita $caso com $expected", async ({ file, fields, expected }) => {
    expect(await errorOf(file, fields)).toBe(expected);
  });

  it("decide o tipo pelos bytes, não pelo nome do arquivo", async () => {
    // O cliente pode jurar que é image/jpeg; os magic bytes dizem GIF.
    expect(await errorOf(GIF, validFields)).toBe("TIPO_NAO_SUPORTADO");
  });
});
