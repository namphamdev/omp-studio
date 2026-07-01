// The center surface (AGE-634 tabs + AGE-801 pane host). The center renders
// the PANE MODEL (store/panes.ts): a split tree of chat/file panes, each an
// independent session-scoped surface. The default state is one chat pane that
// follows the active session — visually and behaviorally identical to the
// pre-pane shell — so the strip/tab behavior below is unchanged until AGE-777
// opens a second pane.
//
// The legacy center tab strip (an always-present "Chat" tab plus one tab per
// open file) still lives on the DEFAULT pane only: file tabs opened from the
// Files sidebar toggle within the main pane, while additional panes from the
// pane model render beside it in the split tree. Every pane and tab stays
// MOUNTED and is toggled with `hidden`, so switching preserves the chat (a
// live stream keeps running) and each editor's cursor/scroll/undo. Closing a
// dirty file confirms via the store wrapper.

import { FileText, MessageSquare, X } from "lucide-react";
import type { ReactNode } from "react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { FileEditor } from "@/components/files/FileEditor";
import { cn } from "@/lib/cn";
import {
  type CenterTab,
  CHAT_TAB,
  closeFileWithConfirm,
  fileBasename,
  useFilesStore,
} from "@/store/files";
import {
  MAIN_PANE_ID,
  type PaneEntry,
  type PaneLayout,
  usePaneStore,
} from "@/store/panes";
import ChatWorkspace from "@/views/Chat";

const TAB_BASE =
  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";
const TAB_ACTIVE = "bg-bg-hover text-ink";
const TAB_INACTIVE = "text-ink-muted hover:bg-bg-hover/60 hover:text-ink";

export function CenterTabs() {
  const layout = usePaneStore((s) => s.layout);
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <PaneTree node={layout} />
    </div>
  );
}

// Render a split-tree node: leaves become PaneViews; splits become flex rows/
// columns of equally-sized children. (Resizable split handles arrive with
// AGE-777 — the tree shape is what this issue pins down.)
function PaneTree({ node }: { node: PaneLayout }) {
  if (node.kind === "leaf") {
    return <PaneView paneId={node.paneId} />;
  }
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-1",
        node.direction === "row" ? "flex-row" : "flex-col",
      )}
    >
      {node.children.map((child, i) => (
        <div
          // The tree is rebuilt on structural change; index identity is stable
          // between rebuilds and the children carry their own paneId keys.
          key={child.kind === "leaf" ? child.paneId : `split-${i}`}
          className={cn(
            "min-h-0 min-w-0 flex-1",
            node.direction === "row"
              ? i > 0 && "border-l border-border-subtle"
              : i > 0 && "border-t border-border-subtle",
          )}
        >
          <PaneTree node={child} />
        </div>
      ))}
    </div>
  );
}

// One pane. Chat panes render a session-scoped ChatWorkspace (pinned via the
// pane's sessionId, or following the active session when unset). File panes
// render a single editor. A crash inside one pane must never blank its
// siblings, so each pane carries its own error boundary.
function PaneView({ paneId }: { paneId: string }) {
  const pane = usePaneStore((s) => s.panes[paneId]);
  const focusPane = usePaneStore((s) => s.focusPane);
  if (!pane) return null;
  return (
    // Focus routing (keyboard shortcuts target the focused pane) is pointer-
    // driven; the pane surface itself is not an interactive control.
    <section
      aria-label={paneLabel(pane)}
      data-pane-id={paneId}
      onFocusCapture={() => focusPane(paneId)}
      onPointerDownCapture={() => focusPane(paneId)}
      className="h-full min-h-0 min-w-0"
    >
      <AppErrorBoundary resetKey={pane.sessionId ?? pane.path ?? paneId}>
        {pane.kind === "chat" ? (
          paneId === MAIN_PANE_ID ? (
            <MainPaneWithFileTabs sessionId={pane.sessionId} />
          ) : (
            <ChatWorkspace sessionId={pane.sessionId} />
          )
        ) : pane.path ? (
          <FileEditor path={pane.path} />
        ) : null}
      </AppErrorBoundary>
    </section>
  );
}

function paneLabel(pane: PaneEntry): string {
  if (pane.kind === "file") {
    return pane.path ? `File pane: ${fileBasename(pane.path)}` : "File pane";
  }
  return pane.sessionId ? "Chat pane" : "Main chat pane";
}

// The default pane keeps the legacy center tab strip: chat + one tab per open
// file, all mounted, toggled with `hidden`. Extra panes never grow a strip —
// their content is fixed at open time (AGE-777 owns richer per-pane chrome).
function MainPaneWithFileTabs({ sessionId }: { sessionId?: string }) {
  const order = useFilesStore((s) => s.order);
  const activeTab = useFilesStore((s) => s.activeTab);
  const hasFiles = order.length > 0;
  // With no files the chat owns the surface; otherwise it shows only when focused.
  const chatActive = !hasFiles || activeTab === CHAT_TAB;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {hasFiles && <TabStrip order={order} activeTab={activeTab} />}
      <div className="relative min-h-0 min-w-0 flex-1">
        <TogglePane active={chatActive}>
          <ChatWorkspace sessionId={sessionId} />
        </TogglePane>
        {order.map((path) => (
          <TogglePane key={path} active={activeTab === path}>
            <FileEditor path={path} />
          </TogglePane>
        ))}
      </div>
    </div>
  );
}

/**
 * A mounted-but-toggled pane: the inactive pane is removed from layout with the
 * native `hidden` attribute (so the chat keeps streaming and each editor keeps
 * its cursor/scroll/undo across switches). `hidden` is used over a `display`
 * utility because the pane carries no competing `display` class, so the UA
 * `display:none` always wins.
 */
function TogglePane({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      hidden={!active}
      aria-hidden={!active}
      className="absolute inset-0 min-h-0 min-w-0"
    >
      {children}
    </div>
  );
}

function TabStrip({
  order,
  activeTab,
}: {
  order: string[];
  activeTab: CenterTab;
}) {
  const setActiveTab = useFilesStore((s) => s.setActiveTab);
  return (
    <div
      role="tablist"
      aria-label="Open tabs"
      className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border-subtle bg-bg-raised px-1.5"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === CHAT_TAB}
        onClick={() => setActiveTab(CHAT_TAB)}
        className={cn(
          TAB_BASE,
          activeTab === CHAT_TAB ? TAB_ACTIVE : TAB_INACTIVE,
        )}
      >
        <MessageSquare size={14} className="shrink-0" />
        Chat
      </button>
      {order.map((path) => (
        <FileTabButton
          key={path}
          path={path}
          active={activeTab === path}
          onSelect={() => setActiveTab(path)}
        />
      ))}
    </div>
  );
}

function FileTabButton({
  path,
  active,
  onSelect,
}: {
  path: string;
  active: boolean;
  onSelect: () => void;
}) {
  const dirty = useFilesStore((s) => s.tabs[path]?.dirty === true);
  const name = fileBasename(path);
  return (
    // Presentational wrapper so the select + close buttons stay siblings (never
    // nested interactives); the close button overlays the select button's right
    // padding so a click on it never selects the tab.
    <div className="relative flex shrink-0 items-stretch">
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={onSelect}
        title={path}
        className={cn(TAB_BASE, "pr-7", active ? TAB_ACTIVE : TAB_INACTIVE)}
      >
        <FileText size={14} className="shrink-0 text-ink-faint" />
        <span className="max-w-[11rem] truncate">{name}</span>
        {dirty && (
          <span
            role="img"
            aria-label="Unsaved changes"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
        )}
      </button>
      <button
        type="button"
        aria-label={`Close ${name}`}
        onClick={() => closeFileWithConfirm(path)}
        className="absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-ink-faint transition-colors hover:bg-bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <X size={14} />
      </button>
    </div>
  );
}
