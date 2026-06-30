// AGE-752 — the embedded-browser tab store. It mirrors the active tab through
// the legacy `viewId`/`state` fields, keeps per-tab metadata for inactive views,
// and drops stale pushes from views that have been closed.

import type { BrowserViewState } from "@shared/domain";
import type { OmpApi } from "@shared/ipc";
import { useBrowserStore } from "@/store/browser";

const hiddenBounds = { x: 0, y: 0, width: 0, height: 0 };

function stubBrowser(over: Record<string, unknown>) {
  Object.assign(window.omp, {
    browser: over,
  } as unknown as Partial<OmpApi>);
}

function viewState(over: Partial<BrowserViewState>): BrowserViewState {
  return {
    id: "v1",
    url: "",
    title: "",
    canGoBack: false,
    canGoForward: false,
    loading: false,
    ...over,
  };
}

beforeEach(() => {
  useBrowserStore.setState({
    viewId: null,
    state: null,
    tabs: [],
    history: [],
    creating: false,
    error: undefined,
    _unsub: null,
    _states: {},
    _createToken: 0,
  });
});

it("create adopts the returned id + initial state and primes history", async () => {
  const create = vi
    .fn()
    .mockResolvedValue(
      viewState({ id: "v1", url: "https://a.com", title: "A" }),
    );
  stubBrowser({ create, onState: vi.fn(() => () => {}) });

  await useBrowserStore.getState().create({
    url: "https://a.com",
    bounds: { x: 0, y: 0, width: 10, height: 10 },
  });

  const s = useBrowserStore.getState();
  expect(create).toHaveBeenCalledWith({
    url: "https://a.com",
    bounds: { x: 0, y: 0, width: 10, height: 10 },
  });
  expect(s.viewId).toBe("v1");
  expect(s.state?.url).toBe("https://a.com");
  expect(s.tabs).toEqual([
    { id: "v1", title: "A", url: "https://a.com", loading: false },
  ]);
  expect(s.history).toEqual(["https://a.com"]);
});

it("two creates produce two tabs and hide the prior active view", async () => {
  const create = vi
    .fn()
    .mockResolvedValueOnce(
      viewState({ id: "v1", url: "https://a.com", title: "A" }),
    )
    .mockResolvedValueOnce(
      viewState({ id: "v2", url: "https://b.com", title: "B" }),
    );
  const setBounds = vi.fn();
  stubBrowser({ create, setBounds });

  await useBrowserStore.getState().create({
    url: "https://a.com",
    bounds: { x: 1, y: 2, width: 3, height: 4 },
  });
  await useBrowserStore.getState().create({
    url: "https://b.com",
    bounds: { x: 5, y: 6, width: 7, height: 8 },
  });

  const s = useBrowserStore.getState();
  expect(create).toHaveBeenCalledTimes(2);
  expect(setBounds).toHaveBeenCalledWith("v1", hiddenBounds);
  expect(s.viewId).toBe("v2");
  expect(s.state?.title).toBe("B");
  expect(s.tabs).toEqual([
    { id: "v1", title: "A", url: "https://a.com", loading: false },
    { id: "v2", title: "B", url: "https://b.com", loading: false },
  ]);
  expect(s.history).toEqual(["https://b.com", "https://a.com"]);
});

it("suppresses only duplicate concurrent creates", async () => {
  let resolve!: (s: BrowserViewState) => void;
  const create = vi.fn(
    () =>
      new Promise<BrowserViewState>((r) => {
        resolve = r;
      }),
  );
  stubBrowser({ create });

  const first = useBrowserStore.getState().create({
    url: "https://a.com",
    bounds: hiddenBounds,
  });
  const second = useBrowserStore.getState().create({
    url: "https://b.com",
    bounds: hiddenBounds,
  });
  resolve(viewState({ id: "v1" }));
  await Promise.all([first, second]);

  expect(create).toHaveBeenCalledTimes(1);
});

it("create hides the tab that is active when the create resolves", async () => {
  let resolve!: (s: BrowserViewState) => void;
  const create = vi.fn(
    () =>
      new Promise<BrowserViewState>((r) => {
        resolve = r;
      }),
  );
  const setBounds = vi.fn();
  stubBrowser({ create, setBounds });
  useBrowserStore.setState({
    viewId: "v1",
    state: viewState({ id: "v1", title: "A", url: "https://a.com" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });

  const pending = useBrowserStore.getState().create({
    url: "https://c.com",
    bounds: hiddenBounds,
  });
  useBrowserStore.getState().switchTo("v2");
  resolve(viewState({ id: "v3", title: "C", url: "https://c.com" }));
  await pending;

  expect(setBounds).toHaveBeenNthCalledWith(1, "v1", hiddenBounds);
  expect(setBounds).toHaveBeenNthCalledWith(2, "v2", hiddenBounds);
  expect(useBrowserStore.getState().viewId).toBe("v3");
  expect(useBrowserStore.getState().tabs).toEqual([
    { id: "v1", title: "A", url: "https://a.com", loading: false },
    { id: "v2", title: "B", url: "https://b.com", loading: false },
    { id: "v3", title: "C", url: "https://c.com", loading: false },
  ]);
});

it("destroyAll invalidates a pending create and destroys its returned view", async () => {
  let resolve!: (s: BrowserViewState) => void;
  const create = vi.fn(
    () =>
      new Promise<BrowserViewState>((r) => {
        resolve = r;
      }),
  );
  const destroy = vi.fn();
  stubBrowser({ create, destroy });

  const pending = useBrowserStore.getState().create({
    url: "https://a.com",
    bounds: hiddenBounds,
  });
  useBrowserStore.getState().destroyAll();
  resolve(viewState({ id: "v1", title: "A", url: "https://a.com" }));
  await pending;

  expect(destroy).toHaveBeenCalledWith("v1");
  expect(useBrowserStore.getState().tabs).toEqual([]);
  expect(useBrowserStore.getState().viewId).toBeNull();
  expect(useBrowserStore.getState().state).toBeNull();
  expect(useBrowserStore.getState().creating).toBe(false);
});

it("switchTo changes active state and hides the previous view without destroying", () => {
  const setBounds = vi.fn();
  const destroy = vi.fn();
  stubBrowser({ setBounds, destroy });
  useBrowserStore.setState({
    viewId: "v1",
    state: viewState({ id: "v1", title: "A" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });

  useBrowserStore.getState().switchTo("v2");

  expect(setBounds).toHaveBeenCalledWith("v1", hiddenBounds);
  expect(destroy).not.toHaveBeenCalled();
  expect(useBrowserStore.getState().viewId).toBe("v2");
  expect(useBrowserStore.getState().state?.title).toBe("B");
});

it("reduces active and inactive onState pushes while keeping active state scoped", () => {
  let push!: (s: BrowserViewState) => void;
  stubBrowser({
    onState: vi.fn((cb: (s: BrowserViewState) => void) => {
      push = cb;
      return () => {};
    }),
  });
  useBrowserStore.setState({
    viewId: "v1",
    history: ["https://a.com"],
    state: viewState({ id: "v1", title: "A", url: "https://a.com" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });
  useBrowserStore.getState().ensureSubscribed();

  push(
    viewState({ id: "v2", url: "https://b2.com", title: "B2", loading: true }),
  );
  expect(useBrowserStore.getState().state?.title).toBe("A");
  expect(useBrowserStore.getState().tabs[1]).toEqual({
    id: "v2",
    title: "B2",
    url: "https://b2.com",
    loading: true,
  });
  expect(useBrowserStore.getState().history).toEqual([
    "https://b2.com",
    "https://a.com",
  ]);

  push(
    viewState({ id: "v1", url: "https://c.com", title: "C", loading: true }),
  );
  expect(useBrowserStore.getState().state?.title).toBe("C");
  expect(useBrowserStore.getState().history).toEqual([
    "https://c.com",
    "https://b2.com",
    "https://a.com",
  ]);

  // Same head URL (e.g. a loading→idle transition) is not duplicated.
  push(viewState({ id: "v1", url: "https://c.com", loading: false }));
  expect(useBrowserStore.getState().state?.loading).toBe(false);
  expect(useBrowserStore.getState().history).toEqual([
    "https://c.com",
    "https://b2.com",
    "https://a.com",
  ]);
});

it("stale pushes after close are ignored", () => {
  let push!: (s: BrowserViewState) => void;
  const destroy = vi.fn();
  stubBrowser({
    destroy,
    onState: vi.fn((cb: (s: BrowserViewState) => void) => {
      push = cb;
      return () => {};
    }),
  });
  useBrowserStore.setState({
    viewId: "v1",
    state: viewState({ id: "v1", title: "A", url: "https://a.com" }),
    tabs: [{ id: "v1", title: "A", url: "https://a.com", loading: false }],
    _states: { v1: viewState({ id: "v1", title: "A", url: "https://a.com" }) },
  });
  useBrowserStore.getState().ensureSubscribed();
  useBrowserStore.getState().close("v1");

  push(viewState({ id: "v1", url: "https://evil.com", title: "Evil" }));

  expect(destroy).toHaveBeenCalledWith("v1");
  expect(useBrowserStore.getState().tabs).toEqual([]);
  expect(useBrowserStore.getState().viewId).toBeNull();
  expect(useBrowserStore.getState().state).toBeNull();
  expect(useBrowserStore.getState().history).toEqual([]);
});

it("closing inactive destroys only that id", () => {
  const destroy = vi.fn();
  stubBrowser({ destroy });
  useBrowserStore.setState({
    viewId: "v1",
    state: viewState({ id: "v1", title: "A" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });

  useBrowserStore.getState().close("v2");

  expect(destroy).toHaveBeenCalledWith("v2");
  expect(useBrowserStore.getState().viewId).toBe("v1");
  expect(useBrowserStore.getState().state?.title).toBe("A");
  expect(useBrowserStore.getState().tabs).toEqual([
    { id: "v1", title: "A", url: "https://a.com", loading: false },
  ]);
});

it("closing active selects a remaining neighboring tab", () => {
  const destroy = vi.fn();
  stubBrowser({ destroy });
  useBrowserStore.setState({
    viewId: "v1",
    state: viewState({ id: "v1", title: "A" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });

  useBrowserStore.getState().close("v1");

  expect(destroy).toHaveBeenCalledWith("v1");
  expect(useBrowserStore.getState().viewId).toBe("v2");
  expect(useBrowserStore.getState().state?.title).toBe("B");
  expect(useBrowserStore.getState().tabs).toEqual([
    { id: "v2", title: "B", url: "https://b.com", loading: false },
  ]);
});

it("destroyAll destroys every tab and clears local state", () => {
  const destroy = vi.fn();
  stubBrowser({ destroy });
  useBrowserStore.setState({
    viewId: "v2",
    state: viewState({ id: "v2", title: "B" }),
    tabs: [
      { id: "v1", title: "A", url: "https://a.com", loading: false },
      { id: "v2", title: "B", url: "https://b.com", loading: false },
    ],
    _states: {
      v1: viewState({ id: "v1", title: "A", url: "https://a.com" }),
      v2: viewState({ id: "v2", title: "B", url: "https://b.com" }),
    },
  });

  useBrowserStore.getState().destroyAll();

  expect(destroy).toHaveBeenCalledWith("v1");
  expect(destroy).toHaveBeenCalledWith("v2");
  expect(useBrowserStore.getState().tabs).toEqual([]);
  expect(useBrowserStore.getState().viewId).toBeNull();
  expect(useBrowserStore.getState().state).toBeNull();
});

it("forwards control intents to the bridge with the active view id", () => {
  const navigate = vi.fn();
  const goBack = vi.fn();
  const goForward = vi.fn();
  const reload = vi.fn();
  const destroy = vi.fn();
  const openDevTools = vi.fn();
  const openExternal = vi.fn();
  stubBrowser({
    navigate,
    goBack,
    goForward,
    reload,
    openDevTools,
    openExternal,
    destroy,
  });
  useBrowserStore.setState({ viewId: "v1" });

  const s = useBrowserStore.getState();
  s.navigate("https://c.com");
  s.back();
  s.forward();
  s.reload();
  s.openDevTools();
  s.openExternal();
  s.destroy();

  expect(navigate).toHaveBeenCalledWith("v1", "https://c.com");
  expect(goBack).toHaveBeenCalledWith("v1");
  expect(goForward).toHaveBeenCalledWith("v1");
  expect(reload).toHaveBeenCalledWith("v1");
  expect(openDevTools).toHaveBeenCalledWith("v1");
  expect(openExternal).toHaveBeenCalledWith("v1");
  expect(destroy).toHaveBeenCalledWith("v1");
  expect(useBrowserStore.getState().viewId).toBeNull();
  expect(useBrowserStore.getState().state).toBeNull();
});

it("control intents are no-ops when there is no live view", () => {
  const navigate = vi.fn();
  const reload = vi.fn();
  const openDevTools = vi.fn();
  const openExternal = vi.fn();
  stubBrowser({ navigate, reload, openDevTools, openExternal });

  useBrowserStore.getState().navigate("https://x.com");
  useBrowserStore.getState().reload();
  useBrowserStore.getState().openDevTools();
  useBrowserStore.getState().openExternal();

  expect(navigate).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  expect(openDevTools).not.toHaveBeenCalled();
  expect(openExternal).not.toHaveBeenCalled();
});

it("subscribes once and releases the listener on teardown", () => {
  const off = vi.fn();
  const onState = vi.fn(() => off);
  stubBrowser({ onState });

  const s = useBrowserStore.getState();
  s.ensureSubscribed();
  s.ensureSubscribed();
  expect(onState).toHaveBeenCalledTimes(1);

  s.teardown();
  expect(off).toHaveBeenCalledTimes(1);
});
