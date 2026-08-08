import { VIEWS, type View } from "./useAppShell.js";

interface AppHeaderProps {
  readonly appName: string;
  readonly view: View;
  readonly onChangeView: (view: View) => void;
  readonly credits: number;
  readonly deviceLabel: string;
  readonly onToggleDevice: () => void;
  readonly themeLabel: string;
  readonly onToggleTheme: () => void;
}

export function AppHeader({
  appName,
  view,
  onChangeView,
  credits,
  deviceLabel,
  onToggleDevice,
  themeLabel,
  onToggleTheme,
}: AppHeaderProps) {
  return (
    <header className="flex flex-none items-stretch border-b-2 border-hard bg-or">
      <div className="flex items-center gap-[10px] border-r-2 border-hard px-[16px]">
        <div className="h-[16px] w-[16px] bg-onor" />
        <span className="text-[16px] font-extrabold tracking-[-.02em] text-onor uppercase">
          {appName}
        </span>
      </div>

      <nav className="flex">
        {VIEWS.map((tab) => {
          const active = tab.id === view;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeView(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`cursor-pointer border-r-2 border-hard px-[20px] py-[14px] font-mono text-[11px] font-bold tracking-[.1em] uppercase ${
                active ? "bg-hard text-or" : "bg-transparent text-onor"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 items-center justify-end">
        <span className="px-[16px] font-mono text-[10px] text-onor opacity-75">
          {credits} CRÉDITOS
        </span>
        <button
          type="button"
          onClick={onToggleDevice}
          className="cursor-pointer self-stretch border-l-2 border-hard bg-transparent px-[14px] font-mono text-[11px] font-bold text-onor"
        >
          {deviceLabel}
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="cursor-pointer self-stretch bg-hard px-[14px] font-mono text-[11px] font-bold text-or"
        >
          {themeLabel}
        </button>
      </div>
    </header>
  );
}
