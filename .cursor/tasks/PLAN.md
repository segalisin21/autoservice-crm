# PLAN — Приоритеты 1-2-3

## Цель
Починить failing тесты, усилить безопасность, упростить онбординг.

## Tasks

| ID | Описание | Статус |
|---|---|---|
| TASK-001 | Починить 3 failing теста (conftest, telegra, enricher) | DONE |
| TASK-002 | Security headers + rate limit на /check-resume | DONE |
| TASK-003 | Упрощение онбординга (quick-register после check-resume) | DONE |

## Финальная проверка
```bash
pytest tests/ -v --tb=short
```
Результат: **80 passed, 0 failed, 2 skipped**.
