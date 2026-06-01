---
description: Use when user-facing behavior, API, flows, or operational steps change; keep project docs and handoff notes up to date.
alwaysApply: false
---

# Documentation rules

## Update docs when behavior changes
- If API/routes/response contracts change: update `docs/REPORT.md`.
- If flows/states/copy/edge cases matter: update `docs/DESIGN.md`.
- If testing strategy/checklists change: update `docs/TEST_PLAN.md`.
- If QA findings exist: update `docs/QA_REPORT.md` and add bug files under `docs/bugs/`.
- If security considerations change: update `docs/SECURITY.md`.

## Always update HANDOFF
- Append to `coordination/HANDOFF.md`:
  - What changed
  - Key files
  - How to verify: `pytest tests/ -v --tb=short`
  - Risks / known limitations