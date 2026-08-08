/**
 * Vocabulário de tempo do handoff: "agora", "ontem", "3 dias", "1 sem".
 * Curto de propósito — cabe no rail de 225px sem quebrar linha.
 */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor((now - timestamp) / 60_000);
  if (minutes < 2) return "agora";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `${days} dias`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} sem`;

  return `${Math.floor(days / 30)} mes`;
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return "0 MB";
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const TAG_RULES: readonly (readonly [RegExp, string])[] = [
  [/c[ée]u|sky|nuvem|p[oô]r do sol|fim de tarde|entardecer/i, "CÉU"],
  [/fundo|background|cen[áa]rio|paris|praia/i, "FUNDO"],
  [/cor|cores|satura|preto e branco|p&b|tom|v[íi]ntage|filtro/i, "COR"],
  [/luz|ilumin|sombra|est[úu]dio|contraste|brilho/i, "LUZ"],
  [/remov|tira|apaga|objeto|pessoa|poste/i, "OBJETO"],
  [/nitidez|resolu|amplia|expand|enquadr/i, "NITIDEZ"],
];

/**
 * Etiqueta laranja do card da galeria. O handoff usa CÉU/FUNDO/COR/LUZ/OBJETO,
 * então derivamos do próprio pedido em vez de inventar categorias novas.
 */
export function tagForPrompt(prompt: string): string {
  const match = TAG_RULES.find(([pattern]) => pattern.test(prompt));
  return match ? match[1] : "EDIÇÃO";
}

/** Título da conversa: o primeiro pedido, cortado no limite do rail. */
export function titleFromPrompt(prompt: string, maxLength = 38): string {
  const clean = prompt.trim().replace(/\s+/g, " ");
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}
