# Rescan & Data Synchronization Architecture Design

**Created**: 2026-03-13
**Updated**: 2026-03-15
**Status**: Design finalized

---

## Background

Currently, rescan/sync features span multiple layers, and data inconsistency scenarios exist.
This document consolidates the synchronization strategy and defines the problems to solve.

---

## 1. Button Structure

### Sync Button (Existing, retained)

- **Location**: Settings page
- **Behavior**: `useUnifiedSync` — Smart auto-detection
  - Component count mismatch or 15 minutes elapsed → Full Rescan
  - Otherwise → Quick Refresh (cache invalidation)
- **Usage data**: Records from already-deleted session logs are **preserved**

### Danger Zone (New)

- **Location**: Bottom of Settings page, red-themed card
- **Behavior**: Full reset + rescan
  - Deletes all recoverable data and rescans from scratch
  - **Pre-warns** that unrecoverable data will be deleted
- **Confirmation alert required**: Shows "The following data will be permanently deleted: ..."

---

## 2. Reset Scope Comparison

### Sync (Normal Rescan)

| Target | Behavior |
|--------|----------|
| components | Filesystem-based rescan (merge) |
| dependencies | Re-analysis |
| usage_sessions | Delete only those with existing session log files → recover via re-parsing. **Records from already-deleted session logs are preserved** (unrecoverable) |
| usage_parse_state | Full delete → re-parse from start |
| projects | Retained |
| presets/collections | Retained |
| config.json | Retained |

### Danger Zone (Full Reset + Rescan)

| Target | Behavior | Recoverable? |
|--------|----------|--------------|
| components | Full delete → rescan | Yes, from filesystem |
| dependencies | Full delete → re-analyze | Yes, via re-analysis |
| usage_sessions | **Full delete** | Caution: Records from deleted session logs are unrecoverable |
| usage_parse_state | Full delete | Yes, re-parse from start |
| projects | Full delete → rediscover from root_paths | Yes, via rediscovery |
| presets/collections | **Preserved** | — User-created data (stores component content as snapshots, no ID references) |
| config.json | **Preserved** | — Configuration data |

### Danger Zone Alert Text (Required)

```
Warning: Full Reset
The following data will be permanently deleted:
- All component data (recoverable via rescan)
- All usage statistics (records from deleted session logs are unrecoverable)
- All dependency data (recoverable via re-analysis)

Data that will be preserved:
- Presets/collections
- Settings (root_paths, home_path, etc.)

Do you want to continue?
```

---

## 3. Rescan Logic Improvements (Detailed Design)

### Component Handling Matrix During Rescan

| Disk State | DB State | Rescan Action |
|------------|----------|---------------|
| File exists | Not in DB | Add new component |
| File exists | In DB (active) | Update metadata |
| File exists | In DB (hidden/trash) | Update metadata (maintain hidden state) |
| File missing | In DB (active) | Transition to hidden (move to trash) |
| File missing | In DB (hidden/trash) | **Hard delete** (permanently remove from DB) |

### Design Decisions

- **No rename detection**: If a file is renamed, the old component becomes "file missing + active" → transitions to hidden, and the new name is added as a new component. Simple and no risk of false positives.
- **Automatic orphan dependency resolution**: Excluding hidden components from dependency analysis means orphan dependencies naturally disappear during re-analysis. No separate cleanup logic needed.
- **Disk recreation detection**: "File exists + hidden" → Update metadata but maintain hidden state. User must explicitly restore to activate.

### Problem-Solution Mapping

| Problem | Solution |
|---------|----------|
| File rename → ghost records | "File missing + active" → transition to hidden |
| Soft delete accumulation | "File missing + hidden" → hard delete cleanup |
| Deleted component dependencies | Exclude hidden components from analysis → automatic resolution |
| File recreated on disk | "File exists + hidden" → update (maintain hidden) |
| Session log manually deleted | Check file existence then clean up parse_state |

---

## 4. Danger Zone API Design

### Endpoint

```
POST /api/system/factory-reset
```

### Operation Sequence

1. Stop workers (UsageScanner, FileWatcher) — **wait for scan_lock then stop**
2. Reset DB tables (components, dependencies, usage_sessions, usage_parse_state, projects, activities)
   - `usage_sessions` and `usage_parse_state` reference `project_path` as strings without FK → **separate DELETE required** (CASCADE does not apply)
3. Preserve presets/collections and config.json
4. Rediscover projects from root_paths
5. Full project rescan
6. Re-analyze dependencies
7. Restart workers
8. Return response

### Response

```json
{
  "scanned_projects": 5,
  "total_components": 42,
  "usage_reset": true
}
```

---

## 5. Root Path Removal (Detailed Design)

### Endpoint

Extends existing `DELETE /api/config/root-paths`

### Operation Sequence

1. Frontend: Show confirmation alert — "N projects under this root path and related data will be deleted"
2. Remove the path from `root_paths`
3. Identify child projects (`Path(project.path).resolve().relative_to(root_path)`)
4. Hard delete child projects (CASCADE removes components, dependencies, activities)
5. Manually clean up usage data for those projects (see caveat below)
6. Unwatch those projects from FileWatcher
7. Save config.json

### Usage Data Cleanup Caveat

`usage_sessions` and `usage_parse_state` reference projects via `project_path` (string), with **no FK, so CASCADE does not apply.** Therefore, when hard deleting projects, manual cleanup is required:

```sql
DELETE FROM usage_sessions WHERE project_path = ?
DELETE FROM usage_parse_state WHERE project_path = ?
```

If this cleanup is missed, orphan records remain in the DB causing statistics contamination.

### Response

```json
{
  "removed_root": "/Users/dev/projects",
  "deleted_projects": 3
}
```

---

## 6. Worker Auto-Restart (Detailed Design)

### Implementation

Separate monitoring timer (`WorkerSupervisor`)

### Behavior

- Check `is_running` / `is_alive()` every 30 seconds
- Restart dead workers by re-calling `start()`
- Log on restart: `logger.warning("Worker restarted: {worker_name}")`
- Escalate log level on consecutive failures (optional)

### Monitored Targets

| Worker | Check Method | Restart Method |
|--------|-------------|----------------|
| UsageScanner | `is_running` property | `start()` |
| FileWatcher | `is_alive()` (watchdog Observer) | `stop()` → `start()` |

### Lifecycle

- Start WorkerSupervisor during server startup (`lifespan`)
- Stop WorkerSupervisor during server shutdown
- Runs as daemon thread (terminates with main process)

---

## 7. Data Leak Issues on Project Removal/Hide

> **Tracked as separate issue**: To be resolved alongside the "project delete → hide transition" feature.
> Root path removal uses Hard Delete so CASCADE handles it,
> but when introducing individual project hiding (soft delete), fixing the data leak issues below is mandatory.

| API | Current Behavior | Fix Needed |
|-----|-----------------|------------|
| GET /api/components/recent | Returns all components (no filter) | Exclude hidden projects |
| GET /api/stats | Sums all projects | Exclude hidden projects |
| GET /api/stats/context | All if no project_id | Exclude hidden projects |
| UsageScanner._get_registered_projects() | Scans all projects | Exclude hidden projects |
| list_conflicts() (project_id=None) | Compares all projects | Exclude hidden projects |

---

## 8. Decision History

| Date | Item | Decision |
|------|------|----------|
| 2026-03-13 | Root path removal | Hard Delete |
| 2026-03-13 | Individual project deletion | Changed to hide (separate issue) |
| 2026-03-13 | Danger Zone UI | Bottom of Settings, red card |
| 2026-03-13 | Rescan logic improvement | Handle in one pass |
| 2026-03-13 | Worker health check | Add auto-restart only (status display already exists) |
| 2026-03-14 | Rename detection | Not implemented — simplified with hide transition on missing files |
| 2026-03-14 | Soft delete cleanup | Trash is a hidden archive. Hard delete when files are removed from disk |
| 2026-03-14 | Dependency orphans | Exclude hidden components from analysis → automatic resolution |
| 2026-03-14 | Danger Zone API | `POST /api/system/factory-reset` — reset + rescan in one call |
| 2026-03-14 | Root path removal confirmation | Alert required — "N projects will be deleted" |
| 2026-03-14 | Worker restart method | 30-second interval monitoring timer (WorkerSupervisor) |
| 2026-03-15 | Usage FK absence | usage_sessions/parse_state use project_path string reference → manual cleanup required on deletion |
| 2026-03-15 | Factory Reset worker stop | Wait for scan_lock then stop (prevent partial scan) |

---

## 9. Agent Verification Results (2026-03-15)

Design verified using 5 domain agents (Project, Component, Dependency, Usage, Worker).

### Design Validity Confirmed

| Item | Result |
|------|--------|
| DB CASCADE structure (components → dependencies, usage_stats) | Correct |
| Hidden component dependency exclusion (`list_all()` filters `deleted_at IS NULL`) | Already working |
| Rename non-detection decision (CASCADE + broken edge detection) | Sufficiently safe |
| Preset preservation (snapshot approach, no ID references) | Safe |
| enabled vs deleted_at distinction (UI disable vs trash) | No confusion, clearly separated |
| Worker interface (is_running, start/stop/unwatch) | All implemented |

### Design Gaps Found

| Issue | Severity | Action |
|-------|----------|--------|
| `usage_sessions`/`usage_parse_state` use `project_path` string without FK → CASCADE does not apply | High | Manual cleanup logic specified in sections 4 and 5 (reflected in this update) |
| Factory Reset needs scan_lock wait after worker stop (prevent partial scan) | Medium | Reflected in section 4 operation sequence |

---

## 10. Related Issues (Tracked Separately)

- **Project hide feature**: Convert individual project "delete" to "hide" + fix section 7 data leaks
- **Unresolved dependency tracking**: `docs/architecture/unresolved-dependencies.md`
