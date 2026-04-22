/**
 * Dashboard Page Object
 * v1.13.0 - Dashboard 페이지 Page Object
 */

import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly projectList: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectList = page.locator('[data-testid="project-list"]');
    this.statsCards = page.locator('[data-testid="stats-card"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async getProjectCount(): Promise<number> {
    return await this.projectList.locator('[data-testid="project-item"]').count();
  }

  async clickProject(projectName: string) {
    await this.page.click(`text=${projectName}`);
  }

  async isStatsVisible(): Promise<boolean> {
    return await this.statsCards.first().isVisible();
  }
}
