import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, login, resetData } from './utils';

test('awards first_upload badge after receipt approval', async ({ page }) => {
  await resetData(page);
  
  const email = makeRandomEmail('badge');
  const password = 'P@ssw0rd!';
  
  // Sign up user
  await signup(page, { email, password });
  
  // Check initial profile - no badges
  await page.goto('/profile');
  await expect(page.locator('text=No badges earned yet')).toBeVisible();
  
  // Upload a receipt
  await page.goto('/upload');
  const fileChooser = page.locator('input[type="file"]');
  await fileChooser.setInputFiles('tests/fixtures/receipt_migros.jpg');
  await page.getByRole('button', { name: /upload/i }).click();
  
  // Wait for success
  await expect(page.locator('text=Receipt uploaded successfully')).toBeVisible();
  
  // Make self admin and approve receipt
  await page.evaluate(() => {
    return fetch('/api/qa-admin', { method: 'POST' });
  });
  
  // Go to admin and approve
  await page.goto('/admin');
  if (await page.locator('[data-testid="approve-button"]').first().isVisible()) {
    await page.locator('[data-testid="approve-button"]').first().click();
    await expect(page.locator('text=Onaylandı')).toBeVisible();
  }
  
  // Check profile for badge
  await page.goto('/profile');
  await expect(page.locator('text=First Upload')).toBeVisible();
  await expect(page.locator('text=Current Streak')).toBeVisible();
  await expect(page.locator('text=1')).toBeVisible(); // 1 day streak
});