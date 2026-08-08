import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAttachment } from "../upload/useAttachment.js";
import { useImageDrop } from "../upload/useImageDrop.js";
import { AiBubble } from "./AiBubble.js";
import { Composer } from "./Composer.js";
import { ConversationRail, type RailItem } from "./ConversationRail.js";
import { EmptyState } from "./EmptyState.js";
import { UserBubble } from "./UserBubble.js";
import { isDoneMessage, type Conversation, type ImageRef } from "./types.js";
import type { SendInput } from "./useConversations.js";

interface ChatViewProps {
  readonly conversation: Conversation;
  readonly railItems: readonly RailItem[];
  readonly showRail: boolean;
  readonly showQuickChips: boolean;
  readonly busy: boolean;
  readonly onSend: (input: SendInput) => void;
  readonly onRetry: (messageId: string) => void;
  readonly onCompare: (messageId: string, pct: number) => void;
  readonly onVariations: (messageId: string) => void;
  readonly onSelectVariation: (messageId: string, variationId: string) => void;
  readonly onOpenEditor: (image: ImageRef) => void;
  readonly onOpenConversation: (id: string) => void;
  readonly onNewConversation: () => void;
}

export function ChatView({
  conversation,
  railItems,
  showRail,
  showQuickChips,
  busy,
  onSend,
  onRetry,
  onCompare,
  onVariations,
  onSelectVariation,
  onOpenEditor,
  onOpenConversation,
  onNewConversation,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const attachment = useAttachment();
  const bottomRef = useRef<HTMLDivElement>(null);

  const acceptFile = useCallback(
    (file: File) => void attachment.accept(file),
    [attachment],
  );
  const { isDragging, dropHandlers } = useImageDrop(acceptFile);

  const preview = useMemo(
    () => (attachment.image ? URL.createObjectURL(attachment.image.blob) : null),
    [attachment.image],
  );
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation.messages]);

  const handleSend = useCallback(() => {
    if (busy) return;
    onSend({ prompt: draft, attachment: attachment.image });
    setDraft("");
    attachment.clear();
  }, [attachment, busy, draft, onSend]);

  const openEditorFor = useCallback(
    (messageId: string) => {
      const message = conversation.messages.find((item) => item.id === messageId);
      if (message && isDoneMessage(message)) onOpenEditor(message.result);
    },
    [conversation.messages, onOpenEditor],
  );

  return (
    <div className="flex min-w-0 flex-1">
      {showRail ? (
        <ConversationRail
          items={railItems}
          activeId={conversation.id}
          onOpen={onOpenConversation}
          onNew={onNewConversation}
        />
      ) : null}

      <main
        {...dropHandlers}
        className="flex min-w-0 flex-1 flex-col bg-bg"
      >
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-[26px] pt-[26px] pb-[6px]">
          <div className="mx-auto flex max-w-[820px] flex-col gap-[24px]">
            {conversation.messages.length === 0 ? <EmptyState /> : null}

            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className="flex animate-rise-in flex-col"
              >
                {message.kind === "user" ? (
                  <UserBubble
                    text={message.text}
                    attachment={message.attachment}
                  />
                ) : (
                  <AiBubble
                    message={message}
                    onCompare={onCompare}
                    onVariations={onVariations}
                    onSelectVariation={onSelectVariation}
                    onOpenEditor={openEditorFor}
                    onRetry={onRetry}
                  />
                )}
              </div>
            ))}

            <div ref={bottomRef} className="h-[2px]" />
          </div>
        </div>

        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          busy={busy}
          showQuickChips={showQuickChips}
          onUseChip={(label) => setDraft(label.toLowerCase())}
          attachment={attachment.image}
          attachmentPreview={preview}
          attachmentError={attachment.error}
          onPickFile={acceptFile}
          onClearAttachment={attachment.clear}
          highlight={isDragging}
        />
      </main>
    </div>
  );
}
