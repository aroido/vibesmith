# Usage Aggregation Per-Platform Deduplication Design

**Created**: 2026-03-15
**Status**: Implemented

---

## Background

### Current Behavior

The `GET /api/usage` `dedupe_by_session` parameter defaults to `true`.
In this mode, aggregation uses `COUNT(DISTINCT session_id)`, so calling a command multiple times within the same session is counted as **only 1**.

### Why It Was Set This Way (Issue #954 → #951)

There was an **over-counting (noise)** problem in Cursor's `state.vscdb` parsing.
Cursor's structure produces multiple records referencing the same component within a session,
so simple `SUM(use_count)` yielded inflated numbers far beyond actual usage.

So `dedupe_by_session=true` was set as the default to reduce Cursor noise,
but this setting was **also applied to Claude Code**, causing a side effect where actual multiple calls within the same session in Claude Code were reduced to 1.

### Example Case

A user called the `morning-marketing` command 3 times today in the herald project, but only 2 were counted:
- 2 calls in Session A (use_count=2) → dedupe to **1**
- 1 call in Session B (use_count=1) → **1**
- Total: actual 3, displayed 2

---

## Requirements

Different aggregation strategies must be applied per platform:

| Platform | Aggregation Method | Reason |
|----------|-------------------|--------|
| Claude Code | `SUM(use_count)` — actual call count | Accurate usage reflection |
| Cursor | `COUNT(DISTINCT session_id)` — 1 per session | Removes parsing noise |

---

## Implementation Direction (Under Review)

### Adding `dedupe_by_session="auto"` Mode

Add an `auto` mode to the `get_usage_ranking()` function with per-platform branching in SQL:

```sql
-- Cursor rows: session dedup
COUNT(DISTINCT CASE WHEN sess.project_path LIKE 'cursor:%' THEN us.session_id END)
+
-- Claude Code rows: use_count sum
SUM(CASE WHEN sess.project_path NOT LIKE 'cursor:%' THEN us.use_count ELSE 0 END)
```

### API Changes

- `dedupe_by_session` parameter: `bool` → `Literal["auto", "true", "false"]`
- Default: `"auto"` (auto-applies per platform)
- Backward compatible: `true`/`false` strings maintain existing behavior

### Impact Scope

- `packages/core/vibesmith_core/usage/repo.py` — `get_usage_ranking()` SQL branching
- `packages/api/vibesmith_api/routes/usage.py` — Parameter type/default change
- `packages/api/vibesmith_api/schemas.py` — Response schema type change
- `docs/api/spec.md` — API documentation update

---

## Additional Finding: PostToolUse Over-Counting Issue

When applying `dedupe_by_session=false` (or `auto`'s Claude Code mode),
**PostToolUse** hooks show overwhelmingly high numbers that make all other metrics meaningless.

PostToolUse is a hook automatically triggered on every tool call,
so use_count accumulates for each tool call within a session.
As a result, PostToolUse always ranks #1 in usage rankings,
and actually meaningful command/skill usage appears relatively tiny.

### Resolution Direction (Under Review)

- **System hook filtering**: Exclude system auto-hooks like PostToolUse, PreToolUse from rankings
- **Separate hook and skill/command aggregation**: Provide separate rankings by type
- **Weight adjustment**: Apply lower weights to auto-triggered hooks
- **Stricter matched_only filter**: More strictly exclude system built-in component matches

---

## Next Steps

Proceed with detailed design via `/ralplan` → TDD implementation via `/ralph`
