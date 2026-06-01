---
description: Use for any endpoint, parsing, DB access, background jobs, or Telegram integration; prevent injection, leaks, unsafe parsing, and unsafe shell usage.
alwaysApply: true
---

# Security baseline

## Input validation
- Treat all external input as untrusted (HTTP payloads, query params, files, HTML, Telegram messages).
- Validate and normalize inputs; reject unexpected types/lengths.

## Injection defenses
- No string-concatenated SQL. Prefer SQLAlchemy ORM/query builder.
- Avoid unsafe subprocess/shell execution; never construct shell commands from user input.

## Sensitive data handling
- Never log secrets/tokens/PII.
- Keep auth/session artifacts out of repo and docs.

## Parsing safety (pdf/docx/html)
- Assume PDFs/DOCX/HTML can be malicious or huge.
- Add basic guardrails where feasible: size limits, timeouts, and graceful failure.

## Queues (Redis/RQ)
- Jobs should be idempotent when possible.
- Handle retries safely; avoid duplicate side effects.