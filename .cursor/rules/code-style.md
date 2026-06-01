---
description: Use for Python/FastAPI code style and architectural consistency; keep changes minimal, readable, and aligned with existing patterns.
alwaysApply: false
---

# Code style (Python/FastAPI)

## General
- Prefer small, explicit functions and clear names.
- Avoid broad formatting churn and unrelated refactors.

## FastAPI
- Keep request/response schemas explicit (Pydantic models).
- Use consistent status codes and error payload conventions used in this repo.
- Avoid blocking I/O in async endpoints (if endpoints are async).

## DB (SQLAlchemy)
- Follow existing session lifecycle patterns.
- Avoid raw SQL; if needed, use parameterized queries and document why.

## Files and structure
- Put business logic in services where the repo already follows that pattern.
- Keep routers thin; move heavy logic out of endpoints.