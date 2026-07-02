// AGE-630 — the expandable docked panel the right rail opens. It frames the
// active destination's view (read from the nav registry) with a labelled header
// and collapses on the close button OR Escape — but yields to a nested overlay
// that already consumed the Escape. The registry is mocked to a stub view so the
// test exercises the panel chrome without mounting a real (IPC-bound) view.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePaneStore } from "@/store/panes";
import { useSettingsStore } from "@/store/settings";
import { useShellStore } from "@/store/shell";
import { RailPanelHost } from "./RailPanelHost";

vi.mock("@/lib/nav-registry", () => {
  const StubView = () => <div data-testid="stub-view">stub view</div>;
  return {
    railEntry: (route: string) =>
      route === "skills"
        ? {
            route: "skills",
            label: "Skills",
            icon: () => null,
            view: StubView,
          }
        : undefined,
  };
});

beforeEach(() => {
  useShellStore.setState({ openPanelId: "skills" });
  useSettingsStore.setState({ setLayout: vi.fn() });
});

it("frames the destination label and mounts its view", () => {
  render(<RailPanelHost openPanelId="skills" />);

  expect(
    screen.getByRole("complementary", { name: "Skills panel" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("stub-view")).toBeInTheDocument();
});

it("renders nothing for a non-rail destination", () => {
  const { container } = render(<RailPanelHost openPanelId="chat" />);
  expect(container).toBeEmptyDOMElement();
});

it("the close button collapses the panel", async () => {
  const user = userEvent.setup();
  render(<RailPanelHost openPanelId="skills" />);

  await user.click(screen.getByRole("button", { name: "Close Skills" }));

  expect(useShellStore.getState().openPanelId).toBeNull();
});

it("Escape collapses the panel", async () => {
  const user = userEvent.setup();
  render(<RailPanelHost openPanelId="skills" />);

  await user.keyboard("{Escape}");

  expect(useShellStore.getState().openPanelId).toBeNull();
});

it("Escape already consumed by a nested overlay does not collapse", () => {
  render(<RailPanelHost openPanelId="skills" />);

  // A nested Menu/Popover/Dialog handled the Escape first (preventDefault).
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    cancelable: true,
  });
  event.preventDefault();
  window.dispatchEvent(event);

  expect(useShellStore.getState().openPanelId).toBe("skills");
});

// ---------------------------------------------------------------------------
// AGE-801: the right rail's expandable panel is EXPLICITLY GLOBAL app chrome —
// one openPanelId per window, however many center panes exist (the pane model
// never multiplies it; see store/shell.ts ownership note).
// ---------------------------------------------------------------------------

it("stays a single global panel regardless of how many center panes are open", () => {
  // Multiple chat panes open in the pane model must not change rail behavior
  // or multiply panel instances: the rail reads ONLY the shell store.
  usePaneStore.getState().reset();
  usePaneStore.getState().openPane({ kind: "chat", sessionId: "a" });
  usePaneStore.getState().openPane({ kind: "chat", sessionId: "b" });

  render(<RailPanelHost openPanelId="skills" />);

  // Exactly ONE panel instance, labelled once.
  expect(
    screen.getAllByRole("complementary", { name: "Skills panel" }),
  ).toHaveLength(1);
  expect(screen.getAllByTestId("stub-view")).toHaveLength(1);

  // Collapsing it collapses THE window's rail — one shared openPanelId.
  useShellStore.getState().closePanel();
  expect(useShellStore.getState().openPanelId).toBeNull();
  usePaneStore.getState().reset();
});
