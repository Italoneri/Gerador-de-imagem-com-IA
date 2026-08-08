import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editImage } from "../api/editImage.js";
import type { EditErrorCode } from "../errors/editErrors.js";
import { relativeTime, tagForPrompt, titleFromPrompt } from "../shared/format.js";
import { loadConversations, saveConversations } from "../storage/history.js";
import { releaseObjectUrls } from "../storage/objectUrls.js";
import {
  isDoneMessage,
  latestResult,
  type ChatMessage,
  type Conversation,
  type ImageRef,
} from "./types.js";
import type { ValidatedImage } from "../upload/validateImageFile.js";

/**
 * Duas alternativas, não três: o grid do handoff tem 3 slots e o primeiro é
 * ocupado pelo resultado atual, para dar caminho de volta depois de escolher.
 */
export const VARIATION_SLOTS = 2;

const newId = () => crypto.randomUUID();

function toImageRef(image: ValidatedImage): ImageRef {
  return {
    id: newId(),
    name: image.name,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    blob: image.blob,
  };
}

/**
 * O provedor devolve pixels, não prosa. Este texto é cópia da interface — mesma
 * função da frase que o handoff mostra embaixo do balão — e não uma resposta
 * inventada em nome do modelo.
 */
function confirmationText(version: number): string {
  return version === 1
    ? "Pronto. Compara arrastando a barra laranja — esquerda é o original, direita é o resultado."
    : `Pronto — apliquei sobre a versão ${version - 1} e mantive a resolução original. Compara arrastando a barra.`;
}

function emptyConversation(): Conversation {
  const now = Date.now();
  return {
    id: newId(),
    title: "Nova edição",
    tag: "EDIÇÃO",
    createdAt: now,
    updatedAt: now,
    favorite: false,
    messages: [],
  };
}

/** Versão reinicia sempre que o usuário anexa uma imagem nova. */
function nextVersion(messages: readonly ChatMessage[]): number {
  let lastAttachment = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.kind === "user" && message.attachment) {
      lastAttachment = i;
      break;
    }
  }
  return messages.slice(lastAttachment + 1).filter(isDoneMessage).length + 1;
}

export interface SendInput {
  readonly prompt: string;
  readonly attachment: ValidatedImage | null;
}

export function useConversations() {
  const [conversations, setConversations] = useState<readonly Conversation[]>([
    emptyConversation(),
  ]);
  const [activeId, setActiveId] = useState<string>(
    () => conversations[0]?.id ?? "",
  );
  const [hydrated, setHydrated] = useState(false);
  const inFlight = useRef(new Map<string, AbortController>());

  // Restaura o histórico uma vez. Enquanto não voltou, a conversa em branco já
  // está na tela, então o usuário nunca vê um vazio piscando.
  useEffect(() => {
    let cancelled = false;
    void loadConversations().then((stored) => {
      if (cancelled || stored.length === 0) {
        setHydrated(true);
        return;
      }
      setConversations((current) => {
        const blank = current[0];
        return blank && blank.messages.length === 0
          ? [blank, ...stored]
          : [...current, ...stored];
      });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveConversations(conversations);
  }, [conversations, hydrated]);

  useEffect(() => {
    const controllers = inFlight.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
    };
  }, []);

  const active = useMemo(
    () => conversations.find((item) => item.id === activeId) ?? conversations[0],
    [conversations, activeId],
  );

  const patchConversation = useCallback(
    (id: string, update: (conversation: Conversation) => Conversation) => {
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id
            ? { ...update(conversation), updatedAt: Date.now() }
            : conversation,
        ),
      );
    },
    [],
  );

  const patchMessage = useCallback(
    (
      conversationId: string,
      messageId: string,
      update: (message: ChatMessage) => ChatMessage,
    ) => {
      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? update(message) : message,
        ),
      }));
    },
    [patchConversation],
  );

  /**
   * Roda uma edição e substitui o balão "carregando" pelo resultado ou pelo
   * erro. É o único lugar que fala com a API no fluxo principal.
   */
  const runEdit = useCallback(
    async (
      conversationId: string,
      placeholderId: string,
      source: ImageRef,
      prompt: string,
      version: number,
    ) => {
      const controller = new AbortController();
      inFlight.current.set(placeholderId, controller);

      const outcome = await editImage({
        image: source.blob,
        fileName: source.name,
        prompt,
        signal: controller.signal,
      });

      inFlight.current.delete(placeholderId);

      if (!outcome.ok) {
        patchMessage(conversationId, placeholderId, (message) => ({
          kind: "ai",
          id: message.id,
          state: "error",
          code: outcome.error,
          prompt,
          source,
        }));
        return;
      }

      const result: ImageRef = {
        id: newId(),
        name: `fosco-v${version}.png`,
        mimeType: outcome.value.mimeType,
        width: source.width,
        height: source.height,
        blob: outcome.value.blob,
      };

      patchMessage(conversationId, placeholderId, (message) => ({
        kind: "ai",
        id: message.id,
        state: "done",
        version,
        text: confirmationText(version),
        source,
        result,
        comparePct: 50,
        variations: [],
        variationsOpen: false,
        variationsLoading: false,
      }));
    },
    [patchMessage],
  );

  const send = useCallback(
    ({ prompt, attachment }: SendInput) => {
      const conversation = active;
      if (!conversation) return;

      const trimmed = prompt.trim();
      if (!trimmed) return;

      const attached = attachment ? toImageRef(attachment) : null;
      const source = attached ?? latestResult(conversation);

      const userMessage: ChatMessage = {
        kind: "user",
        id: newId(),
        text: trimmed,
        attachment: attached,
      };

      // Sem imagem não há o que editar: o erro entra como balão da IA, no mesmo
      // lugar onde a resposta apareceria.
      if (!source) {
        patchConversation(conversation.id, (current) => ({
          ...current,
          messages: [
            ...current.messages,
            userMessage,
            {
              kind: "ai",
              id: newId(),
              state: "error",
              code: "SEM_IMAGEM" satisfies EditErrorCode,
              prompt: trimmed,
              source: null,
            },
          ],
        }));
        return;
      }

      const placeholderId = newId();
      const version = nextVersion([...conversation.messages, userMessage]);
      const isFirst = conversation.messages.length === 0;

      patchConversation(conversation.id, (current) => ({
        ...current,
        title: isFirst ? titleFromPrompt(trimmed) : current.title,
        tag: isFirst ? tagForPrompt(trimmed) : current.tag,
        messages: [
          ...current.messages,
          userMessage,
          { kind: "ai", id: placeholderId, state: "loading" },
        ],
      }));

      void runEdit(conversation.id, placeholderId, source, trimmed, version);
    },
    [active, patchConversation, runEdit],
  );

  const retry = useCallback(
    (messageId: string) => {
      const conversation = active;
      if (!conversation) return;

      const failed = conversation.messages.find(
        (message) => message.id === messageId,
      );
      if (!failed || failed.kind !== "ai" || failed.state !== "error") return;
      if (!failed.source) return;

      const version = nextVersion(conversation.messages);
      patchMessage(conversation.id, messageId, (message) => ({
        kind: "ai",
        id: message.id,
        state: "loading",
      }));

      void runEdit(
        conversation.id,
        messageId,
        failed.source,
        failed.prompt,
        version,
      );
    },
    [active, patchMessage, runEdit],
  );

  const setComparePct = useCallback(
    (messageId: string, pct: number) => {
      if (!active) return;
      patchMessage(active.id, messageId, (message) =>
        isDoneMessage(message) ? { ...message, comparePct: pct } : message,
      );
    },
    [active, patchMessage],
  );

  /**
   * Variações: mesma instrução, sementes diferentes. Três chamadas em paralelo,
   * número fixo — nunca um fan-out proporcional a dados do usuário.
   */
  const generateVariations = useCallback(
    async (messageId: string) => {
      const conversation = active;
      if (!conversation) return;

      const target = conversation.messages.find((m) => m.id === messageId);
      if (!target || !isDoneMessage(target)) return;

      if (target.variations.length > 0) {
        patchMessage(conversation.id, messageId, (message) =>
          isDoneMessage(message)
            ? { ...message, variationsOpen: !message.variationsOpen }
            : message,
        );
        return;
      }

      const userPrompt = findPromptFor(conversation.messages, messageId);
      if (!userPrompt) return;

      patchMessage(conversation.id, messageId, (message) =>
        isDoneMessage(message)
          ? { ...message, variationsOpen: true, variationsLoading: true }
          : message,
      );

      const seeds = Array.from({ length: VARIATION_SLOTS }, () =>
        Math.floor(Math.random() * 2_147_483_647),
      );
      const settled = await Promise.all(
        seeds.map((seed) =>
          editImage({
            image: target.source.blob,
            fileName: target.source.name,
            prompt: userPrompt,
            seed,
          }),
        ),
      );

      const variations: ImageRef[] = settled.flatMap((outcome, index) =>
        outcome.ok
          ? [
              {
                id: newId(),
                name: `fosco-v${target.version}-var${index + 1}.png`,
                mimeType: outcome.value.mimeType,
                width: target.source.width,
                height: target.source.height,
                blob: outcome.value.blob,
              },
            ]
          : [],
      );

      patchMessage(conversation.id, messageId, (message) =>
        isDoneMessage(message)
          ? { ...message, variations, variationsLoading: false }
          : message,
      );
    },
    [active, patchMessage],
  );

  /** Clicar numa variação promove ela a resultado principal do balão. */
  const promoteVariation = useCallback(
    (messageId: string, variationId: string) => {
      if (!active) return;
      patchMessage(active.id, messageId, (message) => {
        if (!isDoneMessage(message)) return message;
        const chosen = message.variations.find((v) => v.id === variationId);
        if (!chosen) return message;
        return {
          ...message,
          result: chosen,
          variations: message.variations.map((v) =>
            v.id === variationId ? message.result : v,
          ),
        };
      });
    },
    [active, patchMessage],
  );

  const startConversation = useCallback(() => {
    const fresh = emptyConversation();
    setConversations((current) => [fresh, ...current]);
    setActiveId(fresh.id);
  }, []);

  const openConversation = useCallback((id: string) => setActiveId(id), []);

  const toggleFavorite = useCallback(
    (id: string) => {
      patchConversation(id, (conversation) => ({
        ...conversation,
        favorite: !conversation.favorite,
      }));
    },
    [patchConversation],
  );

  const removeConversation = useCallback((id: string) => {
    setConversations((current) => {
      const doomed = current.find((conversation) => conversation.id === id);
      if (doomed) releaseObjectUrls(collectImageIds(doomed));
      const remaining = current.filter((conversation) => conversation.id !== id);
      return remaining.length > 0 ? remaining : [emptyConversation()];
    });
  }, []);

  const railItems = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.messages.length > 0)
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          when: relativeTime(conversation.updatedAt),
          thumbnail: firstImage(conversation),
        })),
    [conversations],
  );

  const isBusy = useMemo(
    () =>
      active?.messages.some(
        (message) => message.kind === "ai" && message.state === "loading",
      ) ?? false,
    [active],
  );

  return {
    conversations,
    active,
    railItems,
    isBusy,
    send,
    retry,
    setComparePct,
    generateVariations,
    promoteVariation,
    startConversation,
    openConversation,
    toggleFavorite,
    removeConversation,
  };
}

function findPromptFor(
  messages: readonly ChatMessage[],
  aiMessageId: string,
): string | null {
  const index = messages.findIndex((message) => message.id === aiMessageId);
  for (let i = index - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.kind === "user") return message.text;
  }
  return null;
}

function firstImage(conversation: Conversation): ImageRef | null {
  for (const message of conversation.messages) {
    if (isDoneMessage(message)) return message.result;
    if (message.kind === "user" && message.attachment) return message.attachment;
  }
  return null;
}

function collectImageIds(conversation: Conversation): string[] {
  const ids: string[] = [];
  for (const message of conversation.messages) {
    if (message.kind === "user" && message.attachment) {
      ids.push(message.attachment.id);
    }
    if (isDoneMessage(message)) {
      ids.push(message.source.id, message.result.id);
      for (const variation of message.variations) ids.push(variation.id);
    }
  }
  return ids;
}
