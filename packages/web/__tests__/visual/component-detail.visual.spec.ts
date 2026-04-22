import { test, expect } from '@playwright/test';

/**
 * Component Detail 페이지 시각적 회귀 테스트
 * 
 * 목적: 컴포넌트 상세 정보, 의존성 그래프, 메타데이터 UI의 시각적 변경 감지
 */

test.describe('Component Detail Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // 첫 번째 컴포넌트 상세 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 첫 번째 컴포넌트 카드 클릭
    const firstCard = page.locator('[data-testid="component-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should match full detail page', async ({ page }) => {
    // 전체 상세 페이지 스냅샷
    await expect(page).toHaveScreenshot('component-detail-full.png', {
      fullPage: true,
      maxDiffPixels: 150,
    });
  });

  test('should match header section', async ({ page }) => {
    // 헤더 영역 스냅샷
    const header = page.locator('[data-testid="detail-header"]').first();
    
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('component-detail-header.png');
    }
  });

  test('should match metadata section', async ({ page }) => {
    // 메타데이터 영역 스냅샷
    const metadata = page.locator('[data-testid="metadata-section"]').first();
    
    if (await metadata.isVisible()) {
      await expect(metadata).toHaveScreenshot('component-detail-metadata.png');
    }
  });

  test('should match dependency graph', async ({ page }) => {
    // 의존성 그래프 스냅샷
    const graph = page.locator('[data-testid="dependency-graph"]').first();
    
    if (await graph.isVisible()) {
      // 그래프 렌더링 완료 대기
      await page.waitForTimeout(1000);
      
      await expect(graph).toHaveScreenshot('component-detail-graph.png', {
        maxDiffPixels: 200, // 그래프는 렌더링 차이가 클 수 있음
      });
    }
  });

  test('should match code preview', async ({ page }) => {
    // 코드 프리뷰 영역 스냅샷
    const codePreview = page.locator('[data-testid="code-preview"]').first();
    
    if (await codePreview.isVisible()) {
      await expect(codePreview).toHaveScreenshot('component-detail-code.png');
    }
  });

  test('should match tabs section', async ({ page }) => {
    // 탭 영역 스냅샷
    const tabs = page.locator('[data-testid="detail-tabs"]').first();
    
    if (await tabs.isVisible()) {
      await expect(tabs).toHaveScreenshot('component-detail-tabs.png');
    }
  });
});

test.describe('Component Detail Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const firstCard = page.locator('[data-testid="component-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('should match expanded dependencies', async ({ page }) => {
    // 의존성 확장 버튼 클릭
    const expandButton = page.locator('[data-testid="expand-dependencies"]').first();
    
    if (await expandButton.isVisible()) {
      await expandButton.click();
      await page.waitForTimeout(500);
      
      await expect(page).toHaveScreenshot('component-detail-dependencies-expanded.png', {
        fullPage: true,
      });
    }
  });

  test('should match different tab views', async ({ page }) => {
    // 각 탭 클릭하여 스냅샷
    const tabs = ['overview', 'dependencies', 'usage', 'history'];
    
    for (const tabName of tabs) {
      const tab = page.locator(`[data-testid="tab-${tabName}"]`).first();
      
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(300);
        
        await expect(page).toHaveScreenshot(`component-detail-tab-${tabName}.png`, {
          fullPage: true,
        });
      }
    }
  });
});

test.describe('Component Detail Responsive', () => {
  test('should match mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const firstCard = page.locator('[data-testid="component-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('component-detail-mobile.png', {
        fullPage: true,
      });
    }
  });

  test('should match tablet layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const firstCard = page.locator('[data-testid="component-card"]').first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot('component-detail-tablet.png', {
        fullPage: true,
      });
    }
  });
});
