import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, setFakeOCR, resetData, makeSelfAdmin, openAdmin } from './utils';
import path from 'path';

test('upload → approve → points flow works', async ({ page }) => {
  await resetData(page);
  
  // Sign up user
  const email = makeRandomEmail('u');
  const password = 'P@ssw0rd!';
  await signup(page, { email, password });
  
  // Enable fake OCR
  await setFakeOCR(page, true);
  
  // Upload receipt
  await page.goto('/upload');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, '../fixtures/receipt_migros.jpg'));
  
  await page.getByRole('button', { name: /submit receipt/i }).click();
  
  // Check status is pending
  await page.goto('/history');
  await expect(page.locator('text=Onay bekliyor')).toBeVisible();
  
  // Make self admin
  await makeSelfAdmin(page);
  
  // Open admin and approve
  await openAdmin(page);
  await page.getByRole('button', { name: /approve/i }).first().click();
  
  // Go to dashboard and check points updated
  await page.goto('/dashboard');
  const pointsText = await page.locator('[data-testid="total-points"]').textContent();
  const points = parseInt(pointsText!.replace(/[^0-9]/g, ''));
  expect(points).toBe(100);
  
  // Check status changed to approved
  await page.goto('/history');
  await expect(page.locator('text=Onaylandı')).toBeVisible();
});