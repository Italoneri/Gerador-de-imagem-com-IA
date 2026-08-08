/** Atalhos do handoff, na mesma ordem. */
const SHORTCUTS = [
  "Remover fundo",
  "Trocar o céu",
  "Melhorar nitidez",
  "Luz de estúdio",
  "Tirar objeto",
  "Expandir enquadramento",
] as const;

interface QuickChipsProps {
  readonly onUse: (label: string) => void;
}

export function QuickChips({ onUse }: QuickChipsProps) {
  return (
    <div className="flex flex-wrap gap-[6px]">
      {SHORTCUTS.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onUse(label)}
          className="cursor-pointer border-[1.5px] border-line bg-transparent px-[10px] py-[6px] text-[11.5px] text-tx2 hover:border-or hover:bg-or hover:text-onor"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
