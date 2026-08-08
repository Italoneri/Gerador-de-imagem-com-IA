import { objectUrlFor } from "../storage/objectUrls.js";
import type { ImageRef } from "./types.js";

interface UserBubbleProps {
  readonly text: string;
  readonly attachment: ImageRef | null;
}

export function UserBubble({ text, attachment }: UserBubbleProps) {
  return (
    <div className="relative flex max-w-[74%] flex-col gap-[10px] self-end border-2 border-hard bg-or px-[15px] py-[13px] text-onor">
      {attachment ? (
        <div className="flex items-center gap-[9px] bg-black/20 px-[9px] py-[7px]">
          <img
            src={objectUrlFor(attachment)}
            alt=""
            className="h-[34px] w-[34px] flex-none object-cover"
          />
          <span className="font-mono text-[10px]">{attachment.name}</span>
        </div>
      ) : null}

      <span className="text-[14.5px] leading-[1.5] font-medium text-pretty">
        {text}
      </span>

      {/* Bico do balão: triângulo escuro por baixo, triângulo laranja por cima,
          deslocado 4px — é o que dá a borda de 2px no bico. */}
      <div className="absolute right-[-14px] bottom-[14px] h-0 w-0 border-y-[10px] border-l-[14px] border-y-transparent border-l-hard" />
      <div className="absolute right-[-10px] bottom-[16px] h-0 w-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-or" />
    </div>
  );
}
