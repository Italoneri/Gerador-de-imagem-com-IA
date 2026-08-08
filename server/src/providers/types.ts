export interface EditImageRequest {
  readonly image: Buffer;
  readonly mimeType: string;
  readonly prompt: string;
  /** Presente quando o front pede variações — mesma instrução, semente diferente. */
  readonly seed?: number | undefined;
  readonly signal: AbortSignal;
}

export interface EditImageResult {
  readonly image: Buffer;
  readonly mimeType: string;
}

/**
 * Tudo que o resto do servidor sabe sobre um provedor de IA. Trocar BFL por
 * Gemini não toca em nenhuma linha da rota — só no registry.
 */
export interface ImageEditProvider {
  readonly id: string;
  editImage(request: EditImageRequest): Promise<EditImageResult>;
}
