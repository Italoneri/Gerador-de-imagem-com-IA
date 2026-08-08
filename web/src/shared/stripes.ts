import type { CSSProperties } from "react";

/**
 * Passo da listra do fundo quadriculado. O handoff usa 5, 6, 7, 8, 9 e 10px
 * conforme o tamanho do elemento, então o valor é parâmetro e não constante.
 */
export function stripe(px: number): CSSProperties {
  return { "--stripe": `${px}px` } as CSSProperties;
}
