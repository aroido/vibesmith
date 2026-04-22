# VibeSmith Core — Core Engine Documentation

**Package**: `vibesmith-core` (v0.1.0)
**Path**: `packages/core/`
**Python**: >=3.11

---

## 1. Overview

`vibesmith_core` is a Python core engine that scans AI coding agent (Claude Code, Cursor) components (Skills, Subagents, Commands, Hooks, Rules) from the filesystem, stores them in SQLite, and provides CRUD/toggle/copy/versioning/dependency analysis capabilities.

`packages/api/` (FastAPI) imports this package to expose a REST API. The core has no dependencies on the API or web packages.

---

## 2. Dependencies

| Package | Purpose |
|---------|---------|
| `pydantic>=2.0` | Data model definition and validation |
| `pyyaml>=6.0` | Parsing YAML frontmatter in Markdown files |
| `networkx>=3.0` | Dependency graph cycle detection (currently unused, planned for reimplementation) |
| `watchdog>=4.0` | Filesystem change detection |

Dev dependencies: `pytest`, `pytest-cov`, `ruff`

---

## 3. Module Structure

```
vibesmith_core/
├── __init__.py              # VibeSmithCore Facade
├── projects.py              # Project management + rescan (orchestrator)
├── infra/                   # Common infrastructure
│   ├── __init__.py
│   ├── db.py                # SQLite schema + DatabaseManager
│   ├── watcher.py           # File change detection (watchdog + debounce)
│   └── ollama_client.py     # Ollama local LLM client
├── components/              # Component domain
│   ├── __init__.py
│   ├── models.py            # Pydantic data models
│   ├── operations.py        # CRUD + toggle + copy
│   ├── conflicts.py         # Conflict detection/resolution
│   ├── tagging.py           # Tag management
│   └── versioning.py        # Version history + rollback
├── scanning/                # Filesystem scanning
│   ├── __init__.py
│   ├── scanner.py           # Filesystem scanner
│   ├── parser.py            # MD/YAML/JSON parser
│   └── adapters/            # Per-agent path mapping
│       ├── __init__.py
│       ├── base.py          # AgentAdapter ABC
│       ├── claude_code.py   # Claude Code path mapping
│       └── cursor.py        # Cursor path mapping
├── dependencies/            # Dependency analysis
│   ├── __init__.py
│   ├── analyzer.py          # Dependency analysis engine
│   └── repo.py              # Dependency DB storage/retrieval
├── usage/                   # Usage tracking
│   ├── __init__.py
│   ├── parser.py            # JSONL session parser
│   ├── repo.py              # Usage statistics DB CRUD
│   └── scanner.py           # Periodic usage scanning
└── templates/               # Template system
    ├── __init__.py
    ├── manager.py           # Template loading/rendering
    ├── validator.py         # Template validation
    ├── generator.py         # Component generation engine
    └── data/                # Template data files
        ├── templates.json
        ├── agents/
        ├── skills/
        └── sample-project/
```

### Module Dependency Direction

```
components/models.py      ← Base, no dependencies
    ↓
infra/db.py               ← External only (sqlite3)
infra/watcher.py          ← External only (watchdog)
infra/ollama_client.py    ← External only (httpx)
    ↓
scanning/parser.py        ← components.models
scanning/adapters/        ← components.models (base only)
scanning/scanner.py       ← scanning.parser, scanning.adapters, components.models
    ↓
components/operations.py  ← infra.db, components.models
components/conflicts.py   ← infra.db, components.operations
components/tagging.py     ← infra.db
components/versioning.py  ← infra.db, components.models
    ↓
dependencies/analyzer.py  ← components.models, infra.ollama_client
dependencies/repo.py      ← components.models
    ↓
usage/parser.py           ← External only (json, pathlib)
usage/repo.py             ← External only (sqlite3)
usage/scanner.py          ← usage.parser, usage.repo
    ↓
templates/manager.py      ← External only (jinja2)
templates/validator.py    ← External only (jinja2)
templates/generator.py    ← templates.manager
    ↓
projects.py               ← infra.db, scanning, components, dependencies (orchestrator)
    ↓
__init__.py               ← Full composition (Facade)
```

---

## 4. Data Models (`models.py`)

### Enums

| Name | Values |
|------|--------|
| `ComponentType` | `skill`, `agent`, `command`, `hook`, `rule` |
| `DependencyType` | `context`, `body_reference`, `agents_field` |

### Key Models

| Model | Description | Key Fields |
|-------|-------------|------------|
| `Project` | Project metadata | id, name, path, is_global, component_count, last_scanned_at |
| `ComponentBase` | Common component fields | id, type, name, description, enabled, tags, project_id, path, content, frontmatter, created_at, updated_at, platform |
| `Skill` | Skills (SKILL.md) | + allowed_tools, context_files, agent |
| `Subagent` | Agents (*.md) | + tools, model, permission_mode, agents |
| `Command` | Commands (*.md) | No frontmatter, body only |
| `Hook` | Hooks (settings.json) | + event_type, matchers: list[HookMatcher] |
| `Rule` | Rules (*.md) | + globs |
| `Dependency` | Inter-component dependency | source_id, target_id, dep_type |
| `Version` | Version history | id, component_id, version, content, created_at |

Hook has a nested structure: `Hook` → `HookMatcher` (matcher, hooks) → `HookAction` (type, command, timeout)

---

## 5. SQLite Schema (`db.py`)

5 tables, with foreign key CASCADE delete applied.

| Table | PK | Purpose | Unique Constraint |
|-------|-----|---------|-------------------|
| `projects` | id | Projects | path |
| `components` | id | Components | (project_id, name, type, platform) |
| `tags` | (component_id, tag) | Tags (many-to-many) | — |
| `dependencies` | (source_id, target_id, dep_type) | Dependencies | — |
| `versions` | id | Version history | (component_id, version) |

Indexes: `idx_components_project_type`, `idx_components_enabled`, `idx_tags_tag`, `idx_dependencies_source`, `idx_dependencies_target`

### DatabaseManager

```python
class DatabaseManager:
    def __init__(self, db_path: str) -> None
    def get_connection(self) -> sqlite3.Connection   # Lazy connection, auto-create parent directory
    def initialize_schema(self) -> None              # Idempotent (CREATE IF NOT EXISTS)
    def close(self) -> None
```

---

## 6. Parser (`parser.py`)

Reads MD/YAML/JSON files from the filesystem and converts them to Pydantic models.

### ComponentParser

```python
parser = ComponentParser(platform="claude_code")  # platform is required
```

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `parse_file(path, type, project_id)` | File path | ComponentBase subclass | Type-based dispatch (except HOOK) |
| `parse_skill(path, project_id)` | SKILL.md path | Skill | YAML frontmatter + body |
| `parse_agent(path, project_id)` | agent.md path | Subagent | YAML frontmatter + body |
| `parse_command(path, project_id)` | command.md path | Command | No frontmatter, entire file is body |
| `parse_hooks(path, project_id)` | settings.json path | list[Hook] | Parse hooks section, one Hook per event |
| `parse_rule(path, project_id)` | rule.md path | Rule | YAML frontmatter + body |

Comma-separated strings in frontmatter (`allowed-tools: Read, Write, Edit`) are automatically converted to lists. For names, the frontmatter `name` field takes priority; if absent, the directory name (Skill) or filename (Agent/Command/Rule) is used.

---

## 7. Scanner (`scanner.py`)

### FileSystemScanner

| Method | Description |
|--------|-------------|
| `scan_project(project_path, project_id)` | Scan components supported by the adapter |
| `scan_project_all_adapters(project_path, project_id)` | Scan project with all registered adapters and tag by platform |
| `discover_projects(root_path, max_depth=1)` | Discover projects with config directories. Excludes root's own config dir (global settings) |

Scan path mapping (by adapter):

**Claude Code** (`.claude/`)

| Component | Path Pattern |
|-----------|-------------|
| Skills | `.claude/skills/*/SKILL.md` |
| Agents | `.claude/agents/*.md` |
| Commands | `.claude/commands/*.md` |
| Rules | `.claude/rules/*.md` |
| Hooks | `.claude/settings.json` → hooks section |

**Cursor** (`.cursor/`)

| Component | Path Pattern |
|-----------|-------------|
| Rules | `.cursor/rules/*.md`, `.cursor/rules/*.mdc`, `.cursorrules` (project root) |

Non-existent directories are silently skipped (returns empty list).

---

## 8. Dependency Analysis (`dependency.py`)

> **Status: Unimplemented (stub)** — All methods return empty results.
> The previous regex-based implementation (`skills/xxx` pattern matching) was removed due to its inability to detect plain-text references.
> Planned for reimplementation with context-hint-based matching. See [06_DEPENDENCY_DESIGN.md](./06_DEPENDENCY_DESIGN.md) for detailed design.

### DependencyAnalyzer (Interface Retained)

| Method | Description | Current Behavior |
|--------|-------------|------------------|
| `analyze_all()` | Full dependency analysis, returns `list[Dependency]` | Returns `[]` |
| `detect_cycles()` | Cycle detection | Returns `[]` |
| `get_dependents(id)` | List of IDs that reference this component | Returns `[]` |
| `get_dependencies(id)` | List of IDs this component references | Returns `[]` |

### What Is Retained

- `Dependency`, `DependencyType` models (models.py)
- `dependencies` DB table (db.py)
- `DependencyAnalyzer` class interface
- Facade's `analyze_dependencies()` method

---

## 9. CRUD Operations (`operations.py`)

### ComponentOperations

| Method | Description |
|--------|-------------|
| `create(component)` | Save component + tags to DB |
| `read(id)` | Retrieve by ID, restore to correct subclass (Skill/Subagent/...) |
| `update(id, updates)` | Update allowed fields only (name, description, enabled, content, frontmatter, path, updated_at) |
| `delete(id)` | Delete (CASCADE removes tags/dependencies/versions) |
| `toggle(id, enabled?)` | Enable/disable toggle. If enabled is omitted, reverses current state |
| `copy(id, target_project_id)` | Copy to another project (new UUID, includes tags) |
| `list_all(filters?)` | List with filters: `type`, `project_id`, `enabled` |

`read()` and `list_all()` restore the correct subclass (`Skill`, `Subagent`, `Command`, `Hook`, `Rule`) based on the DB's `type` + `frontmatter` fields.

---

## 10. Version Management (`versioning.py`)

### VersionManager

| Method | Description |
|--------|-------------|
| `save_version(component_id, content)` | Save new version, return auto-incremented number |
| `list_versions(component_id)` | Retrieve full history (oldest first) |
| `get_version_content(component_id, version)` | Return content for a specific version |
| `rollback(component_id, version)` | Update components table with that version's content |

---

## 11. Tag Management (`tagging.py`)

### TagManager

| Method | Description |
|--------|-------------|
| `add_tag(component_id, tag)` | Add tag (ignore if duplicate) |
| `remove_tag(component_id, tag)` | Remove tag |
| `get_tags(component_id)` | Get tag list for a component |
| `search_by_tags(tags)` | Component IDs that have **all** given tags (AND search) |
| `list_all_tags()` | All unique tags in the system |

---

## 12. Project Management (`projects.py`)

### ProjectManager

| Method | Description |
|--------|-------------|
| `ensure_global_project(home_path?)` | Register/retrieve global project. Returns existing if present |
| `add_project(path)` | Register project (blocks duplicate paths) |
| `discover_projects(root_path, max_depth=1)` | Return list of project paths with config directories |
| `list_all()` | List all projects |
| `get(project_id)` | Retrieve project by ID |
| `remove_project(project_id)` | Delete (CASCADE removes associated components) |
| `rescan(project_id)` | Rescan filesystem → replace existing components, update component_count |

---

## 13. Adapters (`adapters/`)

Abstracts the path structure per AI agent.

### AgentAdapter (ABC)

```python
class AgentAdapter(ABC):
    def get_global_path(self) -> str | None       # Global config directory (None if not applicable)
    def get_project_path(self, root: str) -> str  # Config directory within a project
    def get_component_paths(self, base: str) -> dict[str, str]  # Paths by type
    def get_extra_rules(self, project_path: str) -> list[str]   # Additional rule file paths
```

Auto-registration via `__init_subclass__`: passing `config_dir` and `adapter_type` as class arguments registers the adapter in the registry.

### ClaudeCodeAdapter

| Method | Return Value |
|--------|-------------|
| `get_global_path()` | `~/.claude` |
| `get_project_path(root)` | `{root}/.claude` |
| `get_component_paths(base)` | `{skills, agents, commands, rules, hooks}` path mapping |
| `get_extra_rules(project_path)` | `[]` (no additional rules) |

### CursorAdapter

| Method | Return Value |
|--------|-------------|
| `get_global_path()` | `None` (no global config) |
| `get_project_path(root)` | `{root}/.cursor` |
| `get_component_paths(base)` | `{rules}` path mapping |
| `get_extra_rules(project_path)` | `[{project_path}/.cursorrules]` |

---

## 14. Facade (`__init__.py`)

### VibeSmithCore

```python
core = VibeSmithCore(db_path="~/.vibesmith/vibesmith.db")
core.initialize()

# Register + scan project
project = core.projects.add_project("/path/to/project")
core.projects.rescan(project.id)

# Query components
components = core.operations.list_all(filters={"type": "skill"})

# Tags
core.tags.add_tag(component_id, "python")

# Version management
core.versions.save_version(component_id, content)
core.versions.rollback(component_id, version=1)

# Dependency analysis
deps = core.analyze_dependencies(components)

core.close()
```

| Property | Type | Description |
|----------|------|-------------|
| `core.db` | DatabaseManager | DB connection |
| `core.operations` | ComponentOperations | CRUD/toggle/copy |
| `core.projects` | ProjectManager | Project management |
| `core.tags` | TagManager | Tag management |
| `core.versions` | VersionManager | Version management |

---

## 15. Tests

Total **219 tests** (core), all passing.

| Test File | Coverage |
|-----------|----------|
| `test_models.py` | Enum values, model creation, defaults, platform required |
| `test_db.py` | Schema creation, FK, UNIQUE(project_id,name,type,platform), CASCADE delete, idempotent init |
| `test_parser.py` | Frontmatter parsing, 5 type parsing, name fallback, dispatch, platform passing |
| `test_scanner.py` | Type-based scan, discover_projects, Cursor adapter scan, multi-adapter scan |
| `test_dependency.py` | Stub state verification (all methods return empty results) |
| `test_operations.py` | CRUD, toggle, copy, filter queries (including platform), CASCADE delete |
| `test_versioning.py` | Version save/retrieve/rollback, non-existent version error |
| `test_tagging.py` | Add/remove/duplicate prevention, AND search, all tags list |
| `test_projects.py` | Register/retrieve/delete, duplicate prevention, global project, rescan |
| `test_adapters.py` | ABC instantiation blocked, Claude Code/Cursor path mapping, auto-registration |
| `test_integration.py` | Facade init, global project registration, scan→query→toggle→tag→version→dependency E2E |
| `test_watcher.py` | start/stop, file create/modify/delete detection, debounce, multi-project, unwatch |

### Running Tests

```bash
# Full test suite
python -m pytest packages/core/tests/ -v

# Specific module
python -m pytest packages/core/tests/test_parser.py -v

# Lint + format check
ruff check packages/core/ && ruff format packages/core/ --check
```

---

## 16. Context Optimization (Token Calculation)

### Design Background

v1 context optimization assumed simultaneous loading of all active components and estimated tokens with `len(content) // 4`, but had the following issues:
- In practice, only Rules are loaded per conversation; Skills/Agents/Commands are loaded on demand
- The English-based estimation formula severely underestimates Korean text
- Did not distinguish context loading differences between platforms (Claude Code vs Cursor)

### Per-Platform Context Loading Model

**Claude Code**:
- **Always**: Rules (CLAUDE.md, .claude/rules/*.md) — Full content injected at conversation start
- **Catalog**: Skills, Commands name+description — Catalog listed at conversation start
- **On-demand**: Skill/Command/Agent body — Loaded only when invoked
- Hooks are event handlers and are not included in the context

**Cursor**:
- **Always**: Rules with `alwaysApply: true`, `.cursorrules` — At conversation start
- **Conditional**: Rules with glob patterns — Loaded when matching files are opened
- **Manual**: Remaining Rules — Explicitly invoked via `@` mention

### Token Estimation Formula

```python
def _estimate_tokens(content: str | None) -> int:
    cjk_chars = sum(1 for c in body if _is_cjk(c))
    ascii_chars = len(body) - cjk_chars
    # CJK: 1 character ≈ 2.5 tokens, ASCII: 4 characters ≈ 1 token
    tokens = int(cjk_chars * 2.5) + (ascii_chars // 4)
    return tokens
```

Rationale: In Claude's BPE tokenizer, Korean characters are typically split into 2-3 byte-pairs. 2.5 is a conservative midpoint.

### Per-Platform Recommended Token Limits

| Platform | Context Window | Recommended Limit | Rationale |
|----------|---------------|-------------------|-----------|
| Claude Code | ~200K tokens | 12,000 | ~6% of total allocated for user customization |
| Cursor | ~128K tokens | 8,000 | ~6% of total |

Status calculation: ok ≤ recommended / warning ≤ recommended x 1.5 / critical > recommended x 1.5

### Key Decisions

- `effective_tokens` = sum of only tiers with `counts_toward_limit=True` (Always + Catalog)
- Independent calculation per platform (different AI sessions, so not aggregated)
- Adding a new platform only requires adding an entry to the `PLATFORM_TIERS` dictionary (no schema change needed)

---

## 17. Relationship with the API Package

```
[Filesystem]  →  scanner/parser  →  [SQLite DB]
                                        ↓
[FastAPI routes]  ←  core.*  ←  [operations/projects/tags/versions/dependency]
                                        ↓
                                   [REST API]  →  [React Web]
```

`packages/api/` imports `vibesmith_core` and uses the `VibeSmithCore` Facade or individual managers directly. The API spec (`docs/api/spec.md`) is the sole contract with the frontend.

---

## 17. File Change Detection (`watcher.py`)

> **Related Requirement**: FR-005 "Manual rescan and filesystem change detection"

### Role Distribution

```
Core (library)     →  Provides FileWatcher class (event detection + debounced callback)
API  (server)      →  Integrates FileWatcher into server lifespan (start/stop)
Frontend (web)     →  Receives change notifications via WebSocket/SSE (not yet implemented)
```

### Data Flow

```
.claude/ file change
    ↓  watchdog (FSEvents/inotify)
_DebouncedHandler: receives event, resets debounce timer
    ↓  After debounce_seconds elapsed
Callback invocation: callback(project_id)
    ↓  Callback registered by API server
ProjectManager.rescan()  →  DB update
```

### FileWatcher

```python
from vibesmith_core.infra.watcher import FileWatcher

watcher = FileWatcher(debounce_seconds=0.5)

# Register watch targets
watcher.watch("proj-id", "/path/to/project/.claude")
watcher.watch("global", "~/.claude")

# Register change callback — callback(project_id: str) -> None
watcher.on_change(lambda pid: core.projects.rescan(pid))

watcher.start()
# ...
watcher.stop()
```

| Method | Description |
|--------|-------------|
| `watch(project_id, path)` | Add project path to watch targets. Takes effect immediately if running |
| `unwatch(project_id)` | Remove from watch targets |
| `on_change(callback)` | Register debounced change callback. `callback(project_id)` |
| `start()` | Start watching (no-op if already running) |
| `stop()` | Stop watching |
| `is_running` | Watch running state (property) |

### Debouncing

Editors generate multiple rapid events when saving files (write → rename → write). `_DebouncedHandler` manages per-project timers, bundling multiple events within `debounce_seconds` (default 500ms) into a single callback invocation.

- Event received → Cancel existing timer → Set new timer
- On timer expiry → Pass `project_id` to all registered callbacks
- Directory events are ignored (only file events are processed)

### Internal Structure

| Class | Role |
|-------|------|
| `FileWatcher` | Public API. Manages `watchdog.Observer` and registers per-project handlers |
| `_DebouncedHandler` | `FileSystemEventHandler` subclass. Receives events → debounce → callback |

### API Server Integration (Reference)

- Call `FileWatcher.start()` during server lifespan `startup`
- Call `FileWatcher.stop()` during server lifespan `shutdown`
- After `rescan()` in callback, notify clients via WebSocket/SSE (not yet implemented)

### Thread Safety

`watchdog.Observer` fires events from its own thread. When calling core's `rescan()` inside a callback, the SQLite connection must have `check_same_thread=False`. The API server already handles this via `enable_threadsafe_db()`.
