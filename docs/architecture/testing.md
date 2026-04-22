# Testing Guide

VibeSmith frontend testing guide

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Unit Tests (Vitest)](#unit-tests-vitest)
- [E2E Tests (Playwright)](#e2e-tests-playwright)
- [Accessibility Tests (axe-core)](#accessibility-tests-axe-core)
- [Performance Tests (Lighthouse CI)](#performance-tests-lighthouse-ci)
- [CI/CD Integration](#cicd-integration)

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (10%)
      /    \     - Playwright
     /------\
    /        \   Integration Tests (20%)
   /          \  - React Testing Library
  /------------\
 /              \ Unit Tests (70%)
/________________\ - Vitest
```

### Coverage Targets

| Metric | Target | Tool |
|--------|--------|------|
| **Branches** | 80% | Vitest |
| **Functions** | 80% | Vitest |
| **Lines** | 80% | Vitest |
| **Statements** | 80% | Vitest |
| **Accessibility** | 100% | axe-core |
| **Performance** | 90+ | Lighthouse |

---

## Unit Tests (Vitest)

### Configuration

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
});
```

### Component Tests

```typescript
// src/components/Button/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { axe } from 'jest-axe';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn();
    const { user } = render(<Button onClick={handleClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not have accessibility violations', async () => {
    const { container } = render(<Button>Click</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Hook Tests

```typescript
// src/hooks/useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('increments count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

### Running Tests

```bash
# Run tests
npm test

# Watch mode
npm test -- --watch

# UI mode
npm run test:ui

# Coverage
npm test -- --coverage
```

---

## E2E Tests (Playwright)

### Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

### Page Tests

```typescript
// __tests__/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads and displays data', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for loading to complete
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();

    // Verify data
    await expect(page.locator('[data-testid="component-count"]')).toContainText('42');
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/dashboard');

    await page.click('text=Settings');
    await expect(page).toHaveURL('/settings');
  });
});
```

### Running Tests

```bash
# All browsers
npm run test:e2e

# UI mode
npm run test:e2e:ui

# Specific browser
npm run test:e2e -- --project=chromium

# Debug mode
npm run test:e2e -- --debug
```

---

## Accessibility Tests (axe-core)

### Playwright Integration

```typescript
// __tests__/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility @a11y', () => {
  test('homepage should not have violations', async ({ page }) => {
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

### Unit Test Integration

```typescript
// src/components/Form/Form.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Form } from './Form';

it('should not have accessibility violations', async () => {
  const { container } = render(<Form />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Running Tests

```bash
# Run accessibility tests only
npm run test:a11y

# Specific tag
npm run test:e2e -- --grep @a11y
```

---

## Performance Tests (Lighthouse CI)

### Configuration

```javascript
// lighthouserc.js
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: ['http://localhost:4173'],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
  },
};
```

### Running Tests

```bash
# Build
npm run build

# Start preview server (separate terminal)
npm run preview

# Run Lighthouse CI
npx @lhci/cli autorun
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/frontend-ci.yml
name: Frontend CI
on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build
```

### Parallel Execution

```yaml
jobs:
  unit-test:
    # Unit tests

  e2e-chromium:
    # E2E (Chromium)

  e2e-firefox:
    # E2E (Firefox)

  accessibility:
    # Accessibility tests

  lighthouse:
    # Performance tests
```

---

## Best Practices

### 1. Test Writing Principles

- **AAA Pattern**: Arrange, Act, Assert
- **Single Responsibility**: One test covers one behavior
- **Independence**: No dependencies between tests
- **Repeatable**: Same results whenever executed

### 2. Naming Conventions

```typescript
describe('ComponentName', () => {
  it('should do something when condition', () => {
    // ...
  });
});
```

### 3. Accessibility First

Include accessibility validation in all component tests:

```typescript
it('should not have accessibility violations', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 4. Minimize E2E Tests

- Only core user flows as E2E
- Rest covered by unit/integration tests

### 5. Set Performance Budgets

```javascript
// lighthouserc.js
assertions: {
  'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
}
```

---

## Troubleshooting

### Playwright Timeout

```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Vitest Out of Memory

```json
{
  "scripts": {
    "test": "NODE_OPTIONS=--max-old-space-size=4096 vitest"
  }
}
```

### Lighthouse CI Failure

```bash
# Check if preview server is running
curl http://localhost:4173

# Change port
LHCI_PORT=4174 lhci autorun
```

---

## References

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

---

**Last Updated:** 2026-02-12
