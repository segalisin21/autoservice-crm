# TASK-002: Add version field to /health response

## Status: pending

## Goal

Include an `"app_version"` field in the health-check response for deployment tracking.

## File to edit

`backend/app/main.py` — `health_check()` function (line ~797).

## Steps

1. Read version from `APP_VERSION` env var (default `"dev"`).
2. Add `"version": app_version` to both 200 and 503 responses.
3. Update test from TASK-001 if already merged.

## Acceptance criteria

- `GET /health` returns `{"status": "ok", "database": "connected", "version": "..."}`.
- Version defaults to `"dev"` when `APP_VERSION` is unset.
