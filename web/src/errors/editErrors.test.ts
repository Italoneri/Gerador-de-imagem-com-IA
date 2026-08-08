import { describe, expect, it } from "vitest";
import {
  EDIT_ERROR_CODES,
  describeEditError,
  toEditErrorCode,
} from "./editErrors.js";

describe("describeEditError", () => {
  it.each(EDIT_ERROR_CODES)("tem mensagem para %s", (code) => {
    const message = describeEditError(code);

    expect(message.length).toBeGreaterThan(10);
    expect(message).not.toContain(code);
  });

  it("não repete mensagem entre códigos diferentes", () => {
    const messages = EDIT_ERROR_CODES.map(describeEditError);

    expect(new Set(messages).size).toBe(EDIT_ERROR_CODES.length);
  });
});

describe("toEditErrorCode", () => {
  it.each(EDIT_ERROR_CODES)("preserva o código conhecido %s", (code) => {
    expect(toEditErrorCode(code)).toBe(code);
  });

  const unknownValues = [
    ["string desconhecida", "BOOM"],
    ["nulo", null],
    ["indefinido", undefined],
    ["número", 500],
    ["objeto", { code: "TIMEOUT" }],
  ] as const;

  it.each(unknownValues)("cai em RESPOSTA_INVALIDA para %s", (_caso, value) => {
    expect(toEditErrorCode(value)).toBe("RESPOSTA_INVALIDA");
  });
});
