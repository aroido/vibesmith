/**
 * Dependency Tree Page Object
 * 종속성 트리 페이지 Page Object
 *
 * Updated: ReactFlow graph was replaced with a tree view.
 */

import { Page, Locator } from '@playwright/test';

export class DependencyGraphPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly nodeSearchInput: Locator;
  readonly hideDisabledCheckbox: Locator;
  readonly riskOnlyCheckbox: Locator;
  readonly emptyState: Locator;
  readonly createComponentLink: Locator;
  readonly typeLegend: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: /Dependency Graph|종속성 그래프/, level: 1 });
    this.nodeSearchInput = page.getByPlaceholder(/name or id|이름 또는 ID/i);
    this.hideDisabledCheckbox = page.getByRole('checkbox', { name: /hide disabled|비활성 숨기기/i });
    this.riskOnlyCheckbox = page.getByRole('checkbox', { name: /risk only|위험만/i });
    this.emptyState = page.getByText(/No components found|구성요소를 찾을 수 없습니다/);
    this.createComponentLink = page.getByRole('link', { name: /Create Component|구성요소 생성/ });
    this.typeLegend = page.locator('.flex.flex-wrap.items-center.gap-3');
  }

  async goto() {
    await this.page.goto('/dependencies');
    await this.pageTitle.waitFor();
  }

  async searchNode(query: string) {
    await this.nodeSearchInput.fill(query);
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  /** Locate a project toggle button by project id */
  projectToggle(projectId: string): Locator {
    return this.page.getByTestId(`project-toggle-${projectId}`);
  }

  /** Locate a type toggle button by composite key (projectId:type) */
  typeToggle(key: string): Locator {
    return this.page.getByTestId(`type-toggle-${key}`);
  }

  /** Locate a tree node button by node id */
  treeNode(nodeId: string): Locator {
    return this.page.getByTestId(`tree-node-${nodeId}`);
  }
}
