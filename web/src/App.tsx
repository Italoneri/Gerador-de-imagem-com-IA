import { useCallback, useMemo, useState } from "react";
import { ChatView } from "./chat/ChatView.js";
import { latestResult, versionCount, type ImageRef } from "./chat/types.js";
import { useConversations } from "./chat/useConversations.js";
import { EditorView } from "./editor/EditorView.js";
import { GalleryView } from "./gallery/GalleryView.js";
import { AppHeader } from "./shell/AppHeader.js";
import { MobileTabBar } from "./shell/MobileTabBar.js";
import { useAppShell } from "./shell/useAppShell.js";

// Props que o handoff expõe no painel do Claude Design. Viram env para
// continuarem sendo o mesmo ponto de ajuste, agora em build time.
const APP_NAME = import.meta.env.VITE_APP_NAME ?? "Fosco";
const SHOW_HISTORY = import.meta.env.VITE_SHOW_HISTORY !== "false";
const SHOW_QUICK_CHIPS = import.meta.env.VITE_SHOW_QUICK_CHIPS !== "false";
const STARTING_CREDITS = Number(import.meta.env.VITE_CREDITS ?? 12);

export function App() {
  const shell = useAppShell();
  const chat = useConversations();
  const [editorImage, setEditorImage] = useState<ImageRef | null>(null);

  const active = chat.active;

  // "12 CRÉDITOS" do handoff, agora com significado: cada versão gerada gasta um.
  const creditsLeft = useMemo(() => {
    const spent = chat.conversations.reduce(
      (total, conversation) => total + versionCount(conversation),
      0,
    );
    return Math.max(0, STARTING_CREDITS - spent);
  }, [chat.conversations]);

  const openEditorWith = useCallback(
    (image: ImageRef) => {
      setEditorImage(image);
      shell.setView("editor");
    },
    [shell],
  );

  const openConversation = useCallback(
    (id: string) => {
      chat.openConversation(id);
      shell.setView("chat");
    },
    [chat, shell],
  );

  // Fecha o ciclo Editor → Chat: a imagem aberta no editor vira a base da
  // próxima instrução, sem o usuário precisar reanexar nada.
  const backToChat = useCallback(() => shell.setView("chat"), [shell]);

  const editorSubject = editorImage ?? (active ? latestResult(active) : null);

  return (
    <div
      className="app flex h-screen w-full flex-col overflow-hidden bg-bg font-sans text-tx"
      data-theme={shell.theme}
    >
      <AppHeader
        appName={APP_NAME}
        view={shell.view}
        onChangeView={shell.setView}
        credits={creditsLeft}
        deviceLabel={shell.deviceLabel}
        onToggleDevice={shell.toggleDevice}
        themeLabel={shell.themeLabel}
        onToggleTheme={shell.toggleTheme}
      />

      <div className="flex min-h-0 flex-1 justify-center bg-bg">
        <div
          className="flex min-h-0 flex-1 border-r-2 border-l-2 border-line"
          style={{ maxWidth: shell.appWidth }}
        >
          {shell.view === "chat" && active ? (
            <ChatView
              conversation={active}
              railItems={chat.railItems}
              showRail={!shell.isMobile && SHOW_HISTORY}
              showQuickChips={SHOW_QUICK_CHIPS}
              busy={chat.isBusy}
              onSend={chat.send}
              onRetry={chat.retry}
              onCompare={chat.setComparePct}
              onVariations={(id) => void chat.generateVariations(id)}
              onSelectVariation={chat.promoteVariation}
              onOpenEditor={openEditorWith}
              onOpenConversation={chat.openConversation}
              onNewConversation={chat.startConversation}
            />
          ) : null}

          {shell.view === "galeria" ? (
            <GalleryView
              conversations={chat.conversations}
              onOpen={openConversation}
              onToggleFavorite={chat.toggleFavorite}
            />
          ) : null}

          {shell.view === "editor" ? (
            <EditorView
              image={editorSubject}
              isMobile={shell.isMobile}
              onAskAi={backToChat}
            />
          ) : null}
        </div>
      </div>

      {shell.isMobile ? (
        <MobileTabBar view={shell.view} onChangeView={shell.setView} />
      ) : null}
    </div>
  );
}
