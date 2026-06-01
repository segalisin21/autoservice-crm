# /office

You MUST use the skill: office-parallel.

Instruction:
- Split the user request into parallel roles: Dev/Design/QA/Security.
- Tell exactly which files each role must update:
  - Dev: code + docs/REPORT.md
  - Design: docs/DESIGN.md
  - QA: docs/QA_REPORT.md + docs/bugs/
  - Security: docs/SECURITY.md
- Require everyone to append to coordination/HANDOFF.md.
- Final gate: npm test