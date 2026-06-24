# AGE-### — slice title

## Goal

State the single tracer-bullet outcome in OMP Studio glossary terms.

## Context

- Project: OMP Studio.
- Parent: the relevant epic (e.g. AGE-655) unless this is a sub-issue.
- Repo: `DylanMcCavitt/omp-studio`.
- Prior decisions: terminal/browser are user-initiated and gated; secrets stay in the OS keychain, never tracked files.

## Acceptance

- [ ] Observable outcome 1.
- [ ] Observable outcome 2.

## Scope / non-goals

- In scope: the thinnest vertical slice that proves this issue.
- Non-goals: browser, terminal writes, GitHub/Linear writes, UI widgets, or native panels unless named by this issue.

## Dependencies

- Blocked by: AGE-### or none.
- Blocks: AGE-### or none.

## Execution

- Owner lane: codex or claude.
- Mode: AFK or HITL.
- Branch: use Linear's generated branch name; it must include the issue id.
- Worktree: `/private/tmp/omp-wt/age-###` unless the target repo contract overrides it.

## Proof

List the exact unit, vitest, bun, e2e-smoke, and HITL checks required to prove this slice without expanding scope.
