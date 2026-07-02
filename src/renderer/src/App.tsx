import { useEffect } from "react";
import { UiRequestLayer } from "@/components/chat/UiRequestLayer";
import { Layout } from "@/components/Layout";
import { NavPalette } from "@/components/nav/NavPalette";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { CenterTabs } from "@/components/shell/CenterTabs";
import { useShortcuts } from "@/lib/useShortcuts";
import { useTheme } from "@/lib/useTheme";
import { useAppStore } from "@/store/app";
import { useChatStore } from "@/store/chat";
import { useSettingsStore } from "@/store/settings";

// The center surface is `CenterTabs`: an always-present Chat tab (the active
// session's transcript, else a minimal empty state) plus one tab per open file
// (a lazy CodeMirror editor). The 9 nav destinations live only in the right icon
// rail — `RailPanelHost` renders them off the shell store's `openPanelId`, never
// `route` (AGE-632/634).
export default function App() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const loadSettings = useSettingsStore((s) => s.load);
  const ensureSubscribed = useChatStore((s) => s.ensureSubscribed);
  const loadOpenSessions = useChatStore((s) => s.loadOpenSessions);
  // Apply the persisted theme to the document (follows the OS when "system").
  useTheme();
  // Single global keyboard-shortcut manager (Cmd+T/N/W/1-9/K, Shift+P/F, Esc).
  useShortcuts();
  // Bootstrap once: load persisted settings, open the single global bridge
  // subscription that routes every session's frames into the chat store, then
  // restore persisted open-session descriptors as hibernated rail rows (D3r).
  // Settings load first so loadOpenSessions can union settings.openSessions
  // with the live registry list; no children are auto-spawned on boot.
  useEffect(() => {
    void (async () => {
      await loadSettings();
      // Seed the workspace selection from the saved default so the switcher and
      // new chats target it out of the box (the removed StartPanel used to do
      // this on first render). Never clobber a selection already made.
      const app = useAppStore.getState();
      const defaultProject =
        useSettingsStore.getState().settings?.defaultProject;
      if (!app.selectedProject && defaultProject) {
        app.setSelectedProject(defaultProject);
      }
      ensureSubscribed();
      await loadOpenSessions();
    })();
  }, [loadSettings, ensureSubscribed, loadOpenSessions]);
  return (
    <Layout>
      {/* The center is the pane host (AGE-801): the pane model's split tree of
          session-scoped chat panes + file panes. Each pane carries its own
          error boundary, so a crash in one pane never blanks its siblings or
          the shell (sidebar / header / rail). */}
      <CenterTabs />
      {/* ONE UI-request layer per window, for the ACTIVE session: modal UI
          requests are window-exclusive (focused dialogs), so the layer is app
          chrome, not pane content. Mounted with a null id too, so approval
          pruning and the timeout sweeper keep running with no session. */}
      <UiRequestLayer sessionId={activeSessionId} />
      <NavPalette />
      <GlobalSearch />
    </Layout>
  );
}
