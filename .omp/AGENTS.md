# OMP Studio agent context

## Agent skills

This repo runs the Factorio workflow kit. The per-repo contract is in `.agents/contract/` — read it before planning or building:

- `linear-map.md` — Linear team/project/label/state map, HITL/AFK rules, and the GitHub bridge.
- `domain.md` — OMP Studio glossary and preserved architecture decisions.
- `commands.md` — build/test/lint/run commands for the app.
- `templates/` — repo-local PR, Linear issue, project-doc, and PRD templates.

Repo-specific skills and agents live in `.agents/skills/` and `.agents/agents/` when a real recurring workflow needs them. None are scaffolded yet; generic kit skills plus this contract are enough.

## Current track

- Repo: `DylanMcCavitt/omp-studio`, local checkout `port-omp`, default branch `main`.
- Linear team `dmcc` (key `AGE`), project `OMP Studio`.
- Production-readiness epic: `AGE-655`.
- OMP Studio is the Electron + electron-vite + React 18 desktop cockpit for the Oh My Pi (`omp`) coding-agent harness. All app work happens directly in this repo — there is no fork.

## Rules

- Preserve unrelated user changes.
- One Linear issue -> one branch/worktree -> one PR; branch names must carry the `AGE-###` id.
- Use `/private/tmp/omp-wt/<lowercase-issue-id>` for issue worktrees.
- Do not put secrets, keys, tokens, account IDs, or private environment values in tracked files.
- Terminal and browser writes are user-initiated and gated; agent frames never write directly to pty input, and the browser stays in its sandboxed boundary.
