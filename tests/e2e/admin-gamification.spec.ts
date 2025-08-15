import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, resetData } from './utils';

test('admin can manage badges and challenges', async ({ page }) => {
  await resetData(page);
  
  // Create admin user
  const email = makeRandomEmail('admin');
  const password = 'P@ssw0rd!';
  
  await signup(page, { email, password });
  
  // Make self admin
  await page.evaluate(() => {
    return fetch('/api/qa-admin', { method: 'POST' });
  });
  
  // Go to admin panel
  await page.goto('/admin');
  
  // Should see gamification tab
  await expect(page.locator('text=Gamification')).toBeVisible();
  
  // Click gamification tab
  await page.getByRole('tab', { name: /gamification/i }).click();
  
  // Should see badges management
  await expect(page.locator('text=Badges Management')).toBeVisible();
  
  // Should see challenges management
  await expect(page.locator('text=Weekly Challenges')).toBeVisible();
  
  // Should see leaderboard management
  await expect(page.locator('text=Leaderboard Management')).toBeVisible();
  
  // Test adding a badge
  await page.getByRole('button', { name: /add badge/i }).click();
  await page.fill('input[placeholder*="first_upload"]', 'test_badge');
  await page.fill('input:has-text("Name (English)")', 'Test Badge');
  await page.fill('input:has-text("Name (Turkish)")', 'Test Rozeti');
  await page.getByRole('button', { name: /save/i }).click();
  
  // Should show success message
  await expect(page.locator('text=Badge created successfully')).toBeVisible();
});

test('admin can generate leaderboard snapshots', async ({ page }) => {
  await resetData(page);
  
  const email = makeRandomEmail('admin-lb');
  const password = 'P@ssw0rd!';
  
  await signup(page, { email, password });
  
  // Make self admin
  await page.evaluate(() => {
    return fetch('/api/qa-admin', { method: 'POST' });
  });
  
  await page.goto('/admin');
  await page.getByRole('tab', { name: /gamification/i }).click();
  
  // Test generating weekly leaderboard
  await page.getByRole('button', { name: /generate weekly/i }).click();
  await expect(page.locator('text=Weekly leaderboard generated successfully')).toBeVisible();
  
  // Test generating monthly leaderboard
  await page.getByRole('button', { name: /generate monthly/i }).click();
  await expect(page.locator('text=Monthly leaderboard generated successfully')).toBeVisible();
});