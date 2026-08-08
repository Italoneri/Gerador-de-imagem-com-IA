import { objectUrlFor } from "../storage/objectUrls.js";
import { stripe } from "../shared/stripes.js";
import type { ImageRef } from "./types.js";

interface VariationGridProps {
  /** Resultado atual em primeiro, depois as alternativas. */
  readonly options: readonly ImageRef[];
  readonly pendingCount: number;
  readonly selectedId: string;
  readonly onSelect: (variationId: string) => void;
}

export function VariationGrid({
  options,
  pendingCount,
  selectedId,
  onSelect,
}: VariationGridProps) {
  if (options.length <= 1 && pendingCount === 0) {
    return (
      <span className="font-mono text-[9.5px] tracking-[.08em] text-tx2">
        NENHUMA VARIAÇÃO VOLTOU — TENTA DE NOVO
      </span>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[8px]">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={selected}
            style={stripe(7)}
            className={`stripes h-[104px] cursor-pointer border-2 p-0 ${
              selected ? "border-or" : "border-hard hover:border-or"
            }`}
          >
            <img
              src={objectUrlFor(option)}
              alt={selected ? "Resultado atual" : "Variação do resultado"}
              className="h-full w-full object-cover"
            />
          </button>
        );
      })}

      {Array.from({ length: pendingCount }, (_, slot) => (
        <div
          key={`vazio-${slot}`}
          style={stripe(7)}
          className="stripes h-[104px] animate-pulse-bar border-2 border-hard"
        />
      ))}
    </div>
  );
}
