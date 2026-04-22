/**
 * Trash Page Object
 * 휴지통 페이지 Page Object
 */

import { Page, Locator } from '@playwright/test';

export class TrashPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly refreshButton: Locator;
  readonly emptyAllButton: Locator;
  readonly emptyState: Locator;
  readonly trashItems: Locator;
  readonly goToComponentsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole('heading', { name: '휴지통', level: 1 });
    this.refreshButton = page.getByRole('button', { name: /새로고침|refresh/i });
    this.emptyAllButton = page.getByRole('button', { name: /모두 비우기|empty all/i });
    this.emptyState = page.getByRole('heading', { name: /휴지통이 비어 있습니다|empty/i, level: 2 });
    this.trashItems = page.locator('[role="list"] > *');
    this.goToComponentsLink = page.getByRole('link', { name: /구성요소 목록으로/ });
  }

  async goto() {
    await this.page.goto('/trash');
    await this.pageTitle.waitFor();
  }

  async clickRefresh() {
    await this.refreshButton.click();
  }

  async clickEmptyAll() {
    await this.emptyAllButton.click();
  }

  async confirmEmptyAll() {
    // 확인 모달에서 확인 버튼 클릭
    await this.page.getByRole('button', { name: /모두 비우기|empty all/i }).last().click();
  }

  async cancelEmptyAll() {
    // 확인 모달에서 취소 버튼 클릭
    await this.page.getByRole('button', { name: /취소|cancel/i }).click();
  }

  async restoreItem(itemName: string) {
    // 특정 항목 복원
    const item = this.page.locator(`text=${itemName}`).locator('..');
    await item.getByRole('button', { name: /복원|restore/i }).click();
  }

  async deleteItemPermanently(itemName: string) {
    // 특정 항목 영구 삭제
    const item = this.page.locator(`text=${itemName}`).locator('..');
    await item.getByRole('button', { name: /영구 삭제|delete/i }).click();
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible();
  }

  async getTrashItemCount(): Promise<number> {
    const isEmpty = await this.isEmptyStateVisible();
    if (isEmpty) return 0;
    return await this.trashItems.count();
  }
}
