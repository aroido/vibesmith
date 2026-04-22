/**
 * Toggle Enhancement E2E Tests
 * Spec: toggle-enhancement.md Appendix B.3
 * - Status 필터로 활성화/비활성화 필터링
 * - 토글 시 종속성 경고 모달
 * - Disable Anyway / Cancel / 즉시 토글
 */

import { test, expect } from '@playwright/test';

const MOCK_COMPONENT = {
  id: 'comp_toggle_test',
  type: 'skill' as const,
  name: 'fastapi-route',
  description: 'FastAPI 스캐폴딩',
  enabled: true,
  tags: ['python'],
  project_id: 'proj_001',
  project_name: 'vibesmith',
  path: '/path/to/skill',
  content: '',
  frontmatter: {},
  dependencies: { depends_on: [], depended_by: [] },
  created_at: '2026-02-09T10:00:00Z',
  updated_at: '2026-02-09T15:00:00Z',
};

test.describe('Toggle Enhancement E2E', () => {
  test('should filter by status when Status filter changed', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    await expect(page.getByLabel('활성화 상태 필터')).toBeVisible();

    await page.getByLabel('활성화 상태 필터').selectOption('enabled');
    await expect(page).toHaveURL(/status=enabled/);

    await page.getByLabel('활성화 상태 필터').selectOption('disabled');
    await expect(page).toHaveURL(/status=disabled/);
  });

  test('should show dependency warning modal when toggle returns affected_dependencies', async ({
    page,
  }) => {
    await page.route(/\/api\/components\/[^/]+\/toggle/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'comp_toggle_test',
            enabled: false,
            affected_dependencies: [
              { id: 'comp_010', name: 'pydantic-model', type: 'skill' },
              { id: 'comp_020', name: 'pytest-write', type: 'skill' },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });
    await page.route(/\/api\/components\/[^/]+$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPONENT),
        });
      } else {
        await route.continue();
      }
    });
    await page.route(/\/api\/components(\?|$)/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_COMPONENT]),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.getByRole('link', { name: /상세 보기|fastapi-route/ }).first();
    await firstLink.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '비활성화' }).click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Disable .*\?/)).toBeVisible();
    await expect(page.getByText(/pydantic-model/)).toBeVisible();
    await expect(page.getByText(/pytest-write/)).toBeVisible();
  });

  test('should complete toggle when Disable Anyway clicked', async ({ page }) => {
    await page.route(/\/api\/components\/[^/]+\/toggle/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'comp_toggle_test',
            enabled: false,
            affected_dependencies: [
              { id: 'comp_010', name: 'pydantic-model', type: 'skill' },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });
    await page.route(/\/api\/components\/[^/]+$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPONENT),
        });
      } else {
        await route.continue();
      }
    });
    await page.route(/\/api\/components(\?|$)/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_COMPONENT]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.getByRole('link', { name: /상세 보기|fastapi-route/ }).first();
    await firstLink.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '비활성화' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /비활성화 anyway|Disable Anyway/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('비활성화되었습니다')).toBeVisible({ timeout: 3000 });
  });

  test('should rollback when Cancel clicked', async ({ page }) => {
    let toggleCallCount = 0;
    await page.route('**/api/components/*/toggle', async (route) => {
      if (route.request().method() === 'POST') {
        toggleCallCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'comp_toggle_test',
            enabled: toggleCallCount === 1 ? false : true,
            affected_dependencies:
              toggleCallCount === 1
                ? [{ id: 'comp_010', name: 'pydantic-model', type: 'skill' }]
                : [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/components/*', async (route) => {
      const request = route.request();
      if (request.method() === 'GET' && !request.url().includes('/toggle')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPONENT),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.getByRole('link', { name: /상세 보기|fastapi-route/ }).first();
    await firstLink.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '비활성화' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /취소|Cancel/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText('취소되었습니다')).toBeVisible({ timeout: 5000 });
  });

  test('should toggle immediately when no dependencies', async ({ page }) => {
    await page.route('**/api/components/*/toggle', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'comp_toggle_test',
            enabled: false,
            affected_dependencies: [],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/components/*', async (route) => {
      const request = route.request();
      if (request.method() === 'GET' && !request.url().includes('/toggle')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPONENT),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/components');
    await page.waitForLoadState('networkidle');

    const firstLink = page.getByRole('link', { name: /상세 보기|fastapi-route/ }).first();
    await firstLink.click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '비활성화' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByText(/비활성화되었습니다/)).toBeVisible({ timeout: 5000 });
  });
});
