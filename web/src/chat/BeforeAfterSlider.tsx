import { useCallback, useRef, type PointerEvent, type KeyboardEvent } from "react";
import { objectUrlFor } from "../storage/objectUrls.js";
import { stripe } from "../shared/stripes.js";
import type { ImageRef } from "./types.js";

const MIN_PCT = 2;
const MAX_PCT = 98;

interface BeforeAfterSliderProps {
  readonly original: ImageRef;
  readonly result: ImageRef;
  readonly version: number;
  readonly pct: number;
  readonly onChange: (pct: number) => void;
}

const clamp = (value: number) => Math.max(MIN_PCT, Math.min(MAX_PCT, value));

/**
 * Comparador antes/depois do handoff, com a mesma matemática de arraste
 * (clamp 2–98) e o mesmo desenho: barra laranja de 3px e alça de 30px.
 *
 * Duas mudanças em relação ao protótipo, ambas obrigatórias para virar produto:
 * Pointer Events no lugar de mousemove no window (o modo mobile precisa de
 * toque) e `clip-path` no lugar da largura fixa de 860px — assim o resultado
 * acompanha qualquer tamanho de container sem esticar a imagem.
 */
export function BeforeAfterSlider({
  original,
  result,
  version,
  pct,
  onChange,
}: BeforeAfterSliderProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const frame = frameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      onChange(clamp(((clientX - rect.left) / rect.width) * 100));
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (dragging.current) updateFromClientX(event.clientX);
    },
    [updateFromClientX],
  );

  const stopDragging = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 10 : 2;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onChange(clamp(pct - step));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onChange(clamp(pct + step));
      }
    },
    [onChange, pct],
  );

  const position = `${pct.toFixed(1)}%`;

  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={0}
      aria-label={`Comparar original e resultado V${version}`}
      aria-valuemin={MIN_PCT}
      aria-valuemax={MAX_PCT}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={`${Math.round(pct)}% do resultado visível`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onKeyDown={handleKeyDown}
      style={stripe(9)}
      className="stripes relative h-[320px] w-full cursor-ew-resize touch-none overflow-hidden border-2 border-hard select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-or"
    >
      <img
        src={objectUrlFor(original)}
        alt="Imagem original"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute bottom-[10px] left-[10px] border border-line bg-surf px-[6px] py-[3px] font-mono text-[9.5px] text-tx2">
        ORIGINAL
      </span>

      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${(100 - pct).toFixed(1)}% 0 0)` }}
      >
        <img
          src={objectUrlFor(result)}
          alt={`Resultado da versão ${version}`}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute top-[10px] left-[10px] bg-or px-[6px] py-[3px] font-mono text-[9.5px] whitespace-nowrap text-onor">
          RESULTADO V{version}
        </span>
      </div>

      <div
        className="pointer-events-none absolute top-0 bottom-0 w-[3px] bg-or"
        style={{ left: position }}
      />
      <div
        className="pointer-events-none absolute top-1/2 flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-hard bg-or text-[12px] font-bold text-onor"
        style={{ left: position }}
      >
        ↔
      </div>
    </div>
  );
}
