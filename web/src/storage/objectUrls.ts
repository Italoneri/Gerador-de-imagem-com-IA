import type { ImageRef } from "../chat/types.js";

const urls = new Map<string, string>();

/**
 * Uma object URL por imagem, criada na primeira exibição e reaproveitada
 * depois. Sem isso cada re-render criaria uma URL nova e vazaria memória.
 */
export function objectUrlFor(ref: ImageRef): string {
  const cached = urls.get(ref.id);
  if (cached) return cached;

  const url = URL.createObjectURL(ref.blob);
  urls.set(ref.id, url);
  return url;
}

/** Chamado quando uma conversa é apagada: aí sim as URLs dela podem morrer. */
export function releaseObjectUrls(ids: Iterable<string>): void {
  for (const id of ids) {
    const url = urls.get(id);
    if (!url) continue;
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
}
