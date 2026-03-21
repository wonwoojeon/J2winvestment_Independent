import { expect, test } from '@playwright/test';

test.describe('Market Analysis Public Entry', () => {
  test('public landing exposes market analysis CTA and empty state route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '오늘의 시장분석' })).toBeVisible();
    await page.getByRole('button', { name: '오늘의 시장분석' }).click();

    await expect(page).toHaveURL(/\/market-analysis$/);
    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByText('아직 게시된 시장분석이 없습니다.')).toBeVisible();
  });

  test('direct market analysis route renders public empty state', async ({ page }) => {
    await page.goto('/market-analysis', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByText('아직 게시된 시장분석이 없습니다.')).toBeVisible();
  });
});
