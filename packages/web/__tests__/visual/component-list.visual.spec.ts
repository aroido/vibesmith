import { test, expect } from '@playwright/test';

/**
 * Component List 페이지 시각적 회귀 테스트
 * 
 * 목적: 컴포넌트 목록, 필터, 검색 UI의 시각적 변경 감지
 */

test.describe('Component List Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // 컴포넌트 목록 페이지로 이동
    await page.goto('/');
    
    // 데이터 로딩 완료 대기
    await page.waitForLoadState('networkidle');
  });

  test('should match full component list', async ({ page }) => {
    // 전체 목록 스냅샷
    await expect(page).toHaveScreenshot('component-list-full.png', {
      fullPage: true,
      maxDiffPixels: 150,
    });
  });

  test('should match search bar', async ({ page }) => {
    // 검색 바 영역 스냅샷
    const searchBar = page.locator('[data-testid="search-bar"]').first();
    
    if (await searchBar.isVisible()) {
      await expect(searchBar).toHaveScreenshot('component-list-search.png');
    }
  });

  test('should match filter section', async ({ page }) => {
    // 필터 영역 스냅샷
    const filterSection = page.locator('[data-testid="filter-section"]').first();
    
    if (await filterSection.isVisible()) {
      await expect(filterSection).toHaveScreenshot('component-list-filters.png');
    }
  });

  test('should match component card', async ({ page }) => {
    // 첫 번째 컴포넌트 카드 스냅샷
    const firstCard = page.locator('[data-testid="component-card"]').first();
    
    if (await firstCard.isVisible()) {
      await expect(firstCard).toHaveScreenshot('component-card.png');
    }
  });

  test('should match grid layout', async ({ page }) => {
    // 그리드 레이아웃 스냅샷
    const gridContainer = page.locator('[data-testid="component-grid"]').first();
    
    if (await gridContainer.isVisible()) {
      await expect(gridContainer).toHaveScreenshot('component-list-grid.png');
    }
  });

  test('should match empty state', async ({ page }) => {
    // 검색 결과 없음 상태
    const searchInput = page.locator('input[type="search"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('nonexistentcomponent12345');
      await page.waitForTimeout(500);
      
      // 빈 상태 스냅샷
      await expect(page).toHaveScreenshot('component-list-empty.png');
    }
  });
});

test.describe('Component List Interactions', () => {
  test('should match search results', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 검색 입력
    const searchInput = page.locator('input[type="search"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('button');
      await page.waitForTimeout(500);
      
      // 검색 결과 스냅샷
      await expect(page).toHaveScreenshot('component-list-search-results.png', {
        fullPage: true,
      });
    }
  });

  test('should match filtered view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 필터 적용 (예: 타입 필터)
    const filterButton = page.locator('[data-testid="filter-type"]').first();
    
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);
      
      // 필터 적용 후 스냅샷
      await expect(page).toHaveScreenshot('component-list-filtered.png', {
        fullPage: true,
      });
    }
  });
});

test.describe('Component List Responsive', () => {
  test('should match mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('component-list-mobile.png', {
      fullPage: true,
    });
  });

  test('should match tablet layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('component-list-tablet.png', {
      fullPage: true,
    });
  });
});
