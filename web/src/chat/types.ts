import type { EditErrorCode } from "../errors/editErrors.js";

/**
 * Uma imagem dentro da conversa. Guarda o Blob, não uma URL: assim o objeto
 * inteiro atravessa o structuredClone do IndexedDB sem etapa de serialização,
 * e a URL de exibição é derivada sob demanda em storage/objectUrls.ts.
 */
export interface ImageRef {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly blob: Blob;
}

/**
 * Estados impossíveis ficam irrepresentáveis: uma mensagem "carregando" não tem
 * campo de resultado para alguém ler por engano, e uma mensagem de erro carrega
 * o que precisa para o botão "Tentar de novo" funcionar.
 */
export type ChatMessage =
  | {
      readonly kind: "user";
      readonly id: string;
      readonly text: string;
      readonly attachment: ImageRef | null;
    }
  | { readonly kind: "ai"; readonly id: string; readonly state: "loading" }
  | {
      readonly kind: "ai";
      readonly id: string;
      readonly state: "done";
      readonly version: number;
      readonly text: string;
      readonly source: ImageRef;
      readonly result: ImageRef;
      /** Posição da barra do comparador, 2–98. */
      readonly comparePct: number;
      readonly variations: readonly ImageRef[];
      readonly variationsOpen: boolean;
      readonly variationsLoading: boolean;
    }
  | {
      readonly kind: "ai";
      readonly id: string;
      readonly state: "error";
      readonly code: EditErrorCode;
      readonly prompt: string;
      readonly source: ImageRef | null;
    };

export interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly tag: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly favorite: boolean;
  readonly messages: readonly ChatMessage[];
}

export function isDoneMessage(
  message: ChatMessage,
): message is Extract<ChatMessage, { state: "done" }> {
  return message.kind === "ai" && message.state === "done";
}

/** Quantas versões a conversa produziu — vira "N VERSÕES" no card da galeria. */
export function versionCount(conversation: Conversation): number {
  return conversation.messages.filter(isDoneMessage).length;
}

/** Última imagem gerada, que é a base da próxima edição encadeada. */
export function latestResult(conversation: Conversation): ImageRef | null {
  for (let i = conversation.messages.length - 1; i >= 0; i -= 1) {
    const message = conversation.messages[i];
    if (message && isDoneMessage(message)) return message.result;
  }
  return null;
}
