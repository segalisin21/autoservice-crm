---
description: Use when asked to push/commit/merge/PR or publish changes to remote; enforce test-first workflow and minimal diffs.
alwaysApply: true
---

# Git workflow: test-first

## Push policy
When user asks "push", "publish", "upload", "merge", "PR", or when changes must be sent to remote:

1) **По умолчанию** push в ветку **test**:
   - `git push origin <current-branch>:test` (или `git push origin test` если на ветке test)

2) Push в **develop** только по явному запросу (например «пуш в дев», «залей в develop»).

3) Push в **main** только по явному запросу (например «deploy», «пуш в прод», «залей в main»).

## Change hygiene
- Keep diffs minimal and task-scoped.
- Do not mix refactors with features.
- If large refactor is needed, split into separate PRs.

## Traceability
- Update `coordination/HANDOFF.md` with what changed + verification command.
