# Project Delete → Hide Transition

**Created**: 2026-03-15
**Status**: Implemented (2026-03-16)

---

## Background

Currently the project delete button (`DELETE /api/projects/{id}`) **hard deletes** the project from the DB.
Since components already adopted the "hide instead of delete (soft_delete → trash)" strategy,
projects should follow the same pattern for consistency.

---

## Changes

### DB Schema

- Added `hidden_at TEXT` column to `projects` table (NULL = active, ISO 8601 = hidden)
- `CREATE INDEX idx_projects_hidden_at ON projects(hidden_at)`
- Existing DB migration: `ALTER TABLE projects ADD COLUMN hidden_at TEXT`

### API Changes

| Endpoint | Change |
|----------|--------|
| `GET /api/projects` | Added `include_hidden` query parameter (default: false) |
| `DELETE /api/projects/{id}` | Hard delete → soft delete (hide) |
| `PATCH /api/projects/{id}/hide` | New — hide project |
| `PATCH /api/projects/{id}/unhide` | New — restore hidden project |

### Hidden Project Data Isolation

The following APIs exclude data from hidden projects:

| API / Function | Handling |
|---------------|----------|
| `GET /api/projects` | Default filter `WHERE hidden_at IS NULL` |
| `GET /api/components` | `list_all_with_project(exclude_hidden_projects=True)` |
| `GET /api/components/recent` | `list_all(exclude_hidden_projects=True)` |
| `GET /api/components/{id}` | `_guard_hidden_project()` — returns 404 if belonging to hidden project |
| `GET /api/projects/{id}/components` | `project.hidden_at` check — returns 404 if hidden project |
| `GET /api/stats` | `list_all(exclude_hidden_projects=True)` |
| `GET /api/stats/context` | `list_all(exclude_hidden_projects=True)` |
| `GET /api/dependencies` | SQL condition `project_id NOT IN (hidden)` |
| `GET /api/dependencies/{id}` | Returns 404 if component belongs to hidden project |
| `list_conflicts()` | SQL condition `p.hidden_at IS NULL` |
| `UsageScanner` | `WHERE hidden_at IS NULL` |
| `POST /api/scan` | `list_all()` default excludes hidden projects |
| `GET /api/system/scan-progress` | Filters hidden projects from response |
| `GET /api/trash` | `list_trash()` SQL excludes hidden projects |
| `get_unused_components()` | SQL excludes hidden projects |

### Write Path Isolation

Write operations on hidden projects are also blocked:

| API | Handling |
|-----|----------|
| `POST /api/components` | `project.hidden_at` check — returns 404 if hidden project |
| `PUT /api/components/{id}` | `_guard_hidden_project()` |
| `POST /api/components/{id}/toggle` | `_guard_hidden_project()` |
| `POST /api/components/{id}/copy` | Both source and target checked for `hidden_at` |
| `POST /api/projects/{id}/preset-preview` | `project.hidden_at` check |
| `POST /api/projects/{id}/apply-preset` | `project.hidden_at` check |
| `POST /api/scan` (with project_id) | `hidden_at` check → returns 409 |

### Cases That Intentionally Include Hidden Projects

| API / Function | Reason |
|---------------|--------|
| `POST /api/system/factory-reset` | Full reset deletes all data |
| `DELETE /api/config/root-paths` | Workspace removal hard deletes hidden projects too |
| `POST /api/scan` (path duplicate check) | Prevents re-registering hidden project paths |
| `_validate_project_path()` | Path duplicate validation includes hidden projects |
| `GET /api/projects/{id}` | Allows detail view for hidden project restore UI |
| Backup/Restore | Preserves data integrity |

### Design Decisions

1. **Rescan forbidden for hidden projects** — `rescan()` raises ValueError when `hidden_at IS NOT NULL`
2. **Global project cannot be hidden** — `is_global=True` raises ValueError
3. **`remove_project()` retained** — Hard delete used by factory_reset etc. remains as-is
4. **Components not separately deleted** — Hiding a project automatically excludes its components from queries
5. **FileWatcher symmetry** — `unwatch()` on hide, `watch()` re-registration on unhide

### Frontend Changes

- Delete button (Trash2) → Hide button (EyeOff) + "Hide" text
- Confirmation modal: "Delete?" → "Hide? You can restore anytime."
- Collapsible "Hidden Projects" section at bottom of project list (with restore button)
- Hide button added to project detail page header (left of collection apply button)
- Toast: "Deleted" → "Hidden" / "Restored"

---

## Changed Files

### Core (`packages/core/`)
- `vibesmith_core/infra/db.py` — Schema + migration
- `vibesmith_core/components/models.py` — Project.hidden_at field
- `vibesmith_core/projects.py` — list_all, hide, unhide, rescan guard
- `vibesmith_core/components/operations.py` — exclude_hidden_projects filter, list_trash isolation
- `vibesmith_core/components/conflicts.py` — Exclude hidden projects from conflicts
- `vibesmith_core/usage/scanner.py` — Exclude hidden projects from usage
- `vibesmith_core/usage/repo.py` — get_unused_components excludes hidden projects

### API (`packages/api/`)
- `routes/projects.py` — hide/unhide endpoints, DELETE→hide, preset guard
- `routes/components.py` — `_guard_hidden_project()` helper, read/write path isolation
- `routes/dashboard.py` — stats, context exclude hidden projects
- `routes/dependencies.py` — Dependency graph + detail exclude hidden projects
- `routes/scan.py` — Exclude hidden projects from scan targets, rescan returns 409
- `routes/system.py` — Filter hidden projects from scan-progress response
- `routes/config.py` — Include hidden projects on workspace removal
- `schemas.py` — ProjectResponse.hidden_at
- `i18n/` — 4 new translation keys (project_hidden, project_hidden_cannot_rescan, project_unhidden, etc.)

### Web (`packages/web/`)
- `features/dashboard/types/` — hidden_at, hiddenAt types
- `features/dashboard/services/api.ts` — include_hidden, unhideProject
- `features/dashboard/hooks/useDashboardData.ts` — useUnhideProject
- `features/dashboard/components/ProjectBar.tsx` — EyeOff icon, hide button
- `features/dashboard/components/ConfirmDeleteProjectModal.tsx` — Hide modal
- `features/project-detail/ProjectDetailPage.tsx` — Detail page hide button
- `pages/ProjectsPage.tsx` — Collapsible hidden projects section
- `i18n/locales/` — Korean/English translations
