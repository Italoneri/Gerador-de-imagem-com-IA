import { describe, expect, it, vi } from "vitest";
import {
  MAX_MEGAPIXELS,
  validateImageFile,
  type ImageDecoder,
} from "./validateImageFile.js";

const makeFile = (type: string, bytes: number, name = "foto.png") =>
  new File([new Uint8Array(bytes)], name, { type });

const decodesTo = (width: number, height: number): ImageDecoder =>
  vi.fn().mockResolvedValue({ width, height });

const decodeFails: ImageDecoder = vi.fn().mockRejectedValue(new Error("bad image"));

const options = { maxBytes: 1_000, decode: decodesTo(800, 600) };

async function errorOf(
  file: File,
  overrides: Partial<Parameters<typeof validateImageFile>[1]> = {},
): Promise<string> {
  const result = await validateImageFile(file, { ...options, ...overrides });
  return result.ok ? "SEM_ERRO" : result.error;
}

describe("validateImageFile", () => {
  it("aceita PNG dentro dos limites e devolve as dimensões decodificadas", async () => {
    const result = await validateImageFile(makeFile("image/png", 500), options);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.width).toBe(800);
      expect(result.value.height).toBe(600);
      expect(result.value.mimeType).toBe("image/png");
      expect(result.value.name).toBe("foto.png");
    }
  });

  const acceptedTypes = ["image/png", "image/jpeg", "image/webp"] as const;

  it.each(acceptedTypes)("aceita %s", async (type) => {
    expect(await errorOf(makeFile(type, 500))).toBe("SEM_ERRO");
  });

  const rejections = [
    { caso: "GIF", file: () => makeFile("image/gif", 500), expected: "TIPO_NAO_SUPORTADO" },
    { caso: "PDF", file: () => makeFile("application/pdf", 500), expected: "TIPO_NAO_SUPORTADO" },
    { caso: "sem tipo", file: () => makeFile("", 500), expected: "TIPO_NAO_SUPORTADO" },
    { caso: "arquivo vazio", file: () => makeFile("image/png", 0), expected: "IMAGEM_INVALIDA" },
    { caso: "acima do limite", file: () => makeFile("image/png", 1_001), expected: "ARQUIVO_GRANDE" },
  ] as const;

  it.each(rejections)("rejeita $caso com $expected", async ({ file, expected }) => {
    expect(await errorOf(file())).toBe(expected);
  });

  it("rejeita imagem que não decodifica", async () => {
    expect(await errorOf(makeFile("image/png", 500), { decode: decodeFails })).toBe(
      "IMAGEM_INVALIDA",
    );
  });

  it("rejeita acima do teto de megapixels do provedor", async () => {
    const tooManyPixels = decodesTo(MAX_MEGAPIXELS * 1_000_000, 2);

    expect(await errorOf(makeFile("image/png", 500), { decode: tooManyPixels })).toBe(
      "ARQUIVO_GRANDE",
    );
  });

  it("rejeita dimensão zerada", async () => {
    expect(await errorOf(makeFile("image/png", 500), { decode: decodesTo(0, 600) })).toBe(
      "IMAGEM_INVALIDA",
    );
  });

  it("checa o tipo antes de decodificar, para não gastar CPU com arquivo inválido", async () => {
    const decode = decodesTo(10, 10);

    await validateImageFile(makeFile("application/zip", 500), { ...options, decode });

    expect(decode).not.toHaveBeenCalled();
  });
});
