---
name: subagent-workflow
description: Run a small scoped implementation loop for a single task: Worker implements, Test-Runner executes pytest, Debugger fixes failures, Code-Reviewer validates; iterate until PASS. Use for small fixes, single endpoints, localized changes.
---

# Subagent Workflow (Small Tasks)

## Goal
Execute a reliable small-task loop with minimal diffs and a hard pytest gate.

## Workflow
1) Call `/worker` with the user request (or TASK file path if provided).
2) Call `/test-runner` (must run: `pytest tests/ -v --tb=short`).
3) If tests FAIL:
   - Call `/debugger` with the failing output and scope (“fix only current failure”).
   - Call `/test-runner` again.
   - Repeat up to 3 iterations.
4) Call `/code-reviewer` on the resulting changes.
5) If review FAIL:
   - Call `/worker` to address **only** critical issues.
   - Call `/test-runner`, then `/code-reviewer` again.
   - Repeat up to 2 iterations.
6) On PASS:
   - Update `coordination/HANDOFF.md` with what changed + verification command.
   - If user-facing behavior changed, update `docs/REPORT.md`.

## Outputs
- Passing pytest run (hard gate).
- `coordination/HANDOFF.md` updated.
- Optional: `docs/REPORT.md`.

## Guardrails
- Keep diffs minimal; avoid unrelated refactors.
- Do not introduce non-existent tooling (only pytest command above).
- If requirements are ambiguous: add a precise bullet to `docs/ACCEPTANCE.md`, then proceed with safest interpretation.