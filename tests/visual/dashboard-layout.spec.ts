import { expect, test } from '@playwright/test';

test.describe('Dashboard Layout Visual Baseline', () => {
  test('desktop ticker stays visible while scrolling', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('floating-verse-ticker')).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-desktop-initial.png', {
      fullPage: true,
      animations: 'disabled'
    });

    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(300);
    await expect(page.getByTestId('floating-verse-ticker')).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-desktop-scrolled.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  test('mobile ticker/header stack baseline', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('floating-verse-ticker')).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-mobile-initial.png', {
      fullPage: true,
      animations: 'disabled'
    });

    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
    await expect(page.getByTestId('floating-verse-ticker')).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-mobile-scrolled.png', {
      fullPage: true,
      animations: 'disabled'
    });

    await context.close();
  });
});
