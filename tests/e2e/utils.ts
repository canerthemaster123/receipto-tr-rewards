import { Page, expect } from '@playwright/test';
import { supabase } from '../../src/integrations/supabase/client';

export function makeRandomEmail(tag: string): string {
  return `test+${tag}-${Date.now()}@e2e.local`;
}

export async function signup(page: Page, options: { email: string; password: string; referralCode?: string }) {
  await page.goto('/auth');
  
  // Fill signup form
  await page.getByRole('textbox', { name: /email/i }).fill(options.email);
  await page.getByRole('textbox', { name: /password/i }).fill(options.password);
  
  if (options.referralCode) {
    await page.getByRole('textbox', { name: /referral/i }).fill(options.referralCode);
  }
  
  // Submit form
  await page.getByRole('button', { name: /sign up/i }).click();
  
  // Wait for dashboard
  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Dashboard')).toBeVisible();
}

export async function login(page: Page, options: { email: string; password: string }) {
  await page.goto('/auth');
  
  // Switch to login mode if needed
  const switchToLogin = page.locator('text=Already have an account?');
  if (await switchToLogin.isVisible()) {
    await switchToLogin.click();
  }
  
  // Fill login form
  await page.getByRole('textbox', { name: /email/i }).fill(options.email);
  await page.getByRole('textbox', { name: /password/i }).fill(options.password);
  
  // Submit form
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for dashboard
  await page.waitForURL('/dashboard');
  await expect(page.locator('text=Dashboard')).toBeVisible();
}

export async function openAdmin(page: Page) {
  await page.goto('/admin');
  await expect(page.locator('text=Admin Panel')).toBeVisible();
}

export async function setFakeOCR(page: Page, enabled: boolean) {
  if (enabled) {
    await page.evaluate(() => {
      localStorage.setItem('qa.fakeOcr', '1');
    });
  } else {
    await page.evaluate(() => {
      localStorage.removeItem('qa.fakeOcr');
    });
  }
  await page.reload();
}

export async function resetData(page: Page) {
  // Call the QA reset function via the app context
  await page.evaluate(async () => {
    const { supabase } = await import('../../src/integrations/supabase/client');
    const { data, error } = await supabase.rpc('qa_reset_test_data');
    if (error) {
      throw new Error('Failed to reset test data: ' + error.message);
    }
    return data;
  });
}

export async function makeSelfAdmin(page: Page) {
  // Call the QA admin function via the app context
  await page.evaluate(async () => {
    const { supabase } = await import('../../src/integrations/supabase/client');
    const { data, error } = await supabase.rpc('qa_make_self_admin');
    if (error) {
      throw new Error('Failed to make self admin: ' + error.message);
    }
    if (!data.ok) {
      throw new Error('Failed to make self admin: ' + data.error);
    }
    return data;
  });
}