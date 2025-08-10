import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup } from './utils';

test('shows error message for existing user signup', async ({ page }) => {
  const email = makeRandomEmail('exists');
  const password = 'P@ssw0rd!';
  
  // Sign up once
  await signup(page, { email, password });
  
  // Sign out
  await page.goto('/auth');
  await page.locator('[data-testid="logout-button"]').click();
  
  // Try to sign up again with same email
  await page.goto('/auth');
  
  // Fill signup form with same email
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();
  
  // Expect Turkish error message
  await expect(page.locator('text=Kullanıcı zaten kayıtlı')).toBeVisible();
  
  // Assert no white screen - page stays on Auth and is interactive
  await expect(page.locator('[data-testid="auth-form"]')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /email/i })).toBeEnabled();
});