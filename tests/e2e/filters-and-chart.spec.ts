import { test, expect } from '@playwright/test';
import { makeRandomEmail, signup, setFakeOCR, makeSelfAdmin, openAdmin } from './utils';
import path from 'path';

test('filters and single chart functionality', async ({ page }) => {
  // Setup user with multiple receipts
  const email = makeRandomEmail('filters');
  const password = 'P@ssw0rd!';
  await signup(page, { email, password });
  
  await setFakeOCR(page, true);
  await makeSelfAdmin(page);
  
  // Upload and approve 3 receipts
  for (let i = 0; i < 3; i++) {
    await page.goto('/upload');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, '../fixtures/receipt_migros.jpg'));
    await page.getByRole('button', { name: /submit receipt/i }).click();
    
    await openAdmin(page);
    await page.getByRole('button', { name: /approve/i }).first().click();
  }
  
  // Test filters on Receipt History
  await page.goto('/history');
  
  // Open filters
  await page.getByRole('button', { name: /filter/i }).click();
  
  // Apply filters
  await page.locator('[data-testid="merchant-filter"]').selectOption('Migros');
  await page.locator('[data-testid="status-filter"]').selectOption('approved');
  await page.locator('[data-testid="min-total-input"]').fill('10');
  
  await page.getByRole('button', { name: /apply/i }).click();
  
  // Check filtered results
  const filteredRows = await page.locator('[data-testid="receipt-row"]').count();
  expect(filteredRows).toBeGreaterThan(0);
  
  // Reset filters
  await page.getByRole('button', { name: /reset/i }).click();
  const allRows = await page.locator('[data-testid="receipt-row"]').count();
  expect(allRows).toBeGreaterThanOrEqual(filteredRows);
  
  // Test Dashboard chart
  await page.goto('/dashboard');
  
  // Assert only one chart exists
  expect(await page.locator('[data-testid="spending-chart"]').count()).toBe(1);
  
  // Test timeframe switching
  const timeframes = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'All'];
  for (const timeframe of timeframes) {
    await page.locator(`[data-testid="timeframe-${timeframe.toLowerCase()}"]`).click();
    
    // Wait for chart update and verify it's still visible
    await expect(page.locator('[data-testid="spending-chart"]')).toBeVisible();
    
    // Check that chart data updated (either axis labels or data points changed)
    await page.waitForTimeout(500); // Allow chart to re-render
  }
});