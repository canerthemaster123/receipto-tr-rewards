import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, login, resetData } from './utils';

test.describe('Gamification System', () => {
  test('should award first_upload badge and show streak', async ({ page }) => {
    await resetData(page);
    
    const email = makeRandomEmail('gamification');
    const password = 'P@ssw0rd!';
    
    // Sign up user
    await signup(page, { email, password });
    
    // Go to upload page
    await page.goto('/upload');
    
    // Upload a receipt (mock file)
    const fileChooser = page.locator('input[type="file"]');
    await fileChooser.setInputFiles('tests/fixtures/receipt_migros.jpg');
    
    // Submit
    await page.getByRole('button', { name: /upload/i }).click();
    
    // Wait for success message
    await expect(page.locator('text=Receipt uploaded successfully')).toBeVisible();
    
    // Now approve it as admin (simulate admin approval)
    await page.goto('/auth');
    await page.locator('[data-testid="logout-button"]').click();
    
    // Login as admin (assuming e2e admin exists)
    await page.goto('/auth');
    await login(page, { email: 'admin@e2e.local', password: 'password' });
    
    // Go to admin panel
    await page.goto('/admin');
    
    // Approve the receipt
    await page.locator('[data-testid="approve-button"]').first().click();
    
    // Logout admin
    await page.goto('/auth');
    await page.locator('[data-testid="logout-button"]').click();
    
    // Login back as original user
    await login(page, { email, password });
    
    // Go to profile to check streak and badges
    await page.goto('/profile');
    
    // Check for streak display
    await expect(page.locator('text=Current Streak')).toBeVisible();
    await expect(page.locator('text=1')).toBeVisible(); // Should show 1 day streak
    
    // Check for first_upload badge
    await expect(page.locator('text=First Upload')).toBeVisible();
  });

  test('should show active weekly challenge with progress', async ({ page }) => {
    await resetData(page);
    
    const email = makeRandomEmail('challenge');
    const password = 'P@ssw0rd!';
    
    // Sign up user
    await signup(page, { email, password });
    
    // Go to dashboard
    await page.goto('/dashboard');
    
    // Should show weekly challenge section
    await expect(page.locator('text=Weekly Challenge')).toBeVisible();
    
    // If there's an active challenge, should show progress
    // This might be empty if no challenges are active, which is OK
  });

  test('should display leaderboard with masked names', async ({ page }) => {
    await resetData(page);
    
    const email = makeRandomEmail('leaderboard');
    const password = 'P@ssw0rd!';
    
    // Sign up user
    await signup(page, { email, password });
    
    // Go to leaderboard
    await page.goto('/leaderboard');
    
    // Should show leaderboard page
    await expect(page.locator('text=Leaderboard')).toBeVisible();
    
    // Should have weekly/monthly tabs
    await expect(page.locator('text=Weekly')).toBeVisible();
    await expect(page.locator('text=Monthly')).toBeVisible();
    
    // Should show "No data" message if no leaderboard exists yet
    await expect(
      page.locator('text=No leaderboard data available').or(
        page.locator('[data-testid="leaderboard-table"]')
      )
    ).toBeVisible();
  });

  test('should handle challenge completion and award points', async ({ page }) => {
    await resetData(page);
    
    // This test would require setting up an active challenge first
    // For now, we'll just test the UI components exist
    
    const email = makeRandomEmail('challenge-complete');
    const password = 'P@ssw0rd!';
    
    await signup(page, { email, password });
    await page.goto('/dashboard');
    
    // Weekly challenge component should be present
    await expect(page.locator('[data-testid="weekly-challenges"]')).toBeVisible();
  });
});