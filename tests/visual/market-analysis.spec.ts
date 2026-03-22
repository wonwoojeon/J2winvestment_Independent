import { expect, test } from '@playwright/test';

test.describe('Market Analysis Public Entry', () => {
  test('public landing exposes market analysis CTA and route shell', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.getByRole('button', { name: '오늘의 시장분석' })).toBeVisible();
    await page.getByRole('button', { name: '오늘의 시장분석' }).click();

    await expect(page).toHaveURL(/\/market-analysis$/);
    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '운영 상태' }).first()).toBeVisible();
  });

  test('direct market analysis route renders operating status panel', async ({ page }) => {
    await page.goto('/market-analysis', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: '오늘의 시장분석' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '운영 상태' }).first()).toBeVisible();
  });
});
