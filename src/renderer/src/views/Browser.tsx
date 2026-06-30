// Feature 8 — embedded browser panel. The renderer renders ONLY the chrome
// (BrowserChrome) and an empty placeholder div; the actual web page is a
// main-owned, sandboxed `WebContentsView` overlaid on the placeholder rect. The
// main renderer window never loads remote content, so its CSP stays `'self'`.
//
// Off by default (`settings.browser.enabled`). When disabled we show an honest
// enable gate: the embedded browser loads UNTRUSTED remote content in a
// separate sandboxed view — we state the model plainly and never call it
// "secure". On unmount all views are destroyed and the subscription released.

import { Globe, Navigation, ShieldAlert } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { BrowserChrome } from "@/components/browser/BrowserChrome";
import { useBrowserBounds } from "@/components/browser/useBrowserBounds";
import { Button, EmptyState } from "@/components/ui";
import type { BrowserBounds } from "@/store/browser";
import { useBrowserStore } from "@/store/browser";
import { useSettingsStore } from "@/store/settings";

export default function Browser() {
  const enabled = useSettingsStore(
    (s) => s.settings?.browser?.enabled ?? false,
  );
  const updateSettings = useSettingsStore((s) => s.update);

  const tabs = useBrowserStore((s) => s.tabs);
  const viewId = useBrowserStore((s) => s.viewId);
  const state = useBrowserStore((s) => s.state);
  const history = useBrowserStore((s) => s.history);
  const error = useBrowserStore((s) => s.error);
  const creating = useBrowserStore((s) => s.creating);
  const ensureSubscribed = useBrowserStore((s) => s.ensureSubscribed);
  const teardown = useBrowserStore((s) => s.teardown);
  const createTab = useBrowserStore((s) => s.create);
  const switchTo = useBrowserStore((s) => s.switchTo);
  const closeTab = useBrowserStore((s) => s.close);
  const navigate = useBrowserStore((s) => s.navigate);
  const back = useBrowserStore((s) => s.back);
  const forward = useBrowserStore((s) => s.forward);
  const reload = useBrowserStore((s) => s.reload);
  const openDevTools = useBrowserStore((s) => s.openDevTools);
  const openExternal = useBrowserStore((s) => s.openExternal);
  const destroyAll = useBrowserStore((s) => s.destroyAll);

  const placeholderRef = useRef<HTMLDivElement>(null);
  useBrowserBounds(viewId, placeholderRef);
  const createBlankTab = useCallback(() => {
    void createTab({
      url: "",
      bounds: getPlaceholderBounds(placeholderRef.current),
    });
  }, [createTab]);

  // While this view is mounted (and the capability is on): subscribe to state
  // pushes BEFORE creating, create the first blank tab once the placeholder has
  // a measurable rect, then destroy every view + release the subscription on
  // unmount (route change) or when the capability is turned off.
  useLayoutEffect(() => {
    if (!enabled) return;
    ensureSubscribed();
    if (
      placeholderRef.current &&
      useBrowserStore.getState().tabs.length === 0
    ) {
      createBlankTab();
    }
    return () => {
      destroyAll();
      teardown();
    };
  }, [enabled, ensureSubscribed, createBlankTab, destroyAll, teardown]);

  if (!enabled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={<Globe className="h-8 w-8" />}
          title="Embedded browser is off"
          hint={
            <>
              Turning this on loads <strong>untrusted remote web pages</strong>{" "}
              inside OMP Studio. The page runs in a separate, sandboxed view
              with its own ephemeral session — isolated from the app, your
              files, and the OMP bridge — but it can still reach the internet
              and run whatever any web page can. It is not a hardened or{" "}
              {'"secure"'} browser; enable it only if you accept that risk.
            </>
          }
          action={
            <Button
              variant="primary"
              onClick={() =>
                void updateSettings({ browser: { enabled: true } })
              }
            >
              <ShieldAlert className="h-4 w-4" />
              Enable embedded browser
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <BrowserChrome
        tabs={tabs}
        activeTabId={viewId}
        state={state}
        history={history}
        onCreateTab={createBlankTab}
        onSwitchTab={switchTo}
        onCloseTab={closeTab}
        onNavigate={navigate}
        onBack={back}
        onForward={forward}
        onReload={reload}
        onOpenDevTools={openDevTools}
        onOpenExternal={openExternal}
      />
      <BrowserPanelState
        state={state}
        error={error}
        hasTabs={tabs.length > 0}
        creating={creating}
        onCreateTab={createBlankTab}
      />
      {/* Empty overlay target — the main-owned WebContentsView is positioned on
          top of this rect (see useBrowserBounds); no remote content lives here. */}
      <div ref={placeholderRef} className="min-h-0 flex-1" />
    </div>
  );
}

function BrowserPanelState({
  state,
  error,
  hasTabs,
  creating,
  onCreateTab,
}: {
  state: { url: string; loading: boolean; error?: string } | null;
  error: string | undefined;
  hasTabs: boolean;
  creating: boolean;
  onCreateTab: () => void;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="border-b border-danger/30 px-4 py-3 text-sm text-danger"
      >
        Browser view failed to start: {error}
      </div>
    );
  }

  if (!hasTabs) {
    if (creating) return null;

    return (
      <div className="border-b border-border-subtle bg-bg-panel px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-ink">No browser tabs are open.</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Open a new tab before entering an address.
            </p>
          </div>
          <Button variant="subtle" onClick={onCreateTab}>
            <Globe className="h-4 w-4" />
            New browser tab
          </Button>
        </div>
      </div>
    );
  }

  if (state?.url || state?.loading || state?.error) return null;

  return (
    <div className="border-b border-border-subtle bg-bg-panel px-4 py-3">
      <div className="flex items-start gap-3 text-sm">
        <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <p className="font-medium text-ink">Start with an http(s) URL.</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Enter a website above. The page opens in an isolated, ephemeral
            WebContentsView with no preload, Node access, OMP bridge, or agent
            auto-control.
          </p>
        </div>
      </div>
    </div>
  );
}

function getPlaceholderBounds(el: HTMLDivElement | null): BrowserBounds {
  const r = el?.getBoundingClientRect();
  return {
    x: Math.round(r?.left ?? 0),
    y: Math.round(r?.top ?? 0),
    width: Math.round(r?.width ?? 0),
    height: Math.round(r?.height ?? 0),
  };
}
