# VibeSmith - Requirements Document

**Authors**: kkachi, bigcat
**Created**: 2026-02-09
**Status**: Draft

---

## 1. Overview

### 1.1 Problem

Components (Skills, Subagents, Commands, Hooks, Rules) of AI coding agents like Claude Code and Cursor are scattered across the home directory (global) and individual projects, making unified management difficult.

- Existing tools are half-solutions that manage only skills or only subagents
- Over-registering skills globally causes the AI to waste tokens and fail to find the desired skill
- No tool exists to identify and manage inter-component dependencies (skill→skill, agent→agent references)

### 1.2 Solution

A local web-based GUI to manage Skills, Subagents, Commands, Hooks, and Rules in one place.

- View global (home) + per-project components at a glance
- CRUD + cross-project copy/share
- On/Off toggle, version management, tag-based classification
- Dependency visualization and circular reference prevention

### 1.3 Target Users

- **Primary**: Claude Code users
- **Secondary**: Cursor users
- AI coding agent power users

### 1.4 Key Features

- **Unified** management of Skills + Agents + Commands + Hooks
- **Unified view** of home (global) + per-project
- **On/Off toggle** without deletion
- Dependency **DAG graph** visualization and circular reference prevention
- Local **web GUI**
- Claude Code / Cursor **multi-agent** support
- **Tag**-based classification

---

## 2. Managed Components

### 2.1 Skills

| Item | Details |
|------|---------|
| Global path | `~/.claude/skills/*/SKILL.md` |
| Project path | `{project}/.claude/skills/*/SKILL.md` |
| File structure | Folder + SKILL.md (YAML frontmatter) + scripts/ + references/ |
| Managed fields | name, description, allowed-tools, context, agent, body |
| Dependencies | Can reference other skills (context, body path references) |

### 2.2 Subagents

| Item | Details |
|------|---------|
| Global path | `~/.claude/agents/*.md` |
| Project path | `{project}/.claude/agents/*.md` |
| File structure | Single .md (YAML frontmatter + system prompt) |
| Managed fields | name, description, tools, model, permissionMode, prompt |
| Dependencies | Can reference other agents (agents field, delegation in prompts) |

### 2.3 Commands

| Item | Details |
|------|---------|
| Global path | `~/.claude/commands/*.md` |
| Project path | `{project}/.claude/commands/*.md` |
| File structure | Single .md (prompt text, $ARGUMENTS support) |
| Managed fields | filename (= command name), body |

### 2.4 Hooks

| Item | Details |
|------|---------|
| Global path | `~/.claude/settings.json` → hooks section |
| Project path | `{project}/.claude/settings.json` → hooks section |
| File structure | Structured config within JSON |
| Managed fields | event type, matcher, command, type, timeout |
| Event types | PreToolUse, PostToolUse, Notification, Stop, SessionStart, UserPromptSubmit, SubagentStop, TaskCompleted, TeammateIdle |

### 2.5 Rules

| Item | Details |
|------|---------|
| Global path | `~/.claude/rules/*.md` |
| Project path | `{project}/.claude/rules/*.md` |
| File structure | Single .md (YAML frontmatter + rule body) |
| Managed fields | filename, description, globs, body |

### 2.6 Scope Out

| Component | Exclusion Reason |
|-----------|-----------------|
| Agent Teams | Runtime-only, destroyed on session end |
| MCP Servers | External service integration, different nature (future expansion possible) |
| Plugins | Marketplace install, skills/agents/hooks bundle (future expansion) |
| CLAUDE.md | Project context document, no separate management needed |

---

## 3. Functional Requirements

### 3.1 Discovery & Scanning

| ID | Requirement |
|----|-------------|
| FR-001 | Auto-scan global skills, agents, commands, hooks, rules in home directory (`~/.claude/`) |
| FR-002 | Discover all projects with `.claude/` folder (configurable scan paths) |
| FR-003 | Parse each project's components and extract metadata |
| FR-004 | Store scan results in SQLite for fast retrieval |
| FR-005 | Manual rescan and filesystem change detection |
| FR-006 | Parse inter-component dependencies during scan and store in DB |

### 3.2 Unified View

| ID | Requirement |
|----|-------------|
| FR-010 | Display all components on dashboard (grouped by global vs per-project) |
| FR-011 | Filter by component type (Skills / Agents / Commands / Hooks / Rules) |
| FR-012 | Filter by project |
| FR-013 | Tag-based filtering and search |
| FR-014 | Component detail view (frontmatter + content preview) |
| FR-015 | Show dependency list in detail view (references + referenced by) |

### 3.3 CRUD

| ID | Requirement |
|----|-------------|
| FR-020 | Create new skill/agent/command (with templates) |
| FR-021 | Edit existing components (YAML frontmatter + markdown body) |
| FR-022 | Delete (confirmation dialog required) |
| FR-023 | Hooks GUI editing (hooks section in settings.json) |
| FR-024 | Show dependent components warning on delete/edit (impact analysis) |

### 3.4 On/Off Toggle

| ID | Requirement |
|----|-------------|
| FR-030 | Disable skill/agent/command without deleting |
| FR-031 | Disable method: move to separate `_disabled/` directory (recommended) |
| FR-032 | Manage toggle state in DB and reflect on filesystem |
| FR-033 | Show warning on dependent components when disabling |

### 3.5 Cross-Project Copy & Share

| ID | Requirement |
|----|-------------|
| FR-040 | Copy from global → project |
| FR-041 | Copy from Project A → Project B |
| FR-042 | Promote from project → global |
| FR-043 | Bulk copy existing components when setting up new project (checkboxes) |
| FR-044 | Option to copy dependent components together (dependency tree + checkboxes) |

### 3.6 Version Control

| ID | Requirement |
|----|-------------|
| FR-050 | Auto-backup previous version on edit (DB history) |
| FR-051 | Version history view and diff view |
| FR-052 | Rollback to previous version |
| FR-053 | (Future) Git-integrated commit-based version management |

### 3.7 Tagging

| ID | Requirement |
|----|-------------|
| FR-060 | User-defined tags (e.g., `python`, `code-review`, `security`) |
| FR-061 | Tag-based search and filtering |
| FR-062 | (Future) Similar skill detection and merge suggestions (AI-based) |

### 3.8 Multi-Agent Support

| ID | Requirement |
|----|-------------|
| FR-070 | Support Claude Code path structure (`~/.claude/`) |
| FR-071 | Support Cursor path structure |
| FR-072 | AI agent selection in UI |
| FR-073 | Store path mappings in DB for flexible management |

### 3.9 Dependency Management

| ID | Requirement |
|----|-------------|
| FR-090 | Auto-detect skill→skill, agent→agent reference relationships |
| FR-091 | Visualize dependency graph as DAG |
| FR-092 | Detect circular references (during scan + real-time on edit/create) |
| FR-093 | Block save on circular reference or provide force-save option |
| FR-094 | Show affected dependent component tree on delete/disable |
| FR-095 | Navigate to detail view on graph node click |
| FR-096 | Filter graph by project/global scope |
| FR-097 | Detect and warn about broken dependencies |

### 3.10 AI-Friendly Access (Future)

| ID | Requirement |
|----|-------------|
| FR-080 | Structure that AI can easily check/retrieve |
| FR-081 | API endpoint → MCP server integration |
| FR-082 | Supabase integration for team sharing/cloud sync |

---

## 4. Non-Functional Requirements

### 4.1 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend (Core) | Python 3.11+, Pydantic, PyYAML, NetworkX | Scan/parse/dependency engine |
| Backend (API) | FastAPI, Uvicorn | REST API server |
| Frontend | React + Vite (confirmed) | SPA |
| Database | SQLite | Local, lightweight |
| Graph Visualization | TBD (React Flow / Cytoscape.js / D3.js) | Dependency DAG |
| OS | macOS first | Linux future, Windows low priority |

### 4.2 Deployment

| ID | Requirement |
|----|-------------|
| NFR-010 | Install via `pip install` or `brew` |
| NFR-011 | (Alternative) DMG one-click install under review |
| NFR-012 | Docker deployment unsuitable due to local filesystem access issues |
| NFR-013 | Single CLI command to start local web server → auto-open browser |

### 4.3 Performance

| ID | Requirement |
|----|-------------|
| NFR-020 | Initial scan: under 10 seconds for 100 projects |
| NFR-021 | Subsequent queries: instant response via DB |
| NFR-022 | Dependency graph rendering: under 2 seconds for 500 nodes |

### 4.4 i18n

- UI/docs: English primary, Korean secondary
- README/marketing materials: English first

---

## 5. Architecture

### 5.1 Monorepo Structure

A physically non-overlapping package separation structure is adopted to optimize for vibe coding.

```
vibesmith/
├── packages/
│   ├── core/              ← kkachi (Python core engine)
│   │   └── vibesmith_core/
│   │       ├── scanner.py
│   │       ├── parser.py
│   │       ├── db.py
│   │       ├── models.py
│   │       ├── operations.py
│   │       └── adapters/
│   │
│   ├── api/               ← kkachi (FastAPI server)
│   │   └── vibesmith_api/
│   │       ├── main.py
│   │       ├── schemas.py
│   │       └── routes/
│   │
│   └── web/               ← bigcat (React/Vite SPA)
│       └── src/
│           ├── components/
│           ├── pages/
│           └── api/
├── docs/
└── Makefile
```

### 5.2 Data Flow

```
Filesystem (.claude/)
    ↓ scanner.py
Metadata extraction
    ↓ parser.py
SQLite DB storage
    ↓ db.py
FastAPI REST API
    ↓ routes/
React Web UI
```

### 5.3 Collaboration Contract

The sole agreement point between the two developers is the **API spec**. As long as this spec is met, internal implementation is free.

### 5.4 File Structure Reference

```
~/.claude/                          # Global
├── skills/
│   └── {skill-name}/
│       ├── SKILL.md
│       └── scripts/
├── agents/
│   └── {agent-name}.md
├── commands/
│   └── {command-name}.md
└── settings.json                   # hooks

{project}/.claude/                  # Per-project
├── skills/
├── agents/
├── commands/
├── settings.json
└── settings.local.json
```

---

## 6. API Specification (Contract)

Contract between frontend and backend. bigcat develops with mock data using this spec, kkachi implements this spec.

### 6.1 Projects

```
GET  /api/projects                         # Project list
GET  /api/projects/{id}/components         # All components for a specific project
```

### 6.2 Components

```
GET    /api/components?type=skill&tag=python  # Global search/filter
GET    /api/components/{id}                   # Detail view
POST   /api/components                        # Create
PUT    /api/components/{id}                   # Update
DELETE /api/components/{id}                   # Delete
POST   /api/components/{id}/toggle            # On/off toggle
POST   /api/components/{id}/copy              # Copy to another project
```

### 6.3 Versions

```
GET    /api/components/{id}/versions          # Version history
POST   /api/components/{id}/rollback          # Rollback to specific version
```

### 6.4 Dependencies

```
GET    /api/dependencies                      # Dependency graph data
GET    /api/dependencies/{component_id}       # Dependencies for a specific component
```

### 6.5 Scan

```
POST   /api/scan                              # Rescan trigger
```

---

## 7. MVP Scope (v0.1)

| Priority | Feature | FR |
|----------|---------|-----|
| **P0** | Home + project scan & unified view | FR-001~006, FR-010~015 |
| **P0** | Skills/Agents/Commands list view and detail view | FR-014, FR-015 |
| **P0** | Web GUI (local web server) | NFR-002~003 |
| **P1** | CRUD (create/edit/delete) | FR-020~024 |
| **P1** | On/Off toggle | FR-030~033 |
| **P1** | Cross-project copy | FR-040~044 |
| **P1** | Dependency graph visualization & circular reference detection | FR-090~097 |
| **P2** | Tag system | FR-060~061 |
| **P2** | Version management (history/rollback) | FR-050~052 |
| **P2** | Hooks GUI editing | FR-023 |
| **P3** | ~~Cursor support~~ (implemented) | FR-071~073 |
| **P3** | AI-Friendly API / MCP integration | FR-080~082 |
| **P3** | Supabase/team integration | FR-082 |

---

## 8. Technical Decisions

### 8.1 On/Off Toggle (TBD — to be decided after separate testing)

| Method | Pros | Cons |
|--------|------|------|
| A: Filename prefix | Simple | Messy |
| B: Directory move | Clean, preserves original | Path changes |
| C: Symbolic link | Preserves original | High complexity |

### 8.2 Dependency Detection

- **Skill→Skill**: `context` field, body `skills/xxx` pattern matching
- **Agent→Agent**: `agents` field, agent name/path references in prompts
- **Graph storage**: SQLite `dependencies` table (source_id, target_id, type)
- **Circular reference detection**: DFS-based cycle detection (NetworkX)
- **Real-time validation**: Check for circular references before saving

---

## 9. Open Questions

1. ~~Frontend technology~~ → **React + Vite confirmed**
2. On/Off toggle implementation: to be decided after separate testing
3. Graph visualization library: React Flow vs Cytoscape.js vs D3.js
4. License: MIT vs Apache 2.0
5. ~~Cursor path structure~~ → **Implemented** (`.cursor/rules/*.md`, `.cursor/rules/*.mdc`, `.cursorrules`)
6. Dependency reference patterns: Need investigation of exact syntax/patterns based on official docs → See `docs/06_DEPENDENCY_DESIGN.md`
7. ~~Rules file structure~~ → **Implemented** (YAML frontmatter: name, description, globs)
