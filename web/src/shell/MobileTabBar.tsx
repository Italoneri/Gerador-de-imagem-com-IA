import { VIEWS, type View } from "./useAppShell.js";

interface MobileTabBarProps {
  readonly view: View;
  readonly onChangeView: (view: View) => void;
}

export function MobileTabBar({ view, onChangeView }: MobileTabBarProps) {
  return (
    <nav className="flex flex-none border-t-2 border-hard bg-surf">
      {VIEWS.map((tab) => {
        const active = tab.id === view;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeView(tab.id)}
            aria-current={active ? "page" : undefined}
            className={`flex-1 cursor-pointer border-r border-hard py-[13px] font-mono text-[10px] font-bold tracking-[.08em] ${
              active ? "bg-or text-onor" : "bg-surf text-tx2"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
