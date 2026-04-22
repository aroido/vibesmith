/**
 * Project Detail Page Object
 * 프로젝트 상세 페이지 Page Object
 */

import { Page, Locator } from '@playwright/test';

export class ProjectDetailPage {
  readonly page: Page;
  readonly projectName: Locator;
  readonly projectDescription: Locator;
  readonly statsCards: Locator;
  readonly tabNavigation: Locator;
  readonly componentList: Locator;
  readonly searchInput: Locator;
  readonly sortSelect: Locator;
  readonly backButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectName = page.locator('h1');
    this.projectDescription = page.locator('p').first();
    this.statsCards = page.locator('[data-testid="stats-card"]');
    this.tabNavigation = page.getByRole('tablist');
    this.componentList = page.locator('[role="list"]');
    this.searchInput = page.getByPlaceholder(/검색|search/i);
    this.sortSelect = page.getByRole('combobox');
    this.backButton = page.getByRole('button', { name: /뒤로|back|dashboard/i });
    this.settingsButton = page.getByTestId('project-settings-button');
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}`);
  }

  async selectTab(tab: 'overview' | 'skill' | 'agent' | 'command' | 'hook' | 'rule') {
    await this.page.getByRole('tab', { name: new RegExp(tab, 'i') }).click();
  }

  async searchComponents(query: string) {
    await this.searchInput.fill(query);
  }

  async sortBy(sortOption: 'name' | 'date') {
    await this.sortSelect.selectOption({ value: sortOption });
  }

  async clickBackButton() {
    await this.backButton.click();
  }

  async clickSettingsButton() {
    await this.settingsButton.click();
  }

  async getComponentCount(): Promise<number> {
    const list = await this.componentList.count();
    return list;
  }

  async isStatsVisible(): Promise<boolean> {
    return await this.statsCards.first().isVisible();
  }
}
