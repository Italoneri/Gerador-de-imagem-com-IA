/**
 * Vocabulário de falhas — espelha server/src/errors/AppError.ts.
 *
 * O servidor manda só o código; todo o texto que o usuário lê nasce aqui, no
 * mesmo tom do resto do app (direto, sem "Ocorreu um erro inesperado").
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
  "CANCELADO",
  // Só do front: o servidor nunca chega a ver uma edição sem imagem.
  "SEM_IMAGEM",
] as const;

export type EditErrorCode = (typeof EDIT_ERROR_CODES)[number];

const codes = new Set<string>(EDIT_ERROR_CODES);

export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 15);

const MESSAGES: Record<EditErrorCode, string> = {
  TIPO_NAO_SUPORTADO: "Esse formato não rola. Manda PNG, JPG ou WebP.",
  ARQUIVO_GRANDE: `A imagem passou de ${MAX_UPLOAD_MB} MB. Reduz o tamanho e manda de novo.`,
  IMAGEM_INVALIDA: "Esse arquivo não é uma imagem válida — ou está corrompido.",
  PROMPT_INVALIDO: "Escreve o que você quer mudar antes de enviar.",
  SEM_REDE: "Sem conexão com o servidor. Confere a internet e tenta de novo.",
  TIMEOUT: "Demorou demais e eu cancelei. Tenta de novo daqui a pouco.",
  RESPOSTA_INVALIDA: "O provedor devolveu algo que eu não entendi. Tenta reformular o pedido.",
  CONTEUDO_BLOQUEADO:
    "O filtro de conteúdo barrou esse pedido. Tenta descrever de outro jeito.",
  SEM_CREDITO: "Os créditos da API acabaram. Recarrega no painel do provedor.",
  LIMITE_EXCEDIDO: "Muitos pedidos seguidos. Espera um minutinho e tenta de novo.",
  PROVEDOR_FORA: "O serviço de edição está fora do ar. Não é você, é ele.",
  CONFIG_INVALIDA: "A chave da API está faltando ou inválida no servidor.",
  CANCELADO: "Edição cancelada.",
  SEM_IMAGEM: "Anexa uma imagem primeiro — clica no + ou arrasta a foto aqui.",
};

export function describeEditError(code: EditErrorCode): string {
  return MESSAGES[code];
}

/** Aceita só códigos que a gente conhece — resposta estranha vira genérica. */
export function toEditErrorCode(value: unknown): EditErrorCode {
  return typeof value === "string" && codes.has(value)
    ? (value as EditErrorCode)
    : "RESPOSTA_INVALIDA";
}
