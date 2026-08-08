import { describe, expect, it } from "vitest";
import {
  formatMegabytes,
  relativeTime,
  tagForPrompt,
  titleFromPrompt,
} from "./format.js";

const NOW = Date.UTC(2026, 7, 7, 12, 0, 0);
const minutesAgo = (n: number) => NOW - n * 60_000;
const daysAgo = (n: number) => NOW - n * 24 * 60 * 60_000;

describe("relativeTime", () => {
  const cases = [
    { caso: "agora mesmo", at: NOW, expected: "agora" },
    { caso: "1 minuto", at: minutesAgo(1), expected: "agora" },
    { caso: "20 minutos", at: minutesAgo(20), expected: "20 min" },
    { caso: "3 horas", at: minutesAgo(180), expected: "3 h" },
    { caso: "1 dia", at: daysAgo(1), expected: "ontem" },
    { caso: "3 dias", at: daysAgo(3), expected: "3 dias" },
    { caso: "2 semanas", at: daysAgo(14), expected: "2 sem" },
  ] as const;

  it.each(cases)("descreve $caso como $expected", ({ at, expected }) => {
    expect(relativeTime(at, NOW)).toBe(expected);
  });
});

describe("formatMegabytes", () => {
  const cases = [
    { bytes: 0, expected: "0 MB" },
    { bytes: 1024, expected: "0 MB" },
    { bytes: 2.5 * 1024 * 1024, expected: "2.5 MB" },
    { bytes: 240 * 1024 * 1024, expected: "240 MB" },
  ] as const;

  it.each(cases)("formata $bytes bytes como $expected", ({ bytes, expected }) => {
    expect(formatMegabytes(bytes)).toBe(expected);
  });
});

describe("tagForPrompt", () => {
  const cases = [
    { prompt: "troca o céu por um fim de tarde", expected: "CÉU" },
    { prompt: "remove o fundo da foto", expected: "FUNDO" },
    { prompt: "tira o poste da rua", expected: "OBJETO" },
    { prompt: "deixa preto e branco", expected: "COR" },
    { prompt: "coloca luz de estúdio", expected: "LUZ" },
    { prompt: "melhora a nitidez", expected: "NITIDEZ" },
    { prompt: "faz alguma coisa diferente", expected: "EDIÇÃO" },
  ] as const;

  it.each(cases)("etiqueta \"$prompt\" como $expected", ({ prompt, expected }) => {
    expect(tagForPrompt(prompt)).toBe(expected);
  });

  it("ignora maiúsculas e minúsculas", () => {
    expect(tagForPrompt("TROCA O CÉU")).toBe("CÉU");
  });
});

describe("titleFromPrompt", () => {
  it("mantém prompt curto intacto", () => {
    expect(titleFromPrompt("deixa p&b")).toBe("deixa p&b");
  });

  it("colapsa espaços repetidos", () => {
    expect(titleFromPrompt("troca   o    fundo")).toBe("troca o fundo");
  });

  it("corta com reticências no limite", () => {
    const title = titleFromPrompt("a".repeat(60), 10);

    expect(title).toHaveLength(10);
    expect(title.endsWith("…")).toBe(true);
  });
});
