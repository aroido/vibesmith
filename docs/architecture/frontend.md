# Frontend Development Guide

VibeSmith frontend development guide.

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**:
  - Local: useState
  - Server: React Query
  - Global: Zustand (when needed)
- **Routing**: React Router
- **Testing**: Vitest + React Testing Library

## Architecture

### Feature-Based Structure

```
packages/web/src/
├── features/            # Feature modules
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── types/
│       └── index.ts     # Public API
├── components/          # Shared components
├── common/              # Common utilities
└── pages/               # Routing
```

## React Query Cache Strategy

### Global QueryClient Configuration

Location: `packages/web/src/common/lib/queryClient.ts`

#### Queries Default Options

| Option | Value | Description |
|--------|-------|-------------|
| `staleTime` | 5 min (300,000ms) | Duration cache remains fresh. No automatic refetch within this period |
| `gcTime` | 10 min (600,000ms) | Cache garbage collection time. Duration before unused cache is removed from memory |
| `refetchOnWindowFocus` | false | Disable automatic refetch on window focus (UX stability) |
| `refetchOnReconnect` | true | Automatic refetch on network reconnection |
| `networkMode` | offlineFirst | Use cached data even when offline |

#### Retry Strategy

```typescript
retry: (failureCount, error) => {
  // Network errors: retry up to 2 times
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return failureCount < 2;
  }
  // 4xx client errors: no retry
  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }
  // Others (5xx etc.): retry once
  return failureCount < 1;
}
```

| Error Type | Retry Count | Reason |
|------------|-------------|--------|
| Network error (Failed to fetch) | Up to 2 | Temporary network issues may recover |
| 4xx client error | 0 (immediate failure) | Request itself is invalid, retry pointless |
| 5xx server error | 1 | Server may recover from temporary overload |

#### Retry Delay (Exponential Backoff)

```typescript
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
```

| Attempt | Delay |
|---------|-------|
| 1st retry | 2s (1000 * 2^1) |
| 2nd retry | 4s (1000 * 2^2) |
| 3rd retry | 8s (1000 * 2^3) |
| ... | ... |
| Maximum | 30s |

#### Mutations Default Options

| Option | Value | Description |
|--------|-------|-------------|
| `retry` | false | No retry for mutations (idempotency hard to guarantee) |
| `networkMode` | online | Mutations wait when offline |
| `onError` | handleError | Global error handler (shows toast) |

### invalidateQueries Usage Rules

#### When to Invalidate

| Scenario | Target Queries | Example |
|----------|---------------|---------|
| Component creation (POST) | `['components']`, `['projects', projectId, 'components']` | Component list, project component list |
| Component update (PUT) | `['components', id]`, `['components']` | Component detail, component list |
| Component deletion (DELETE) | `['components']`, `['trash']` | Component list, trash list |
| Project scan (POST /api/scan) | `['projects']`, `['components']`, `['stats']` | Full data refresh |
| Trash restore (POST) | `['trash']`, `['components']` | Trash list, component list |

#### invalidateQueries Patterns

```typescript
// 1. Invalidate immediately on mutation success
const { mutate } = useMutation({
  mutationFn: createComponent,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['components'] });
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'components'] });
  },
});

// 2. Optimistic Update
const { mutate } = useMutation({
  mutationFn: toggleComponent,
  onMutate: async (variables) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: ['components', id] });

    // Save previous data snapshot
    const previous = queryClient.getQueryData(['components', id]);

    // Optimistic update
    queryClient.setQueryData(['components', id], (old) => ({
      ...old,
      enabled: !old.enabled,
    }));

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on failure
    queryClient.setQueryData(['components', id], context?.previous);
  },
  onSettled: () => {
    // Refetch for sync regardless of success/failure
    queryClient.invalidateQueries({ queryKey: ['components', id] });
  },
});

// 3. Partial invalidate (specific project only)
queryClient.invalidateQueries({
  queryKey: ['projects', projectId],
  exact: false, // Invalidate all child queries
});
```

#### Invalidate Timing

| Timing | Use Case | Example |
|--------|----------|---------|
| `onSuccess` | Immediate refresh needed | Create, update, delete |
| `onSettled` | Sync regardless of success/failure | After optimistic update |
| `onError` | Rollback on failure | Optimistic update failure |

### Cache Key Naming Rules

#### Single Resource
```typescript
['components', componentId]         // GET /api/components/{id}
['projects', projectId]             // GET /api/projects/{id}
['templates', templateId]           // GET /api/templates/{id}
```

#### Lists (with filters)
```typescript
['components']                      // GET /api/components
['components', { search: 'react' }] // GET /api/components?search=react
['projects', projectId, 'components'] // GET /api/projects/{id}/components
```

#### Stats & Dashboard
```typescript
['stats']                           // GET /api/stats
['stats', 'context']                // GET /api/stats/context
['system', 'status']                // GET /api/system/status
```

#### Naming Principles
1. **Hierarchical**: Parent concept → child concept order
   - e.g., `['projects', projectId, 'components']` (project → components)
2. **Filters as objects**: Query parameters as objects at the end
   - e.g., `['components', { enabled: true, type: 'skill' }]`
3. **Consistency**: Same resource always uses the same key
   - e.g., Components always start with `'components'`

### Optimistic Update Guide

#### When to Use

| Scenario | Recommended | Reason |
|----------|-------------|--------|
| Toggle (enable/disable) | Yes | Fast feedback, low failure rate |
| Simple edits (name change, etc.) | Yes | Fast feedback |
| Create (POST) | Optional | Complex when server-generated ID is needed |
| Delete (DELETE) | Optional | Complex with dependency checks |
| Complex business logic | No | Safer to wait for server response |

#### Implementation Checklist

- [ ] Cancel in-flight queries in `onMutate` (`cancelQueries`)
- [ ] Save previous data snapshot (`getQueryData`)
- [ ] Set optimistic data (`setQueryData`)
- [ ] Rollback in `onError` (restore snapshot)
- [ ] Final sync in `onSettled` (`invalidateQueries`)

### Cache Invalidation Strategy

#### Global Invalidation (full refresh)
```typescript
// Full data refresh after scan
queryClient.invalidateQueries({ queryKey: ['projects'] });
queryClient.invalidateQueries({ queryKey: ['components'] });
queryClient.invalidateQueries({ queryKey: ['stats'] });
```

#### Partial Invalidation (specific project)
```typescript
// Invalidate all child queries for a specific project
queryClient.invalidateQueries({
  queryKey: ['projects', projectId],
  exact: false, // Include child queries
});
// → Refreshes both ['projects', projectId] and ['projects', projectId, 'components']
```

#### Selective Invalidation (conditional)
```typescript
// Invalidate only queries containing enabled components
queryClient.invalidateQueries({
  predicate: (query) =>
    query.queryKey[0] === 'components' &&
    query.queryKey[1]?.enabled === true,
});
```

### Error Handling Strategy

#### Query Errors

Global config has `throwOnError: false`, so each component handles the `error` object:

```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['components'],
  queryFn: fetchComponents,
});

if (error) {
  return <ErrorBoundary error={error} />;
}
```

#### Mutation Errors

Global `onError` handler automatically shows toast:

```typescript
// Handled globally (queryClient.ts)
mutations: {
  onError: (error) => {
    handleError(error); // Auto toast display
  },
}

// When additional handling is needed
const { mutate } = useMutation({
  mutationFn: createComponent,
  onError: (error) => {
    // Additional logic after global handler
    console.error('Creation failed:', error);
    navigate('/components');
  },
});
```

### Team Development Guide

#### When Writing New Query Hooks

1. **Choose cache key**
   - Follow naming rules (`['resource', id?, filter?]`)
   - Check for duplicates with existing keys

2. **Adjust staleTime** (if needed)
   ```typescript
   useQuery({
     queryKey: ['stats', 'context'],
     queryFn: fetchContextStats,
     staleTime: 1 * 60 * 1000, // 1 minute (shorter than default 5 min)
   });
   ```

3. **Polling** (real-time updates)
   ```typescript
   useQuery({
     queryKey: ['system', 'status'],
     queryFn: fetchSystemStatus,
     refetchInterval: 30 * 1000, // Auto refetch every 30s
   });
   ```

4. **Error handling**
   - Trust global handler (auto toast)
   - Add `onError` only when additional logic is needed

#### When Writing New Mutation Hooks

1. **Specify invalidateQueries**
   - List all affected query keys
   - Decide between partial vs global invalidation

2. **Optimistic Update** (optional)
   - When fast feedback matters (e.g., toggle)
   - Follow the checklist

3. **Error recovery**
   - Check if global handler is sufficient
   - Add `onError` only when additional logic is needed

#### When Developing New Features

1. **Consider staleTime setting**
   - Real-time important? → Short (1 min)
   - Rarely changes? → Long (10 min)
   - Default (5 min) is suitable for most cases

2. **Assess polling need**
   - Dashboard, stats → Apply polling
   - Lists, details → No polling needed (FileWatcher auto-refreshes)

3. **Cache invalidation scope**
   - Invalidate only the minimum scope (performance)
   - Prevent missing related queries (data consistency)

### Best Practices

#### DO

```typescript
// 1. Use specific cache keys
useQuery({ queryKey: ['components', { enabled: true }] });

// 2. Invalidate immediately on mutation success
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['components'] });
};

// 3. Trust global handler for error handling
const { data, error } = useQuery(...);
if (error) return <ErrorMessage />;

// 4. Adjust staleTime when needed
useQuery({ ..., staleTime: 1 * 60 * 1000 });
```

#### DON'T

```typescript
// 1. Including dynamic values directly in cache key (not reusable)
useQuery({ queryKey: [`components-${Date.now()}`] });

// 2. Missing invalidate (data inconsistency)
onSuccess: () => {
  // Missing: queryClient.invalidateQueries(...);
};

// 3. Excessive invalidate (performance degradation)
onSuccess: () => {
  queryClient.invalidateQueries(); // Full invalidation
};

// 4. Enabling retry on mutations (duplicate requests)
useMutation({ ..., retry: 3 });
```

### Debugging Tips

#### React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

- Check cache key structure
- Monitor query state (fetching, stale, fresh)
- Inspect cached data directly

#### Console Logging

```typescript
// Check cache keys
console.log(queryClient.getQueryCache().getAll().map(q => q.queryKey));

// Check specific query data
console.log(queryClient.getQueryData(['components', id]));

// Check query state
console.log(queryClient.getQueryState(['components']));
```

### Performance Optimization

#### 1. Subscribe to Only Needed Data with Select

```typescript
// Bad: subscribing to entire list (unnecessary re-renders)
const { data: components } = useComponents();
const firstComponent = components?.[0];

// Good: select only needed data
const { data: firstComponent } = useComponents({
  select: (data) => data[0],
});
```

#### 2. Prevent Flicker During Page Transitions with keepPreviousData

```typescript
useQuery({
  queryKey: ['components', { page }],
  queryFn: () => fetchComponents({ page }),
  keepPreviousData: true, // Keep previous data while loading new data
});
```

#### 3. Improve UX with Prefetch

```typescript
// Preload before entering detail page
const prefetchComponent = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ['components', id],
    queryFn: () => fetchComponent(id),
  });
};

// On mouse hover in list
<ComponentCard
  onMouseEnter={() => prefetchComponent(comp.id)}
/>
```

### Related Issues

- Issue #50: React Query global configuration implementation
- Issue #463: Cache strategy documentation (current)
- Issue #158: Context optimization widget (follow-up)

### Reference Documents

- React Query official docs: https://tanstack.com/query/latest/docs/react/overview
- Caching strategy: https://tanstack.com/query/latest/docs/react/guides/caching
- Optimistic Updates: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates

---

## Dashboard UX Strategy

### Problem Diagnosis

The current dashboard presents monitoring, exploration, creation, optimization, analysis, and navigation all on one screen, resulting in high cognitive load. Six stat cards, six quick actions, charts, heatmaps, and context optimization widgets all render simultaneously.

### Design Decision: Decision Dashboard

Transform the "Mega Dashboard" into a "Decision Dashboard" and separate the rest into a hierarchy.

**Information Architecture (IA)**:
1. **Overview** (default entry) — Determine what to do within 10 seconds. Alert Strip + 3 key KPIs + Action Queue
2. **Insights** (analytics tab) — Distribution/activity/project comparison. Charts + project breakdown + detailed filters
3. **Manage** (operations tab) — Create/scan/optimize/batch operations. Context Optimizer, Wizard, Search/Settings

**Screen Design Principles**:
- Limit first-screen cards to 3-4
- Primary CTA: Show at most 2 at all times (`New Component`, `Search`)
- Remaining actions: Move to overflow menu or Command Bar
- Animations: Focus on state change feedback only (minimize persistent pulsing)
- Remove mock data visualizations (ActivityHeatmap, etc.) from main view

**Metrics**:
- Time to First Insight (TTFI): Time from dashboard entry to first meaningful decision — Target 30% reduction
- Scroll Depth on Overview: Percentage resolved without scrolling — Target 50%+

---

## Component Creation Wizard Architecture

### Overall Structure

```
WizardModal (5 Steps)
├─ TypeSelectStep          # Type selection (skill, agent, command, hook, rule)
├─ TemplateSelectStep      # Template selection → GET /api/templates/{id}
├─ BasicInfoStep           # Dynamic form (FieldRenderer)
├─ PreviewStep             # Markdown preview → POST /api/components/generate
└─ SaveStep                # Save → POST /api/components/save
```

### Design Decisions

- **State Management**: `useWizardForm` hook manages entire wizard form state (Zustand-like pattern)
- **Dynamic Form Rendering**: `FieldRenderer` auto-renders based on field types (`text`, `textarea`, `select`, `multiselect`, `checkbox`) defined in the template
- **Template System**: Backend manages Jinja2-based templates; frontend retrieves/selects/generates via API
- **Validation**: Client-side validation with Zod schemas
- **Code Splitting**: Lazy load the wizard to minimize initial bundle size

### Extension Methods

**Adding a new field type**: Add type to `types/index.ts` → Add case to `FieldRenderer.tsx` → Add schema to `validation.ts`

**Adding a new component type**: Add value to `ComponentType` → Add card to `TypeSelectStep` → Add to backend `ComponentType` Enum

### Directory Structure

```
packages/web/src/features/component-wizard/
├── components/
│   ├── WizardModal.tsx, WizardHeader.tsx, WizardFooter.tsx
│   ├── TypeCard.tsx, TemplateCard.tsx, FieldRenderer.tsx
│   └── steps/  (TypeSelectStep, TemplateSelectStep, BasicInfoStep, PreviewStep, SaveStep)
├── hooks/      (useWizardForm, useTemplates)
├── services/   (api.ts, mock-api.ts)
├── types/      (index.ts)
├── schemas/    (validation.ts)
└── index.ts
```

---

## Reference Documents

- Architecture: `.cursor/rules/frontend-architecture.md`
- Conventions: `.cursor/rules/react-conventions.md`
- Workflow: `.cursor/rules/spec-driven-workflow.md`
- Versioning: `.cursor/rules/spec-versioning.md`
