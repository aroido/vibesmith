# Scan Progress Indicator Feature Design

**Created**: 2026-03-14
**Status**: Implemented (backend + frontend)
**Implemented**: 2026-03-16

---

## Background

When switching/adding projects, UsageScanner parses session logs in the background (60-second cycle),
so usage statistics initially show as 0 and data only appears after a short delay.
Without feedback that "scanning is in progress," this can be confusing for users.

---

## Requirements

### Header Indicator

- When a scan (Filesystem Scan, Usage Scan, etc.) is in progress, a button/icon activates in the navigation
- Green when fully complete, red when incomplete
- Auto-hides when scanning finishes entirely and polling stops

### Progress Popover

- Opens Radix Popover on header button click
- Shows per-project progress (progress bars)
  - Project name (last segment of path)
  - Full path (small muted text)
  - Individual progress bar (PENDING=0%, SCANNING=50%, DONE=100%)
- Overall progress bar (top)

---

## Implementation

### Backend

1. **`ScanProgressRegistry`** (`packages/core/vibesmith_core/infra/scan_progress.py`)
   - Thread-safe singleton, tracks per-project status (PENDING/SCANNING/DONE)
   - `start_scan()`: Initializes project list as PENDING (overwrite policy)
   - `try_start_scan()`: Atomic scan start — returns False if already in progress (prevents TOCTOU)
   - `mark_scanning()` / `mark_done()` / `finish_scan()`: State transitions
   - `get_progress()`: Returns current snapshot (`scanning`, `projects[]`)

2. **`GET /api/system/scan-progress`** (`packages/api/vibesmith_api/routes/system.py`)
   - Polling endpoint, rate limit `150/minute`
   - Response:
     ```json
     {
       "scanning": true,
       "projects": [
         { "id": "...", "name": "my-project", "path": "/full/path", "status": "done", "progress": 100 },
         { "id": "...", "name": "other", "path": "/full/path", "status": "scanning", "progress": 0 }
       ]
     }
     ```

3. **Async Scan** (`packages/api/vibesmith_api/routes/scan.py`)
   - `POST /api/scan` immediately returns `{ status: "started" }`
   - Runs in background thread: collect targets → `try_start_scan()` → sequential scan → `finish_scan()`
   - Duplicate execution prevention: endpoint quick hint + `try_start_scan()` atomic protection

### Frontend

1. **`useScanProgress` hook** — 500ms (during scan) / 30s (idle) polling, auto-refreshes related queries on completion detection
2. **`ScanProgressIndicator`** — Left of AppTopNav home button, Loader2 (scanning) / Radio (complete) icons
3. **`ScanProgressPopover`** — Radix Popover, per-project name + path + progress bar
4. **`useScan` / `useUnifiedSync`** — Async scan response handling, completion detection delegated to useScanProgress

---

## Considerations

- **Polling vs SSE**: Polling (500ms) adopted — SSE not yet introduced in current architecture
- **TOCTOU race condition**: Resolved with `try_start_scan()` atomic method
- **Rate limit**: 500ms polling = 120 req/min → set to `150/minute`
