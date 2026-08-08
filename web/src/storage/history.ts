import { get, set } from "idb-keyval";
import type { ChatMessage, Conversation } from "../chat/types.js";

const STORAGE_KEY = "fosco:conversas";

/**
 * Mensagem em voo não é histórico: se a aba fechar no meio de uma edição, não
 * queremos ressuscitar um "carregando" eterno na próxima abertura.
 */
function isPersistable(message: ChatMessage): boolean {
  return !(message.kind === "ai" && message.state === "loading");
}

function stripTransient(conversation: Conversation): Conversation {
  return {
    ...conversation,
    messages: conversation.messages.filter(isPersistable),
  };
}

/** Conversa sem nenhum resultado não ocupa espaço na galeria. */
function isWorthKeeping(conversation: Conversation): boolean {
  return conversation.messages.length > 0;
}

export async function loadConversations(): Promise<Conversation[]> {
  try {
    const stored = await get<Conversation[]>(STORAGE_KEY);
    return Array.isArray(stored) ? stored : [];
  } catch {
    // IndexedDB bloqueado (aba anônima, cota cheia): o app funciona sem
    // histórico, então degradar em silêncio aqui é melhor que travar o boot.
    return [];
  }
}

export async function saveConversations(
  conversations: readonly Conversation[],
): Promise<void> {
  try {
    await set(
      STORAGE_KEY,
      conversations.map(stripTransient).filter(isWorthKeeping),
    );
  } catch (cause) {
    console.warn("não deu para salvar o histórico", cause);
  }
}

/** Quanto o histórico ocupa — vira "N ARQUIVOS · N MB" no topo da galeria. */
export function measureStorage(conversations: readonly Conversation[]): {
  files: number;
  bytes: number;
} {
  // Por id, porque a fonte de uma edição encadeada é o resultado da anterior:
  // contar as duas inflaria o total em quase 2x.
  const seen = new Map<string, number>();

  for (const conversation of conversations) {
    for (const message of conversation.messages) {
      const images =
        message.kind === "user"
          ? message.attachment
            ? [message.attachment]
            : []
          : message.state === "done"
            ? [message.source, message.result, ...message.variations]
            : [];

      for (const image of images) seen.set(image.id, image.blob.size);
    }
  }

  let bytes = 0;
  for (const size of seen.values()) bytes += size;

  return { files: seen.size, bytes };
}
