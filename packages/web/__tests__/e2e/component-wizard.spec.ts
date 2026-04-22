import { test, expect } from '@playwright/test';

test.describe('Component Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create a new skill component successfully', async ({ page }) => {
    // 1. 마법사 열기
    await page.click('text=New Component');
    await expect(page.locator('text=Select Component Type')).toBeVisible();

    // 2. Step 1: 타입 선택 (Skill)
    await page.click('[data-testid="type-card-skill"]');
    await page.click('button:has-text("Next")');

    // 3. Step 2: 템플릿 선택
    await expect(page.locator('text=Select Template')).toBeVisible();
    // 첫 번째 템플릿 선택 (Mock 데이터)
    await page.click('[data-testid^="template-card-"]').first();
    await page.click('button:has-text("Next")');

    // 4. Step 3: 기본 정보 입력
    await expect(page.locator('text=Basic Information')).toBeVisible();
    await page.fill('input[name="skill_name"]', 'my-test-skill');
    await page.fill('textarea[name="description"]', 'Test automation skill');
    await page.fill('input[name="tags"]', 'python, testing');
    await page.click('button:has-text("Next")');

    // 5. Step 4: 미리보기
    await expect(page.locator('text=Preview')).toBeVisible();
    await expect(page.locator('text=my-test-skill')).toBeVisible();
    await page.click('button:has-text("Next")');

    // 6. Step 5: 저장
    await expect(page.locator('text=Save')).toBeVisible();
    
    // 프로젝트 선택 (첫 번째 프로젝트)
    const projectSelect = page.locator('select, [role="combobox"]').first();
    await projectSelect.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // 저장 버튼 클릭
    await page.click('button:has-text("Save Component"), button:has-text("컴포넌트 저장")');

    // 7. 성공 확인
    await expect(
      page.locator('text=저장 완료!, text=Component created successfully!')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should block next step when type is not selected', async ({ page }) => {
    await page.click('text=New Component');

    // Next 버튼이 비활성화되어 있어야 함
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeDisabled();
  });

  test('should show validation error for required fields', async ({ page }) => {
    await page.click('text=New Component');

    // Step 1: 타입 선택
    await page.click('[data-testid="type-card-skill"]');
    await page.click('button:has-text("Next")');

    // Step 2: 템플릿 선택
    await page.click('[data-testid^="template-card-"]').first();
    await page.click('button:has-text("Next")');

    // Step 3: 필수 필드 비우고 Next 클릭
    await page.click('button:has-text("Next")');

    // 에러 메시지 표시 (React Hook Form 검증)
    // 정확한 에러 메시지는 구현에 따라 다를 수 있음
    const errorMessage = page.locator('text=required, text=필수');
    await expect(errorMessage.first()).toBeVisible({ timeout: 2000 });
  });

  test('should show confirmation dialog when closing with unsaved changes', async ({
    page,
  }) => {
    await page.click('text=New Component');

    // Step 1: 타입 선택
    await page.click('[data-testid="type-card-skill"]');

    // 모달 닫기 시도 (Escape 키)
    await page.keyboard.press('Escape');

    // 확인 다이얼로그 표시
    await expect(
      page.locator('text=작업을 중단하시겠습니까?')
    ).toBeVisible({ timeout: 2000 });
    await expect(
      page.locator('text=저장하지 않은 내용은 사라집니다')
    ).toBeVisible();

    // 계속 작업 선택
    await page.click('button:has-text("계속 작업")');

    // 모달이 여전히 열려 있음
    await expect(page.locator('text=Select Component Type')).toBeVisible();
  });

  test('should close modal without confirmation when no changes', async ({
    page,
  }) => {
    await page.click('text=New Component');

    // 아무 선택 없이 Escape
    await page.keyboard.press('Escape');

    // 확인 다이얼로그 없이 바로 닫힘
    await expect(page.locator('text=Select Component Type')).not.toBeVisible({
      timeout: 1000,
    });
  });

  test('should navigate with keyboard', async ({ page }) => {
    await page.click('text=New Component');

    // Tab으로 첫 번째 타입 카드 포커스
    await page.keyboard.press('Tab');

    // Enter로 선택
    await page.keyboard.press('Enter');

    // Next 버튼으로 Tab 이동
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Step 2로 이동 확인
    await expect(page.locator('text=Select Template')).toBeVisible();
  });

  test('should handle project selection', async ({ page }) => {
    // ... Step 1-4 진행 (생략)

    // Step 5: 프로젝트 없을 때
    await page.route('**/api/projects', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify([]),
      });
    });

    await page.reload();
    // ... Step 1-4 다시 진행

    // 프로젝트 없음 메시지 표시
    await expect(page.locator('text=프로젝트가 없습니다')).toBeVisible();
    await expect(page.locator('text=Settings로 이동')).toBeVisible();

    // 저장 버튼 비활성화
    const saveButton = page.locator('button:has-text("Save"), button:has-text("저장")');
    await expect(saveButton).not.toBeVisible();
  });
});
