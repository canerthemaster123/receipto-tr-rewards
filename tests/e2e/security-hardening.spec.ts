import { test, expect } from '@playwright/test';
import { createTestUser, cleanupTestData } from './utils';

test.describe('Security Hardening Tests', () => {
  let testUser: any;
  
  test.beforeEach(async () => {
    testUser = await createTestUser();
  });

  test.afterEach(async () => {
    await cleanupTestData(testUser.email);
  });

  test('should block unauthenticated writes to receipts table', async ({ page }) => {
    // Try to insert receipt without authentication
    const response = await page.evaluate(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODYzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        const { error } = await supabase
          .from('receipts')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            merchant: 'Test Store',
            total: 100.00,
            status: 'pending'
          });
          
        return { success: !error, error: error?.message };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('Row Level Security');
  });

  test('should block cross-user receipt access', async ({ page }) => {
    // First create a receipt as user A
    await page.goto('/auth');
    await page.getByTestId('email-input').fill(testUser.email);
    await page.getByTestId('password-input').fill(testUser.password);
    await page.getByTestId('login-button').click();
    
    await page.waitForURL('/dashboard');
    
    // Create a receipt
    await page.goto('/upload');
    const receiptResponse = await page.evaluate(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODYzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;
        
        if (!userId) throw new Error('Not authenticated');
        
        const { data, error } = await supabase
          .from('receipts')
          .insert({
            user_id: userId,
            merchant: 'Test Store',
            total: 50.00,
            status: 'pending'
          })
          .select()
          .single();
          
        return { receiptId: data?.id, error: error?.message };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    expect(receiptResponse.receiptId).toBeTruthy();
    
    // Now try to access this receipt as a different user
    const otherUser = await createTestUser();
    await page.goto('/auth');
    await page.getByTestId('email-input').fill(otherUser.email);
    await page.getByTestId('password-input').fill(otherUser.password);
    await page.getByTestId('login-button').click();
    
    const accessResponse = await page.evaluate(async (receiptId) => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODYzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        const { data, error } = await supabase
          .from('receipts')
          .select('*')
          .eq('id', receiptId);
          
        return { dataLength: data?.length || 0, error: error?.message };
      } catch (e) {
        return { error: e.message };
      }
    }, receiptResponse.receiptId);
    
    // Should not be able to see other user's receipt
    expect(accessResponse.dataLength).toBe(0);
    
    await cleanupTestData(otherUser.email);
  });

  test('should enforce rate limiting on uploads', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('email-input').fill(testUser.email);
    await page.getByTestId('password-input').fill(testUser.password);
    await page.getByTestId('login-button').click();
    
    await page.waitForURL('/dashboard');
    
    // Try to trigger rate limiting by calling secure_upload_check rapidly
    const rateLimitResponse = await page.evaluate(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzODYzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        const results = [];
        
        // Make 6 rapid calls (should hit rate limit at 5)
        for (let i = 0; i < 6; i++) {
          const { data, error } = await supabase.rpc('secure_upload_check', {
            p_file_size: 1000000 // 1MB
          });
          results.push({ data, error: error?.message });
        }
        
        return results;
      } catch (e) {
        return [{ error: e.message }];
      }
    });
    
    // At least one call should be rate limited
    const rateLimited = rateLimitResponse.some(result => 
      result.data?.success === false && result.data?.error === 'upload_rate_limited'
    );
    
    expect(rateLimited).toBe(true);
  });

  test('should block direct points ledger manipulation', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('email-input').fill(testUser.email);
    await page.getByTestId('password-input').fill(testUser.password);
    await page.getByTestId('login-button').click();
    
    await page.waitForURL('/dashboard');
    
    const ledgerResponse = await page.evaluate(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOGIzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;
        
        if (!userId) throw new Error('Not authenticated');
        
        // Try to insert points directly
        const { error } = await supabase
          .from('points_ledger')
          .insert({
            user_id: userId,
            source: 'hacked',
            delta: 10000,
            meta: { hacked: true }
          });
          
        return { success: !error, error: error?.message };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(ledgerResponse.success).toBe(false);
    expect(ledgerResponse.error).toMatch(/permission denied|not allowed|insufficient privilege/i);
  });

  test('should enforce file size limits in storage', async ({ page }) => {
    await page.goto('/auth');
    await page.getByTestId('email-input').fill(testUser.email);
    await page.getByTestId('password-input').fill(testUser.password);
    await page.getByTestId('login-button').click();
    
    await page.waitForURL('/dashboard');
    
    // Test file size validation
    const fileSizeResponse = await page.evaluate(async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          'https://mxrjsclpdwmrrvmzmqmo.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14cmpzY2xwZHdtcnJ2bXptcW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOGIzMTIsImV4cCI6MjA2OTk2MjMxMn0.GPD_SYgcmCTHokdzUMV-mGqMvDd5LK-KQH9pjhd8UoY'
        );
        
        // Test with file size larger than 5MB
        const { data, error } = await supabase.rpc('secure_upload_check', {
          p_file_size: 6000000 // 6MB - should be rejected
        });
        
        return { data, error: error?.message };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    expect(fileSizeResponse.data?.success).toBe(false);
    expect(fileSizeResponse.data?.error).toBe('file_too_large');
  });

  test('should have CSP headers present', async ({ page }) => {
    // Check main page for CSP headers
    const response = await page.goto('/');
    const headers = response?.headers();
    
    // Note: CSP is set via meta tag in our case, so check for that
    const cspMeta = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    
    expect(cspMeta).toContain("default-src 'self'");
    expect(cspMeta).toContain("frame-ancestors 'none'");
    expect(cspMeta).toContain("connect-src 'self' https://*.supabase.co");
  });

  test('should prevent iframe embedding', async ({ page }) => {
    const response = await page.goto('/');
    
    // Check for X-Frame-Options header via meta tag
    const frameOptions = await page.locator('meta[http-equiv="X-Frame-Options"]').getAttribute('content');
    expect(frameOptions).toBe('DENY');
  });
});