# TASK-001: Add test for GET /health

## Status: pending

## Goal

Cover the existing `/health` endpoint with a pytest test to prevent regressions.

## File to edit

`tests/test_routes.py` (or create `tests/test_health.py`)

## Steps

1. Use `TestClient` from `conftest.py` fixture `client`.
2. `GET /health` → assert status 200, body contains `"status": "ok"`.
3. Run `pytest tests/ -v --tb=short` to verify.

## Acceptance criteria

- `pytest tests/test_health.py -v` passes.
- Covers both 200 and 503 scenarios (mock DB failure for 503).
