// QA Helper functions for E2E testing
import { supabase } from '@/integrations/supabase/client';

export const setFakeOCR = (enabled: boolean) => {
  if (enabled) {
    localStorage.setItem('qa.fakeOcr', '1');
  } else {
    localStorage.removeItem('qa.fakeOcr');
  }
  // Reload to apply the setting
  window.location.reload();
};

export const resetTestData = async () => {
  try {
    const { data, error } = await supabase.rpc('qa_reset_test_data');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error resetting test data:', error);
    throw error;
  }
};

export const makeSelfAdmin = async () => {
  try {
    const { data, error } = await supabase.rpc('qa_make_self_admin');
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error making self admin:', error);
    throw error;
  }
};

// Add these functions to window object for test access
if (typeof window !== 'undefined') {
  (window as any).qaHelpers = {
    setFakeOCR,
    resetTestData,
    makeSelfAdmin
  };
}