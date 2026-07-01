// AGE-634 (center tab strip) + AGE-801 (pane host). The center renders the
// pane model's split tree. Default: ONE chat pane that follows the active
// session — the pre-pane shell exactly. With files open, the DEFAULT pane
// grows the Chat+files tab strip; switching keeps the chat MOUNTED (a live
// stream is never torn down); closing a clean tab is immediate while a dirty
// tab confirms first. New panes render beside the default pane and carry their
// own session ids.

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CenterTabs } from "@/components/shell/CenterTabs";
import { CHAT_TAB, type FileTab, useFilesStore } from "@/store/files";
import { MAIN_PANE_ID, usePaneStore } from "@/store/panes";

// The pane host's contract is "each pane renders a session-scoped chat
// surface" — the surface itself is exercised by the Chat view tests. Mock it
// to a marker that names the session id it received.
vi.mock("@/views/Chat", () => ({
  default: ({ sessionId }: { sessionId?: string }) => (
    <div data-testid="chat-pane">CHAT-PANE:{sessionId ?? "follow-active"}</div>
  ),
}));

function tab(path: string, over: Partial<FileTab> = {}): FileTab {
  return {
    path,
    workspaceRoot: null,
    workspaceGeneration: 0,
    text: "",
    savedText: "",
    dirty: false,
    loading: false,
    tooLarge: false,
    // Binary so the active pane renders a notice, never the lazy editor.
    binary: true,
    truncated: false,
    error: false,
    ...over,
  };
}

function seedTabs(tabs: FileTab[], active: string) {
  const map: Record<string, FileTab> = {};
  for (const t of tabs) map[t.path] = t;
  useFilesStore.setState({
    tabs: map,
    order: tabs.map((t) => t.path),
    activeTab: active,
  });
}

beforeEach(() => {
  useFilesStore.setState({
    workspaceRoot: null,
    workspaceGeneration: 0,
    children: {},
    expanded: {},
    dirLoading: {},
    tabs: {},
    order: [],
    activeTab: CHAT_TAB,
  });
  usePaneStore.getState().reset();
});

it("renders only the default chat pane (no tab strip) when no files are open", () => {
  render(<CenterTabs />);
  expect(screen.getByText("CHAT-PANE:follow-active")).toBeVisible();
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
});

it("shows a Chat tab plus one tab per open file", () => {
  seedTabs([tab("src/a.ts"), tab("b.md")], "src/a.ts");
  render(<CenterTabs />);

  const strip = screen.getByRole("tablist");
  expect(within(strip).getByRole("tab", { name: "Chat" })).toBeInTheDocument();
  expect(within(strip).getByRole("tab", { name: /a\.ts/ })).toBeInTheDocument();
  expect(within(strip).getByRole("tab", { name: /b\.md/ })).toBeInTheDocument();
});

it("switching to a file tab keeps the chat mounted but hidden", async () => {
  const user = userEvent.setup();
  seedTabs([tab("a.ts")], CHAT_TAB);
  render(<CenterTabs />);

  expect(screen.getByText("CHAT-PANE:follow-active")).toBeVisible();

  await user.click(screen.getByRole("tab", { name: /a\.ts/ }));

  expect(useFilesStore.getState().activeTab).toBe("a.ts");
  // The chat node is still in the DOM (state preserved), just no longer visible.
  expect(screen.getByText("CHAT-PANE:follow-active")).toBeInTheDocument();
  expect(screen.getByText("CHAT-PANE:follow-active")).not.toBeVisible();
  // The file pane is now the visible one (binary → read-only notice).
  expect(screen.getByText(/binary file/i)).toBeVisible();
});

it("closing a clean file tab is immediate; a dirty tab confirms first", async () => {
  const user = userEvent.setup();
  const confirmSpy = vi
    .spyOn(window, "confirm")
    .mockImplementation(() => false);
  seedTabs([tab("clean.ts"), tab("dirty.ts", { dirty: true })], "clean.ts");
  render(<CenterTabs />);

  await user.click(screen.getByRole("button", { name: "Close clean.ts" }));
  expect(useFilesStore.getState().order).toEqual(["dirty.ts"]);
  expect(confirmSpy).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Close dirty.ts" }));
  // Confirm declined → the dirty tab stays open.
  expect(confirmSpy).toHaveBeenCalledTimes(1);
  expect(useFilesStore.getState().order).toEqual(["dirty.ts"]);
  confirmSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// AGE-801: pane hosting — multiple session-scoped chat panes + file panes.
// ---------------------------------------------------------------------------

it("renders two chat panes targeting DIFFERENT session ids side by side", () => {
  usePaneStore.getState().openPane({ kind: "chat", sessionId: "session-b" });
  usePaneStore.getState().setPaneSession(MAIN_PANE_ID, "session-a");
  render(<CenterTabs />);

  const panes = screen.getAllByTestId("chat-pane");
  expect(panes).toHaveLength(2);
  expect(panes.map((p) => p.textContent)).toEqual([
    "CHAT-PANE:session-a",
    "CHAT-PANE:session-b",
  ]);
});

it("a pinned pane keeps its session while the default pane follows the active one", () => {
  usePaneStore.getState().openPane({ kind: "chat", sessionId: "pinned-1" });
  render(<CenterTabs />);

  const panes = screen.getAllByTestId("chat-pane");
  expect(panes.map((p) => p.textContent)).toEqual([
    "CHAT-PANE:follow-active",
    "CHAT-PANE:pinned-1",
  ]);
});

it("renders a file pane beside the chat pane from the pane model", () => {
  seedTabs([tab("notes.md")], CHAT_TAB); // registers the tab state FileEditor reads
  usePaneStore.getState().openPane({ kind: "file", path: "notes.md" });
  render(<CenterTabs />);

  expect(screen.getByText("CHAT-PANE:follow-active")).toBeVisible();
  // The dedicated file pane renders the editor surface (binary notice).
  expect(
    within(
      screen.getByRole("region", { name: /File pane: notes\.md/ }),
    ).getByText(/binary file/i),
  ).toBeVisible();
});

it("closing a pane collapses the split back to the default single pane", () => {
  const paneId = usePaneStore
    .getState()
    .openPane({ kind: "chat", sessionId: "temp" });
  expect(paneId).not.toBeNull();
  render(<CenterTabs />);
  expect(screen.getAllByTestId("chat-pane")).toHaveLength(2);

  act(() => {
    if (paneId) usePaneStore.getState().closePane(paneId);
  });
  expect(screen.getAllByTestId("chat-pane")).toHaveLength(1);
  expect(screen.getByText("CHAT-PANE:follow-active")).toBeVisible();
});
