# Domain glossary — OMP Studio

Use these nouns in Linear issues, specs, PRs, and review packets. Avoid inventing parallel names.

## Product

| Term | Meaning |
| --- | --- |
| OMP Studio | The Electron desktop cockpit for the Oh My Pi (`omp`) coding-agent harness. |
| omp / OMP harness | The coding-agent CLI/runtime this app drives. |
| Workspace | A project root the user opens; threads/sessions run against its cwd. |

## Stack & process model

| Term | Meaning |
| --- | --- |
| Main | Electron main process (`src/main`): omp RPC bridge, services, terminal/browser backends, IPC. |
| Renderer | React 18 UI (`src/renderer`): Zustand stores, Tailwind v3, react-resizable-panels, lucide icons. |
| Preload | Context-bridge surface (`src/preload`) exposing the typed `window.omp` API. |
| Shared | Cross-process contracts (`src/shared`): `ipc.ts` (channels + `OmpApi`), `domain.ts` (domain types), `rpc.ts` (omp protocol types). |
| Gates | `biome` (lint/format), `tsc` typecheck, `vitest` (renderer), `bun test` (node/test dir), Playwright `_electron` e2e, `electron-vite build`. See `commands.md`. |

## Runtime / RPC

| Term | Meaning |
| --- | --- |
| OMP child | The real `omp` process driven over JSONL stdio from the main process (`src/main/omp`). |
| JSONL frame | One newline-delimited protocol object to/from the OMP child. |
| RPC bridge | Main-process layer that spawns the OMP child and maps frames to IPC events/results. |
| Session lifecycle | Spawn, ready, prompt, stream, idle, cancel/abort, close, child-process teardown. |
| Transcript provenance | The visible source path / session id needed to resume or inspect a session later. |
| Live vs hibernated session | A live session has a running child; a hibernated session is restored from its JSONL transcript with no child. |

## Surfaces

| Term | Meaning |
| --- | --- |
| Right icon rail + expandable panels | The right-side nav rail and the panels it opens (stats, todos, subagents, terminal, browser, etc.). |
| Subagent tree / inspector | Live hierarchy of OMP subagent lifecycle/progress frames, with a full-view transcript drill-in. |
| Drill-in | Opening a subagent/session transcript or event stream from the tree into the center view. |
| Terminal panel | In-app shell: `xterm` renderer over a `node-pty` child (`src/main/terminal`). User-initiated, gated. |
| Browser panel | Sandboxed `WebContentsView` browser (`src/main/browser`). User-initiated, gated. |
| Files | Workspace-scoped file tree + CodeMirror 6 editor tabs. |
| Read-only bridge | GitHub / Linear context access that cannot mutate external state. |

## Security boundaries (preserve)

- Browser boundary: separate sandboxed WebContents, http(s)-only navigation, no OMP bridge/preload/Node, ephemeral storage by default, no agent auto-control.
- Terminal/task: user-initiated, off by default. Agent frames never write directly to pty input.
- Secrets never cross UI/runtime/log/transcript boundaries; use the OS keychain via `safeStorage`, never tracked files.

## Ownership lanes

| Lane | Owner label |
| --- | --- |
| UI/design/presentation/visual polish | `team:ui` (typically `model:opus`). |
| Runtime/backend/integration/test/infra | `team:platform`. |
| Security-boundary review | Platform/security reviewer unless the issue assigns another owner. |
