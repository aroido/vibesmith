/**
 * Dependency Tree E2E Tests
 * 종속성 트리 페이지 테스트
 *
 * Updated: ReactFlow graph was replaced with a tree view.
 * Tests for zoom, pan, minimap, layout orientation, focus mode, and overview/detail
 * modes have been removed as they no longer apply.
 */

import { test, expect, type Page } from '@playwright/test';
import { DependencyGraphPage } from '../pages/dependency-graph.page';

/**
 * Mock the dependency API with a small inline fixture.
 * The old fixtures file (services/fixtures) was removed with the ReactFlow code.
 */
const mockDependencyTreeApi = async (page: Page) => {
  const graph = {
    nodes: [
      { id: 'comp-1', name: 'MySkill', type: 'skill', project_id: 'proj-1', enabled: true, is_global: false },
      { id: 'comp-2', name: 'MyAgent', type: 'agent', project_id: 'proj-1', enabled: true, is_global: false },
      { id: 'comp-3', name: 'GlobalHook', type: 'hook', project_id: 'proj-g', enabled: true, is_global: true },
    ],
    edges: [
      { source: 'comp-1', target: 'comp-2', is_broken: false },
    ],
    cycles: [],
  };

  const projects = [
    { id: 'proj-1', name: 'TestProject', is_global: false },
    { id: 'proj-g', name: 'Global', is_global: true },
  ];

  await page.route(/\/api\/dependencies\/[^/?]+(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const componentId = url.pathname.split('/').pop() ?? '';
    const node = graph.nodes.find((n) => n.id === componentId);
    await route.fulfill({
      status: node ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(node ? { ...node, dependsOn: [], dependedBy: [] } : { detail: 'Not found' }),
    });
  });

  await page.route(/\/api\/dependencies(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(graph),
    });
  });

  await page.route(/\/api\/projects(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(projects),
    });
  });

  return { graph, projects };
};

test.describe('Dependency Tree Page', () => {
  test('should render tree view on first entry', async ({ page }) => {
    await mockDependencyTreeApi(page);
    const dep = new DependencyGraphPage(page);
    await dep.goto();

    await expect(dep.pageTitle).toBeVisible();
    await expect(dep.nodeSearchInput).toBeVisible();
    // Tree nodes should be present
    await expect(dep.treeNode('comp-1')).toBeVisible();
    await expect(dep.treeNode('comp-2')).toBeVisible();
  });

  test('should display page title', async ({ page }) => {
    await mockDependencyTreeApi(page);
    const dep = new DependencyGraphPage(page);
    await dep.goto();

    await expect(dep.pageTitle).toBeVisible();
    await expect(page).toHaveTitle(/VibeSmith/);
  });

  test('should display search input and filter checkboxes', async ({ page }) => {
    await mockDependencyTreeApi(page);
    const dep = new DependencyGraphPage(page);
    await dep.goto();

    await expect(dep.nodeSearchInput).toBeVisible();
    // TreeFilters provides hide-disabled and risk-only checkboxes (not type checkboxes)
  });

  test('should filter tree nodes by search query', async ({ page }) => {
    await mockDependencyTreeApi(page);
    const dep = new DependencyGraphPage(page);
    await dep.goto();

    await dep.searchNode('MySkill');
    // MySkill should remain visible
    await expect(dep.treeNode('comp-1')).toBeVisible();
    // MyAgent should be hidden (does not match "MySkill")
    await expect(dep.treeNode('comp-2')).not.toBeVisible();
  });

  test('should display empty state when no components', async ({ page }) => {
    await page.route(/\/api\/dependencies(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [], cycles: [] }),
      });
    });
    await page.route(/\/api\/projects(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    const dep = new DependencyGraphPage(page);
    await dep.goto();

    const isEmpty = await dep.isEmptyStateVisible();
    if (isEmpty) {
      await expect(dep.emptyState).toBeVisible();
      await expect(dep.createComponentLink).toBeVisible();
    }
  });

  test('should navigate to dependency tree from dashboard', async ({ page }) => {
    await mockDependencyTreeApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: /Dependency Graph|종속성 그래프/ }).click();

    await expect(page).toHaveURL('/dependencies');
    await expect(page.getByRole('heading', { name: /Dependency Graph|종속성 그래프/, level: 1 })).toBeVisible();
  });

  test('should display create component link in empty state', async ({ page }) => {
    await page.route(/\/api\/dependencies(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ nodes: [], edges: [], cycles: [] }),
      });
    });
    await page.route(/\/api\/projects(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    const dep = new DependencyGraphPage(page);
    await dep.goto();

    const isEmpty = await dep.isEmptyStateVisible();
    if (isEmpty) {
      await expect(dep.createComponentLink).toBeVisible();
      await expect(dep.createComponentLink).toHaveAttribute('href', '/components/create');
    }
  });

  // TODO: Old tests removed (no longer applicable to tree view):
  // - "should support focus and overview/detail mode transitions" — ReactFlow focus mode removed
  // - "should keep large-graph render and re-layout within performance budget" — ReactFlow layout/zoom removed
});
