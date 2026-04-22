# Architecture & Design

VibeSmith system architecture and package design documentation

---

## Documentation

| Document | Description | Key Content |
|----------|-------------|-------------|
| [requirements.md](./requirements.md) | Project requirements definition | Problem statement, functional/non-functional requirements, MVP scope, technical decisions |
| [core.md](./core.md) | Core engine design | Module structure, data models, scanner, parser, CRUD, Facade API |
| [api.md](./api.md) | API server design | FastAPI structure, DI, FileWatcher, lifecycle, routers |
| [frontend.md](./frontend.md) | Frontend architecture | React structure, spec-driven workflow, development guide |
| [dependency-design.md](./dependency-design.md) | Dependency analysis design | Current state, limitations, context-hint-based matching plan |
| [testing.md](./testing.md) | Testing strategy | Vitest, Playwright, axe-core, Lighthouse CI |

---

## System Architecture

```
VibeSmith (Monorepo)
├── packages/core/     # Python core engine
│   ├── scanner        # File scanning
│   ├── parser         # YAML/JSON parsing
│   ├── models         # Data models
│   └── crud           # CRUD logic
├── packages/api/      # FastAPI REST server
│   ├── routers        # API routers
│   ├── dependencies   # DI
│   └── watcher        # FileWatcher
└── packages/web/      # React SPA
    ├── features       # Feature modules
    ├── components     # UI components
    └── hooks          # React Hooks
```

---

## Reading Order

### 1. Understanding the Project
1. [requirements.md](./requirements.md) - Why was it built?
2. [core.md](./core.md) - How does it work?

### 2. Backend Development
1. [core.md](./core.md) - Core engine structure
2. [api.md](./api.md) - API server structure
3. [dependency-design.md](./dependency-design.md) - Dependency analysis

### 3. Frontend Development
1. [frontend.md](./frontend.md) - Frontend structure
2. [testing.md](./testing.md) - Testing strategy

---

## Core Design Principles

### 1. Monorepo with Full Package Separation
- Each package can be developed/tested independently
- API spec is the sole contract

### 2. API Contract First
- Define API spec first (`docs/api/spec.md`)
- Frontend develops with mocks
- Backend implements to match the spec

### 3. Spec-Driven Workflow
- Frontend features start with writing spec documents
- Spec review → Implementation → Testing

---

**Last Updated**: 2026-02-13
