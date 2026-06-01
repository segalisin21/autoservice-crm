---
description: Use when creating commits; enforce consistent commit messages, scoped changes, and clear intent.
alwaysApply: false
---

# Commit message rules

## Format
Use one of:
- `feat(<scope>): <summary>`
- `fix(<scope>): <summary>`
- `refactor(<scope>): <summary>`
- `test(<scope>): <summary>`
- `docs(<scope>): <summary>`
- `chore(<scope>): <summary>`

## Guidelines
- Summary is imperative and specific (no “update stuff”).
- One commit = one logical change.
- Reference task/issue IDs if your workflow uses them.

## Examples
- `feat(api): add /health endpoint`
- `fix(parser): handle empty PDF pages`
- `test(api): add coverage for saved searches filters`