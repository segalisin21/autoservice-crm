---
name: office-parallel
description: Coordinate role-based “AI office” delivery (Dev/Design/QA/Security) using shared HANDOFF and docs outputs; can run sequentially or with Parallel Agents. Use when you need a release-ready package: code + QA report + security notes + UX spec.
---

# Office Parallel (Role-Based Delivery)

## Goal
Produce a release-ready package by dividing responsibilities across roles and consolidating outputs.

## Roles & Responsibilities
- Dev: implement via `/implement` (small) or `/orchestrate` (large); ensure pytest passes.
- Design: update `docs/DESIGN.md` (flows, states, copy, edge cases).
- QA: write `docs/QA_REPORT.md` and `docs/bugs/BUG-###.md`.
- Security: update `docs/SECURITY.md` with findings and mitigations.

## Workflow
1) Initialize `coordination/HANDOFF.md` with:
   - scope, current stage, verification command
2) Run roles in parallel (Parallel Agents) or sequentially:
   - Design first for clarity, Dev in parallel if possible, QA/Security near the end.
3) Dev runs final gate:
   - `pytest tests/ -v --tb=short`
4) Consolidate:
   - Ensure `docs/REPORT.md` includes “how to use” and “how to verify”.
   - Ensure HANDOFF has final status and verification steps.

## Outputs
- Code changes + passing pytest gate.
- `docs/DESIGN.md`, `docs/QA_REPORT.md`, `docs/SECURITY.md`, `docs/REPORT.md`.
- `coordination/HANDOFF.md` as the single source of truth.

## Guardrails
- Do not let QA/Security modify core code unless explicitly requested; they should write findings/docs.
- Dev is responsible for final integration and test gate.
- Keep outputs file-based (docs + HANDOFF) to avoid losing decisions in chat history.