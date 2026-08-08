import type { ReactNode } from "react";
import { describeEditError } from "../errors/editErrors.js";
import { downloadImage } from "../shared/download.js";
import { BeforeAfterSlider } from "./BeforeAfterSlider.js";
import { VariationGrid } from "./VariationGrid.js";
import { VARIATION_SLOTS } from "./useConversations.js";
import type { ChatMessage } from "./types.js";

type AiMessage = Extract<ChatMessage, { kind: "ai" }>;

interface AiBubbleProps {
  readonly message: AiMessage;
  readonly onCompare: (messageId: string, pct: number) => void;
  readonly onVariations: (messageId: string) => void;
  readonly onSelectVariation: (messageId: string, variationId: string) => void;
  readonly onOpenEditor: (messageId: string) => void;
  readonly onRetry: (messageId: string) => void;
}

const ACTION_BUTTON =
  "flex-1 cursor-pointer bg-surf2 px-[12px] py-[10px] text-[12px] font-semibold text-tx hover:bg-or hover:text-onor";

/** Casca compartilhada: mesma borda, mesmo cabeçalho, mesmos bicos do handoff. */
function BubbleShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className="relative flex max-w-[88%] flex-col gap-[13px] self-start border-2 border-hard bg-surf px-[16px] py-[14px]">
      <div className="flex items-center gap-[8px]">
        <div className="h-[12px] w-[12px] bg-or" />
        <span className="font-mono text-[9.5px] tracking-[.14em] text-tx2">
          FOSCO IA
        </span>
      </div>

      {children}

      <div className="absolute top-[18px] left-[-14px] h-0 w-0 border-y-[10px] border-r-[14px] border-y-transparent border-r-hard" />
      <div className="absolute top-[20px] left-[-10px] h-0 w-0 border-y-[7px] border-r-[10px] border-y-transparent border-r-surf" />
    </div>
  );
}

export function AiBubble({
  message,
  onCompare,
  onVariations,
  onSelectVariation,
  onOpenEditor,
  onRetry,
}: AiBubbleProps) {
  if (message.state === "loading") {
    return (
      <BubbleShell>
        <div className="flex flex-col gap-[11px]">
          <span className="text-[13.5px] text-tx2">
            Já tô editando, dois segundos…
          </span>
          <div className="flex gap-[4px]">
            <div className="h-[6px] w-[56px] animate-pulse-bar bg-or" />
            <div className="h-[6px] w-[56px] animate-pulse-bar bg-or [animation-delay:.18s]" />
            <div className="h-[6px] w-[56px] animate-pulse-bar bg-or [animation-delay:.36s]" />
          </div>
        </div>
      </BubbleShell>
    );
  }

  if (message.state === "error") {
    return (
      <BubbleShell>
        <div className="flex flex-col gap-[13px]">
          <span className="text-[14.5px] leading-[1.5] text-pretty">
            {describeEditError(message.code)}
          </span>
          <div className="flex items-center gap-[10px]">
            <span className="font-mono text-[9.5px] tracking-[.14em] text-tx2">
              {message.code}
            </span>
            {message.source ? (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                className="cursor-pointer border-2 border-hard bg-surf2 px-[12px] py-[6px] text-[12px] font-semibold text-tx hover:bg-or hover:text-onor"
              >
                Tentar de novo
              </button>
            ) : null}
          </div>
        </div>
      </BubbleShell>
    );
  }

  return (
    <BubbleShell>
      <div className="flex flex-col gap-[13px]">
        <span className="text-[14.5px] leading-[1.5] text-pretty">
          {message.text}
        </span>

        <BeforeAfterSlider
          original={message.source}
          result={message.result}
          version={message.version}
          pct={message.comparePct}
          onChange={(pct) => onCompare(message.id, pct)}
        />

        <div className="flex flex-wrap border-2 border-hard">
          <button
            type="button"
            onClick={() => onVariations(message.id)}
            className={`${ACTION_BUTTON} border-r-2 border-hard`}
          >
            Variações
          </button>
          <button
            type="button"
            onClick={() => onOpenEditor(message.id)}
            className={`${ACTION_BUTTON} border-r-2 border-hard`}
          >
            Abrir no editor
          </button>
          <button
            type="button"
            onClick={() => downloadImage(message.result)}
            className={ACTION_BUTTON}
          >
            Baixar PNG
          </button>
        </div>

        {message.variationsOpen ? (
          // O resultado atual ocupa o primeiro slot — é o card de borda laranja
          // do handoff, e é o que permite desfazer a escolha de uma variação.
          <VariationGrid
            options={[message.result, ...message.variations]}
            pendingCount={message.variationsLoading ? VARIATION_SLOTS : 0}
            selectedId={message.result.id}
            onSelect={(variationId) => onSelectVariation(message.id, variationId)}
          />
        ) : null}
      </div>
    </BubbleShell>
  );
}
