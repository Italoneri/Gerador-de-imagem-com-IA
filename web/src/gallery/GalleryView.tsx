import { useMemo, useState } from "react";
import {
  latestResult,
  versionCount,
  type Conversation,
} from "../chat/types.js";
import { formatMegabytes, relativeTime } from "../shared/format.js";
import { stripe } from "../shared/stripes.js";
import { measureStorage } from "../storage/history.js";
import { objectUrlFor } from "../storage/objectUrls.js";

const FILTERS = ["TUDO", "RECENTES", "FAVORITOS"] as const;
type Filter = (typeof FILTERS)[number];

const RECENT_COUNT = 4;

interface GalleryViewProps {
  readonly conversations: readonly Conversation[];
  readonly onOpen: (id: string) => void;
  readonly onToggleFavorite: (id: string) => void;
}

function applyFilter(
  conversations: readonly Conversation[],
  filter: Filter,
): readonly Conversation[] {
  if (filter === "FAVORITOS") {
    return conversations.filter((conversation) => conversation.favorite);
  }
  if (filter === "RECENTES") return conversations.slice(0, RECENT_COUNT);
  return conversations;
}

export function GalleryView({
  conversations,
  onOpen,
  onToggleFavorite,
}: GalleryViewProps) {
  const [filter, setFilter] = useState<Filter>("TUDO");

  const withResults = useMemo(
    () =>
      [...conversations]
        .filter((conversation) => conversation.messages.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const visible = useMemo(
    () => applyFilter(withResults, filter),
    [withResults, filter],
  );

  const usage = useMemo(() => measureStorage(withResults), [withResults]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-bg">
      <div className="sticky top-0 flex items-center justify-between border-b-2 border-hard bg-surf px-[22px] py-[18px]">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[19px] font-extrabold tracking-[-.02em]">
            Suas edições
          </span>
          <span className="font-mono text-[10px] text-tx2">
            {usage.files} ARQUIVOS · {formatMegabytes(usage.bytes)}
          </span>
        </div>

        <div className="flex border-2 border-hard">
          {FILTERS.map((option) => {
            const active = option === filter;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={active}
                className={`cursor-pointer border-r border-hard px-[13px] py-[8px] font-mono text-[10px] font-bold tracking-[.08em] ${
                  active ? "bg-or text-onor" : "bg-surf2 text-tx"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="p-[22px] font-mono text-[10px] tracking-[.08em] text-tx2">
          {withResults.length === 0
            ? "NADA AQUI AINDA — EDITA UMA FOTO NO CHAT"
            : "NENHUMA EDIÇÃO NESSE FILTRO"}
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[16px] p-[22px]">
          {visible.map((conversation) => {
            const cover = latestResult(conversation);
            return (
              <div
                key={conversation.id}
                className="flex flex-col border-2 border-hard bg-surf transition-transform hover:-translate-y-[2px] hover:border-or"
              >
                <div
                  style={stripe(8)}
                  className="stripes relative h-[160px]"
                >
                  {cover ? (
                    <img
                      src={objectUrlFor(cover)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="absolute top-[8px] left-[8px] bg-or px-[6px] py-[3px] font-mono text-[9px] text-onor">
                    {conversation.tag}
                  </span>
                  {/* Mesmo desenho da etiqueta, espelhado à direita — o filtro
                      FAVORITOS do handoff precisava de algo real para filtrar. */}
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(conversation.id)}
                    aria-pressed={conversation.favorite}
                    aria-label={
                      conversation.favorite
                        ? "Remover dos favoritos"
                        : "Marcar como favorito"
                    }
                    className={`absolute top-[8px] right-[8px] cursor-pointer px-[6px] py-[3px] font-mono text-[9px] ${
                      conversation.favorite
                        ? "bg-or text-onor"
                        : "bg-surf text-tx2 hover:bg-or hover:text-onor"
                    }`}
                  >
                    {conversation.favorite ? "★" : "☆"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onOpen(conversation.id)}
                  className="flex cursor-pointer flex-col gap-[3px] border-t-2 border-hard px-[11px] py-[10px] text-left"
                >
                  <span className="overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap">
                    {conversation.title}
                  </span>
                  <span className="font-mono text-[9.5px] text-tx2">
                    {relativeTime(conversation.updatedAt)} ·{" "}
                    {versionCount(conversation)} VERSÕES
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
