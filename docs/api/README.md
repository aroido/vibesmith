# API Documentation

VibeSmith REST API specification and implementation guide

---

## Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [spec.md](./spec.md) | **REST API Specification** | Frontend & Backend |
| [backend-requirements.md](./backend-requirements.md) | Backend implementation requirements | Backend developers |
| [migration-guide.md](./migration-guide.md) | API change history | Frontend & Backend |
| [usage-status.md](./usage-status.md) | API usage status analysis | Entire team |

---

## API Development Workflow

### Frontend → Backend

```
1. Frontend: New API needed
   ↓
2. Create Issue (label: api-request)
   ↓
3. Update spec.md (define API spec)
   ↓
4. Frontend: Develop with mock data
   ↓
5. Backend: Review Issue → Implement
   ↓
6. Frontend: Switch from mock to real API
```

### When Breaking Changes Occur

```
1. Update spec.md
   ↓
2. Add change history to migration-guide.md
   ↓
3. Notify frontend (Issue comment)
   ↓
4. Frontend: Update code
```

---

## Reading Order

### Frontend Developers
1. [spec.md](./spec.md) - Review API spec
2. [usage-status.md](./usage-status.md) - Check which APIs are implemented
3. [migration-guide.md](./migration-guide.md) - Review API changes

### Backend Developers
1. [spec.md](./spec.md) - Review API spec to implement
2. [backend-requirements.md](./backend-requirements.md) - Implementation guide
3. [usage-status.md](./usage-status.md) - Check how frontend uses the APIs

---

## API Spec Structure

```
/api/v1/
├── /projects              # Project management
├── /skills                # Skill CRUD
├── /commands              # Command CRUD
├── /subagents             # Subagent CRUD
├── /hooks                 # Hook CRUD
├── /rules                 # Rule CRUD
├── /dependencies          # Dependency analysis
└── /health                # Health check
```

---

## Documentation Update Rules

### When Updating spec.md
1. Update version number
2. Record in the change history section
3. If breaking change, also add to migration-guide.md

### When Updating backend-requirements.md
1. Organize by phase
2. Write in checklist format
3. Check off when implementation is complete

### When Updating usage-status.md
1. Periodic auto-updates (script)
2. Record date for manual updates

---

**Last Updated**: 2026-02-13
