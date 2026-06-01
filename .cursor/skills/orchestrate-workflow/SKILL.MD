---
name: orchestrate-workflow
description: Orchestrate large tasks/roadmaps via planning + task files: Planner creates PLAN/TASK-###, then for each TASK run Worker -> pytest -> Debugger (if needed) -> Code-Reviewer until PASS; finish with QA and Security docs. Use for big features, multi-step changes, roadmaps.
---

# Orchestrate Workflow (Large Tasks)

## Goal
Deliver large features with bounded context usage by splitting into TASK files and iterating per TASK.

## Workflow
1) Call `/planner` to create:
   - `.cursor/tasks/PLAN.md`
   - `.cursor/tasks/TASK-001.md`, `TASK-002.md`, ...
2) Call `/designer` once to define states/copy/edge cases in `docs/DESIGN.md`.
3) For each TASK in PLAN order:
   1) Call `/worker` with the TASK file path (implement ONLY this TASK).
   2) Call `/test-runner` (pytest gate).
   3) If FAIL: `/debugger` -> `/test-runner` (max 3 per TASK).
   4) Call `/code-reviewer`.
   5) If FAIL: `/worker` fixes **only** critical issues -> `/test-runner` -> `/code-reviewer` (max 2).
   6) Mark TASK done in `PLAN.md` with a one-line note (what changed).
4) After all TASKs:
   - Call `/qa-tester` to write `docs/QA_REPORT.md` and `docs/bugs/BUG-###.md`.
   - Call `/security-auditor` to update `docs/SECURITY.md`.
   - Update `docs/REPORT.md` with usage + verification.

## Outputs
- `.cursor/tasks/PLAN.md` + TASK files (traceable execution).
- Passing pytest (`pytest tests/ -v --tb=short`).
- `docs/DESIGN.md`, `docs/QA_REPORT.md`, `docs/SECURITY.md`, `docs/REPORT.md`.
- `coordination/HANDOFF.md` updated.

## Guardrails
- One TASK at a time; do not implement the whole roadmap in a single Worker run.
- Hard gate: pytest must pass at the end of every TASK cycle.
- Keep changes incremental to reduce blast radius.