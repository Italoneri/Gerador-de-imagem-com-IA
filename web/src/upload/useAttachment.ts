import { useCallback, useState } from "react";
import type { EditErrorCode } from "../errors/editErrors.js";
import { validateImageFile, type ValidatedImage } from "./validateImageFile.js";

/**
 * Anexo pendente do composer. Valida na entrada (tipo, tamanho, decode) para o
 * usuário descobrir o problema antes de gastar upload — o servidor refaz a
 * checagem pelos bytes de qualquer jeito.
 */
export function useAttachment() {
  const [image, setImage] = useState<ValidatedImage | null>(null);
  const [error, setError] = useState<EditErrorCode | null>(null);

  const accept = useCallback(async (file: File) => {
    const outcome = await validateImageFile(file);
    if (!outcome.ok) {
      setImage(null);
      setError(outcome.error);
      return;
    }
    setImage(outcome.value);
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setImage(null);
    setError(null);
  }, []);

  return { image, error, accept, clear };
}
