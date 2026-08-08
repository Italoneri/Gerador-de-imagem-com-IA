import { useCallback, useRef, useState, type PointerEvent } from "react";
import type { ImageRef } from "../chat/types.js";
import { objectUrlFor } from "../storage/objectUrls.js";
import { stripe } from "../shared/stripes.js";

const TOOLS = [
  { name: "Mover", short: "MOVE", icon: "✥" },
  { name: "Recortar", short: "CROP", icon: "⌗" },
  { name: "Máscara", short: "MASK", icon: "◐" },
  { name: "Pincel", short: "BRUSH", icon: "✎" },
  { name: "Borracha", short: "ERASE", icon: "◻" },
  { name: "Texto", short: "TEXT", icon: "T" },
] as const;

const DEFAULT_ADJUSTMENTS = {
  "Tamanho do pincel": 34,
  "Suavidade da borda": 62,
  Opacidade: 88,
} as const;

type Adjustments = Record<string, number>;

const LAYERS = [
  { name: "Céu substituído", opacity: "100%" },
  { name: "Sujeito", opacity: "100%" },
  { name: "Desfoque de fundo", opacity: "72%" },
  { name: "Original", opacity: "100%" },
] as const;

interface EditorViewProps {
  readonly image: ImageRef | null;
  readonly isMobile: boolean;
  readonly onAskAi: () => void;
}

/**
 * Painel do editor, pixel a pixel igual ao handoff, agora carregando a imagem
 * real no canvas. Ferramentas, sliders e camadas continuam sendo superfície de
 * design: a única saída funcional daqui é "Pedir pra IA ajustar", que devolve a
 * imagem ao chat como fonte da próxima edição.
 *
 * Aplicar/Desfazer operam sobre os próprios sliders — Aplicar fixa os valores,
 * Desfazer volta para os últimos fixados.
 */
export function EditorView({ image, isMobile, onAskAi }: EditorViewProps) {
  const [tool, setTool] = useState<string>("Máscara");
  const [adjustments, setAdjustments] = useState<Adjustments>({
    ...DEFAULT_ADJUSTMENTS,
  });
  const [committed, setCommitted] = useState<Adjustments>({
    ...DEFAULT_ADJUSTMENTS,
  });

  return (
    <div
      className={`flex min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg ${
        isMobile ? "flex-col" : "flex-row"
      }`}
    >
      <div
        className={`flex flex-none border-b-2 border-hard bg-surf ${
          isMobile ? "w-full flex-row" : "w-[62px] flex-col border-r-2"
        }`}
      >
        {TOOLS.map((entry) => {
          const active = entry.name === tool;
          return (
            <button
              key={entry.name}
              type="button"
              title={entry.name}
              onClick={() => setTool(entry.name)}
              aria-pressed={active}
              className={`flex h-[58px] flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-b-2 border-hard ${
                active ? "bg-or text-onor" : "bg-surf2 text-tx"
              }`}
            >
              <span className="text-[15px] leading-none">{entry.icon}</span>
              <span className="font-mono text-[7.5px] tracking-[.06em]">
                {entry.short}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b-2 border-hard bg-surf px-[16px] py-[11px]">
          <span className="font-mono text-[10.5px] tracking-[.1em] text-tx2">
            FERRAMENTA:{" "}
            <span className="font-bold text-or">{tool}</span>
          </span>
          <div className="flex border-2 border-hard">
            <button
              type="button"
              onClick={() => setAdjustments({ ...committed })}
              className="cursor-pointer border-r-2 border-hard bg-surf2 px-[12px] py-[6px] text-[11.5px] text-tx hover:bg-or hover:text-onor"
            >
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => setCommitted({ ...adjustments })}
              className="cursor-pointer bg-or px-[12px] py-[6px] text-[11.5px] font-bold text-onor"
            >
              Aplicar
            </button>
          </div>
        </div>

        <div className="flex min-h-[220px] flex-1 items-center justify-center overflow-hidden p-[26px]">
          <div
            style={stripe(10)}
            className="stripes-warm relative aspect-[3/2] w-full max-w-[640px] border-2 border-hard"
          >
            {image ? (
              <img
                src={objectUrlFor(image)}
                alt="Imagem em edição"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <div className="absolute top-[12%] right-[22%] bottom-[18%] left-[14%] border-2 border-dashed border-or" />
            <div className="absolute top-[12%] left-[14%] h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 bg-or" />
            <div className="absolute top-[12%] right-[22%] h-[11px] w-[11px] translate-x-1/2 -translate-y-1/2 bg-or" />
            <div className="absolute bottom-[18%] left-[14%] h-[11px] w-[11px] -translate-x-1/2 translate-y-1/2 bg-or" />
            <div className="absolute right-[22%] bottom-[18%] h-[11px] w-[11px] translate-x-1/2 translate-y-1/2 bg-or" />
            <span className="absolute right-[10px] bottom-[10px] bg-or px-[6px] py-[3px] font-mono text-[9.5px] text-onor">
              área selecionada · 62%
            </span>
          </div>
        </div>
      </div>

      <aside
        className={`flex flex-none flex-col overflow-y-auto border-t-2 border-hard bg-surf ${
          isMobile ? "w-full" : "w-[238px] border-l-2"
        }`}
      >
        <div className="border-b-2 border-hard px-[14px] py-[12px] font-mono text-[9.5px] tracking-[.14em] text-tx2">
          AJUSTES
        </div>

        {Object.keys(DEFAULT_ADJUSTMENTS).map((label) => (
          <AdjustSlider
            key={label}
            label={label}
            value={adjustments[label] ?? 0}
            onChange={(value) =>
              setAdjustments((current) => ({ ...current, [label]: value }))
            }
          />
        ))}

        <div className="border-t border-b-2 border-line border-b-hard px-[14px] py-[12px] font-mono text-[9.5px] tracking-[.14em] text-tx2">
          CAMADAS
        </div>
        {LAYERS.map((layer) => (
          <div
            key={layer.name}
            className="flex items-center gap-[9px] border-b border-line px-[14px] py-[9px]"
          >
            <div
              style={stripe(5)}
              className="stripes h-[22px] w-[22px] flex-none border border-line"
            />
            <span className="flex-1 text-[11.5px]">{layer.name}</span>
            <span className="font-mono text-[9px] opacity-70">
              {layer.opacity}
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={onAskAi}
          className="m-[14px] cursor-pointer border-2 border-hard bg-or p-[11px] text-[12px] font-bold text-onor hover:bg-or2"
        >
          Pedir pra IA ajustar
        </button>
      </aside>
    </div>
  );
}

interface AdjustSliderProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

function AdjustSlider({ label, value, onChange }: AdjustSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      onChange(Math.max(0, Math.min(100, pct)));
    },
    [onChange],
  );

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) updateFromClientX(event.clientX);
  };

  const stop = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const pct = `${value.toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-[8px] border-b border-line px-[14px] py-[13px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-semibold">{label}</span>
        <span className="font-mono text-[10.5px] font-bold text-or">
          {Math.round(value)}
        </span>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") onChange(Math.max(0, value - 2));
          if (event.key === "ArrowRight") onChange(Math.min(100, value + 2));
        }}
        className="flex h-[16px] cursor-ew-resize touch-none items-center select-none"
      >
        <div
          ref={trackRef}
          className="relative h-[5px] w-full border border-line bg-surf2"
        >
          <div
            className="absolute top-0 bottom-0 left-0 bg-or"
            style={{ width: pct }}
          />
          <div
            className="absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 border-2 border-hard bg-or"
            style={{ left: pct }}
          />
        </div>
      </div>
    </div>
  );
}
