# PRD — OMP Studio slice

Use the glossary in `.agents/contract/domain.md`. Publish durable specs as Linear documents on the OMP Studio project.

## Problem

What specific gap in OMP Studio this slice closes, in user-visible terms.

## Solution

The smallest outcome that resolves the gap while preserving OMP Studio's runtime and security boundaries.

## User stories

1. As an OMP Studio user, I want the slice outcome, so I can <benefit>.

## Decisions

Record only decisions this slice owns. Preserve these defaults unless the issue explicitly overrides them: terminal/browser stay user-initiated and gated; secrets stay in the OS keychain.

## Non-goals

- Capabilities outside the issue's acceptance criteria.
- Browser, terminal writes, GitHub/Linear writes, or paid live turns unless explicitly named.

## Acceptance criteria

- [ ] Observable, testable outcome.

## Proof plan

Map each criterion to the highest useful existing gate: unit/vitest, bun test, fake-JSONL RPC test, hermetic e2e smoke, or HITL live OMP proof.

## Open questions / further notes

Only unresolved facts that tools cannot answer. Route blocking unknowns to a research issue rather than expanding implementation scope.
