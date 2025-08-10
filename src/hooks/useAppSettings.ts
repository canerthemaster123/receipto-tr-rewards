import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSetting {
  key: string;
  value: any;
}

interface UseAppSettingsReturn {
  settings: Record<string, any>;
  loading: boolean;
  updateSetting: (key: string, value: any) => Promise<void>;
  getSetting: (key: string, defaultValue?: any) => any;
}

export const useAppSettings = (): UseAppSettingsReturn => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: settingsData, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) {
        throw error;
      }

      const settingsMap: Record<string, any> = {};
      settingsData?.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching app settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    fetchSettings();

    const settingsChannel = supabase
      .channel('app-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings'
        },
        (payload) => {
          console.log('Settings change detected:', payload);
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
    };
  }, [fetchSettings]);

  const updateSetting = async (key: string, value: any) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' });

    if (error) {
      throw error;
    }
  };

  const getSetting = (key: string, defaultValue: any = null) => {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  };

  return {
    settings,
    loading,
    updateSetting,
    getSetting,
  };
};