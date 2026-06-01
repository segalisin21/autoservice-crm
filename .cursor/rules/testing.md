---
description: Use for any code change; enforce the only valid test command and CI parity for this repo (pytest tests/ -v --tb=short).
alwaysApply: true
---

# Testing rules (CI parity)

## Hard gate
- The only valid test command is:
  `pytest tests/ -v --tb=short`
- This command must pass before declaring work done.

## When changing behavior
- Any behavior change requires adding/updating pytest tests under `tests/`.
- Any bug fix requires a regression test.

## FastAPI specifics
- Use existing `conftest.py` fixtures and `TestClient` patterns.
- Tests rely on in-memory SQLite where configured; keep tests isolated and deterministic.

## What NOT to do
- Do not introduce other test runners or commands (no npm/pnpm/mvn/Makefile).
- Do not add flaky time-based sleeps; prefer dependency injection/mocking where needed.