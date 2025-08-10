import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, login, resetData } from './utils';

test('referral bonus applies correctly', async ({ page }) => {
  await resetData(page);
  
  // Create referrer
  const referrerEmail = makeRandomEmail('ref');
  const referrerPassword = 'P@ssw0rd!';
  await signup(page, { email: referrerEmail, password: referrerPassword });
  
  // Get referral code
  await page.goto('/profile');
  const referralCode = await page.locator('[data-testid="referral-code"]').textContent();
  expect(referralCode).toBeTruthy();
  
  // Sign out
  await page.goto('/auth');
  await page.locator('[data-testid="logout-button"]').click();
  
  // Create new user with referral code
  const newUserEmail = makeRandomEmail('new');
  const newUserPassword = 'P@ssw0rd!';
  await signup(page, { 
    email: newUserEmail, 
    password: newUserPassword, 
    referralCode: referralCode! 
  });
  
  // Assert: lands on Dashboard (no white screen)
  await expect(page.locator('text=Dashboard')).toBeVisible();
  
  // Check new user has points
  await page.goto('/profile');
  const newUserPoints = await page.locator('[data-testid="total-points"]').textContent();
  expect(parseInt(newUserPoints!.replace(/[^0-9]/g, ''))).toBeGreaterThanOrEqual(200);
  
  // Sign out and check referrer points
  await page.goto('/auth');
  await page.locator('[data-testid="logout-button"]').click();
  
  await login(page, { email: referrerEmail, password: referrerPassword });
  await page.goto('/profile');
  const referrerPoints = await page.locator('[data-testid="total-points"]').textContent();
  expect(parseInt(referrerPoints!.replace(/[^0-9]/g, ''))).toBeGreaterThanOrEqual(200);
});