# VibeSmith API — Server Internals

**Package**: `vibesmith-api` (v0.1.0)
**Path**: `packages/api/`
**Python**: >=3.11

---

## 1. Overview

`vibesmith_api` is a FastAPI-based REST server that imports `vibesmith_core` and exposes a JSON API for the frontend. Endpoint specs are defined in `docs/03_API_SPEC.md`.

This document explains the **server's internal behavior**, not the endpoints themselves.

---

## 2. Server Lifecycle (Lifespan)

The FastAPI `lifespan` context manager handles startup/shutdown.

### On Startup

```
Server starts
  → Initialize VibeSmithCore (create DB, register global project)
  → Set SQLite check_same_thread=False
  → Auto-discover + register projects (see §2.1 below)
  → Rescan all registered projects
  → Create + register + start FileWatcher
  → Begin accepting requests
```

### On Shutdown

```
Shutdown signal
  → Stop FileWatcher
  → Close VibeSmithCore DB connection
```

**Code**: `packages/api/vibesmith_api/main.py` — `lifespan()`

### 2.1 Automatic Project Discovery

On server startup, projects containing a `.claude/` directory are automatically discovered and registered in the DB.

| Condition | Behavior |
|-----------|----------|
| `root_paths` stored in `~/.vibesmith/config.json` | Recursively scan those paths (max_depth=4) |
| No `config.json` (first launch) | Recursively scan home folder (`~/`) (max_depth=6) |

**Directories skipped during recursive scan**: `Library`, `Applications`, `node_modules`, `.git`, `.venv`, `.cache`, and other non-project directories are skipped. Hidden directories (starting with `.`) are also skipped, but only the config directories of registered adapters like `.claude`, `.cursor` are detected. Config directories at the root itself (global settings) are not considered as projects.

**When root_paths are saved**: When the frontend sends `POST /api/scan` with a `root_path`, it is automatically saved to `config.json`, so subsequent server restarts will scan from that path.

**Code**: `packages/api/vibesmith_api/main.py` — `_discover_and_register()`

### 2.2 Project Status Display and Manual Deletion

Projects whose paths no longer exist are **not auto-deleted**. Instead, the `GET /api/projects` response includes real-time status fields:

| Field | Description |
|-------|-------------|
| `dir_exists` | Whether the project directory exists on the filesystem |
| `platforms` | List of detected AI agent platforms (e.g. `["claude_code", "cursor"]`) |

The frontend can use these fields to display statuses like "Deleted" or "No configuration" to the user.

**Deletion from DB** is only performed when the user explicitly calls `DELETE /api/projects/{id}`.

---

## 3. FileWatcher — Automatic File Change Detection

### Role

Monitors config directories like `.claude/`, `.cursor/` of registered projects and automatically calls `rescan()` when files change.

### How It Works

```
File change in .claude/ (create/modify/delete/move)
  → watchdog detects event
  → Per-project debounce (default 0.5s)
  → Execute rescan() callback → Update DB
```

- **Debounce**: When multiple events fire in quick succession, waits 0.5s after the last event before executing the callback once
- **Per-project isolation**: File changes in Project A do not trigger a scan on Project B
- **Directory events ignored**: Only file events are processed

### What FileWatcher Does NOT Do

| Scenario | Solution |
|----------|----------|
| Discover + register new projects | `POST /api/scan` (`root_path`) |
| Change global home path | `POST /api/scan` (`home_path`) |
| Full resync without server restart | `POST /api/scan` (empty request) |

**Code**: `packages/core/vibesmith_core/watcher.py`

---

## 4. Cooperation with POST /api/scan

FileWatcher and the scan API work complementarily.

```
┌──────────────────────────────────────────────────────┐
│                    User Flow                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│  0. Server starts (automatic)                        │
│     └→ Recursively scan config.json root_paths       │
│        or home folder                                │
│     └→ Register new projects + full rescan           │
│     └→ Register all .claude/ with FileWatcher        │
│                                                      │
│  1. Frontend sets root_path                          │
│     └→ POST /api/scan { root_path: "~/Dev" }        │
│        └→ Save root_path to config.json             │
│        └→ Discover/register projects +              │
│           register with FileWatcher                  │
│                                                      │
│  2. Subsequent file edits                            │
│     └→ FileWatcher auto-detects → rescan()          │
│                                                      │
│  3. Manual refresh button                            │
│     └→ POST /api/scan {}                            │
│        └→ Full rescan                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. Dependency Injection (DI)

FastAPI's `Depends` is used to inject the core and watcher into routes.

| DI Function | Return Type | Source |
|-------------|-------------|--------|
| `get_core()` | `VibeSmithCore` | `app.state.core` |
| `get_watcher()` | `FileWatcher` | `app.state.watcher` |

In tests, `app.dependency_overrides` is used to inject isolated instances.

**Code**: `packages/api/vibesmith_api/deps.py`

---

## 6. SQLite Thread Safety

FastAPI runs sync endpoints in a threadpool. SQLite's default setting (`check_same_thread=True`) blocks access from non-creator threads, so the connection is recreated with `check_same_thread=False` during lifespan.

**Code**: `packages/api/vibesmith_api/deps.py` — `enable_threadsafe_db()`

---

## 7. Module Structure

```
packages/api/vibesmith_api/
├── main.py          # FastAPI app, lifespan, auto-discovery, middleware
├── config.py        # Config save/load (~/.vibesmith/config.json)
├── deps.py          # Dependency injection (get_core, get_watcher, enable_threadsafe_db)
├── schemas.py       # Pydantic request/response schemas
└── routes/
    ├── projects.py    # GET /api/projects, DELETE /api/projects/{id}
    ├── components.py  # GET/POST/PUT/DELETE /api/components, toggle, copy
    └── scan.py        # POST /api/scan
```
