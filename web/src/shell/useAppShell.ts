import { useCallback, useState } from "react";

export const VIEWS = [
  { id: "chat", label: "Chat" },
  { id: "galeria", label: "Galeria" },
  { id: "editor", label: "Editor" },
] as const;

export type View = (typeof VIEWS)[number]["id"];
export type Theme = "dark" | "light";
export type Device = "desktop" | "mobile";

/**
 * Estado do casco: aba, tema e o toggle desktop/mobile do handoff — que é uma
 * simulação de viewport dentro da própria página, não um media query.
 */
export function useAppShell() {
  const [view, setView] = useState<View>("chat");
  const [theme, setTheme] = useState<Theme>("dark");
  const [device, setDevice] = useState<Device>("desktop");

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );
  const toggleDevice = useCallback(
    () => setDevice((current) => (current === "mobile" ? "desktop" : "mobile")),
    [],
  );

  const isMobile = device === "mobile";

  return {
    view,
    setView,
    theme,
    toggleTheme,
    themeLabel: theme === "dark" ? "☾ ESCURO" : "☀ CLARO",
    device,
    toggleDevice,
    deviceLabel: isMobile ? "▭ MOBILE" : "▬ DESKTOP",
    isMobile,
    appWidth: isMobile ? "430px" : "100%",
  };
}
