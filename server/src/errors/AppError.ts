/**
 * Vocabulário único de falhas da edição de imagem.
 *
 * O servidor devolve só o código — a íntegra do texto que o usuário lê vive no
 * front (`web/src/errors/editErrors.ts`), então não há duas cópias da mesma
 * frase para sair de sincronia. Quem consome a API por fora recebe um código
 * legível, que já diz o suficiente.
 */
export const EDIT_ERROR_CODES = [
  "TIPO_NAO_SUPORTADO",
  "ARQUIVO_GRANDE",
  "IMAGEM_INVALIDA",
  "PROMPT_INVALIDO",
  "SEM_REDE",
  "TIMEOUT",
  "RESPOSTA_INVALIDA",
  "CONTEUDO_BLOQUEADO",
  "SEM_CREDITO",
  "LIMITE_EXCEDIDO",
  "PROVEDOR_FORA",
  "CONFIG_INVALIDA",
] as const;

export type EditErrorCode = (typeof EDIT_ERROR_CODES)[number];

const STATUS_BY_CODE: Record<EditErrorCode, number> = {
  TIPO_NAO_SUPORTADO: 415,
  ARQUIVO_GRANDE: 413,
  IMAGEM_INVALIDA: 400,
  PROMPT_INVALIDO: 400,
  SEM_REDE: 502,
  TIMEOUT: 504,
  RESPOSTA_INVALIDA: 502,
  CONTEUDO_BLOQUEADO: 422,
  SEM_CREDITO: 402,
  LIMITE_EXCEDIDO: 429,
  PROVEDOR_FORA: 502,
  CONFIG_INVALIDA: 500,
};

export class AppError extends Error {
  readonly code: EditErrorCode;
  /** Contexto técnico para o log do servidor. Nunca vai para o browser. */
  readonly detail: string | undefined;

  constructor(code: EditErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "AppError";
    this.code = code;
    this.detail = detail;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }
}

/** Traduz o status HTTP de um provedor externo para o nosso vocabulário. */
export function codeFromUpstreamStatus(
  status: number,
  detail?: string,
): EditErrorCode {
  if (status === 401 || status === 403) return "CONFIG_INVALIDA";
  if (status === 402) return "SEM_CREDITO";
  if (status === 429) return "LIMITE_EXCEDIDO";
  if (status === 422) return codeFromValidationDetail(detail);
  return "PROVEDOR_FORA";
}

/**
 * A BFL responde 422 para qualquer falha de validação, não só para moderação:
 * uma chave malformada volta como `{"detail":"Invalid API key format"}`. Tratar
 * todo 422 como conteúdo bloqueado mandaria o usuário reescrever um prompt que
 * nunca foi o problema — então quem decide é o corpo da resposta.
 *
 * Moderação de verdade costuma chegar pelo status do polling
 * (`Content Moderated` / `Request Moderated`), tratado no adaptador.
 */
function codeFromValidationDetail(detail = ""): EditErrorCode {
  if (/api[\s_-]?key|token|auth|credential/i.test(detail)) return "CONFIG_INVALIDA";
  if (/moderat|safety|nsfw|blocked|content policy/i.test(detail)) {
    return "CONTEUDO_BLOQUEADO";
  }
  return "RESPOSTA_INVALIDA";
}
