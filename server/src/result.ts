/**
 * Erro esperado do negócio (arquivo errado, prompt vazio) volta como valor;
 * erro de sistema continua sendo exceção. Ver CLAUDE.md, "Organização".
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
