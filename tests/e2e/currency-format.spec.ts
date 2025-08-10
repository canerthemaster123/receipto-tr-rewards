import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, setFakeOCR, makeSelfAdmin, openAdmin } from './utils';
import path from 'path';

test('currency format shows ₺ everywhere, no $', async ({ page }) => {
  // Setup user with approved receipt
  const email = makeRandomEmail('currency');
  const password = 'P@ssw0rd!';
  await signup(page, { email, password });
  
  await setFakeOCR(page, true);
  
  // Upload and approve receipt
  await page.goto('/upload');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/receipt_migros.jpg'));
  await page.getByRole('button', { name: /submit receipt/i }).click();
  
  await makeSelfAdmin(page);
  await openAdmin(page);
  await page.getByRole('button', { name: /approve/i }).first().click();
  
  // Check Dashboard - no $ symbols
  await page.goto('/dashboard');
  expect(await page.locator('text=$').count()).toBe(0);
  expect(await page.locator('text=₺').count()).toBeGreaterThan(0);
  
  // Check History page
  await page.goto('/history');
  expect(await page.locator('text=$').count()).toBe(0);
  expect(await page.locator('text=₺').count()).toBeGreaterThan(0);
  
  // Check Admin page
  await openAdmin(page);
  expect(await page.locator('text=$').count()).toBe(0);
  expect(await page.locator('text=₺').count()).toBeGreaterThan(0);
  
  // Check Rewards page
  await page.goto('/rewards');
  expect(await page.locator('text=$').count()).toBe(0);
});