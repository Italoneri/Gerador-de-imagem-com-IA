import { useRef, type ChangeEvent, type KeyboardEvent } from "react";
import { describeEditError, type EditErrorCode } from "../errors/editErrors.js";
import { ACCEPTED_MIME_TYPES, type ValidatedImage } from "../upload/validateImageFile.js";
import { QuickChips } from "./QuickChips.js";

interface ComposerProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSend: () => void;
  readonly busy: boolean;
  readonly showQuickChips: boolean;
  readonly onUseChip: (label: string) => void;
  readonly attachment: ValidatedImage | null;
  readonly attachmentPreview: string | null;
  readonly attachmentError: EditErrorCode | null;
  readonly onPickFile: (file: File) => void;
  readonly onClearAttachment: () => void;
  readonly highlight: boolean;
}

export function Composer({
  draft,
  onDraftChange,
  onSend,
  busy,
  showQuickChips,
  onUseChip,
  attachment,
  attachmentPreview,
  attachmentError,
  onPickFile,
  onClearAttachment,
  highlight,
}: ComposerProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onPickFile(file);
    // Zera para que escolher o mesmo arquivo duas vezes seguidas dispare o change.
    event.target.value = "";
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onSend();
  };

  return (
    <div className="border-t-2 border-hard bg-surf px-[20px] pt-[12px] pb-[18px]">
      <div className="mx-auto flex max-w-[820px] flex-col gap-[9px]">
        {showQuickChips ? <QuickChips onUse={onUseChip} /> : null}

        {attachment && attachmentPreview ? (
          <div className="flex items-center gap-[9px] self-start border-2 border-or bg-surf2 px-[9px] py-[6px]">
            <img
              src={attachmentPreview}
              alt=""
              className="h-[28px] w-[28px] object-cover"
            />
            <span className="font-mono text-[10px]">{attachment.name}</span>
            <button
              type="button"
              onClick={onClearAttachment}
              aria-label="Remover anexo"
              className="cursor-pointer border-none bg-transparent px-[2px] text-[15px] text-tx2"
            >
              ×
            </button>
          </div>
        ) : null}

        {attachmentError ? (
          <span className="self-start font-mono text-[10px] tracking-[.04em] text-or">
            {describeEditError(attachmentError)}
          </span>
        ) : null}

        <div
          className={`flex items-stretch border-2 bg-bg ${
            highlight ? "border-or" : "border-hard"
          }`}
        >
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_MIME_TYPES.join(",")}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Anexar imagem"
            className="w-[46px] flex-none cursor-pointer border-r-2 border-hard bg-surf2 text-[18px] text-tx hover:bg-or hover:text-onor"
          >
            ＋
          </button>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que você quer mudar? ex.: tira o poste do fundo e esquenta a luz"
            aria-label="Instrução de edição"
            className="min-w-0 flex-1 border-none bg-transparent px-[14px] py-[13px] text-[14.5px] text-tx outline-none"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={busy}
            className="flex-none cursor-pointer border-l-2 border-hard bg-or px-[22px] text-[13px] font-bold tracking-[.05em] text-onor uppercase hover:bg-or2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Editando" : "Editar"}
          </button>
        </div>

        <span className="text-center font-mono text-[9px] tracking-[.08em] text-tx2">
          ARRASTE A BARRA LARANJA NA IMAGEM PARA COMPARAR ANTES / DEPOIS
        </span>
      </div>
    </div>
  );
}
