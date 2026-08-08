import { objectUrlFor } from "../storage/objectUrls.js";
import type { ImageRef } from "../chat/types.js";

/** Baixa o resultado usando a object URL que já existe — sem re-encodar nada. */
export function downloadImage(image: ImageRef): void {
  const anchor = document.createElement("a");
  anchor.href = objectUrlFor(image);
  anchor.download = image.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
