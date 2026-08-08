import { useCallback, useRef, useState, type DragEvent } from "react";

/**
 * Drag-and-drop de imagem sobre a área do chat.
 *
 * O contador de profundidade existe porque `dragleave` dispara toda vez que o
 * ponteiro cruza um filho: sem ele, o realce pisca ao passar por cima das
 * mensagens.
 */
export function useImageDrop(onFile: (file: File) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    depth.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      depth.current = 0;
      setIsDragging(false);
      const file = event.dataTransfer.files.item(0);
      if (file) onFile(file);
    },
    [onFile],
  );

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
