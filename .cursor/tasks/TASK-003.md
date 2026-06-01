# TASK-003: Add Redis connectivity check to /health

## Status: pending

## Goal

Extend `/health` to report Redis status alongside the database check.

## Files to edit

- `backend/app/main.py` — `health_check()` function.
- `backend/app/queue_redis.py` — reuse existing Redis connection logic.

## Steps

1. Import Redis connection helper from `queue_redis.py`.
2. Try `redis_conn.ping()`; on failure, set `redis: "unavailable"` but do NOT return 503
   (Redis is optional — only DB failure should trigger 503).
3. Add `"redis": "connected"` or `"redis": "unavailable"` to response body.
4. Add test covering Redis up/down scenarios (mock `redis.ping()`).

## Acceptance criteria

- `GET /health` returns `{"status": "ok", "database": "connected", "redis": "connected"}`.
- If Redis is down: status stays 200, `"redis": "unavailable"`.
- If DB is down: status 503 regardless of Redis state.
