import { objectUrlFor } from "../storage/objectUrls.js";
import { stripe } from "../shared/stripes.js";
import type { ImageRef } from "./types.js";

export interface RailItem {
  readonly id: string;
  readonly title: string;
  readonly when: string;
  readonly thumbnail: ImageRef | null;
}

interface ConversationRailProps {
  readonly items: readonly RailItem[];
  readonly activeId: string;
  readonly onOpen: (id: string) => void;
  readonly onNew: () => void;
}

export function ConversationRail({
  items,
  activeId,
  onOpen,
  onNew,
}: ConversationRailProps) {
  return (
    <aside className="flex w-[225px] flex-none flex-col border-r-2 border-hard bg-surf">
      <button
        type="button"
        onClick={onNew}
        className="flex cursor-pointer items-center justify-between border-b-2 border-hard bg-or p-[14px] text-[12.5px] font-bold tracking-[.04em] text-onor uppercase hover:bg-or2"
      >
        <span>Nova edição</span>
        <span className="font-mono">+</span>
      </button>

      <div className="px-[14px] pt-[12px] pb-[6px] font-mono text-[9.5px] tracking-[.14em] text-tx2">
        CONVERSAS
      </div>

      <div className="flex flex-col overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item.id)}
            aria-current={item.id === activeId ? "true" : undefined}
            className={`flex cursor-pointer items-center gap-[10px] border-b border-line px-[14px] py-[10px] text-left hover:bg-or hover:text-onor ${
              item.id === activeId ? "bg-surf2" : "bg-transparent"
            }`}
          >
            <div
              style={stripe(6)}
              className="stripes h-[32px] w-[32px] flex-none border border-line"
            >
              {item.thumbnail ? (
                <img
                  src={objectUrlFor(item.thumbnail)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap">
                {item.title}
              </span>
              <span className="font-mono text-[9px] opacity-65">{item.when}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
