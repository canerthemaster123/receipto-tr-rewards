import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  updated_at: string;
}

interface UseStreaksReturn {
  streak: UserStreak | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useStreaks = (): UseStreaksReturn => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: streakData, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setStreak(streakData || null);
    } catch (error) {
      console.error('Error fetching streak:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    fetchStreak();

    const streakChannel = supabase
      .channel('user-streak-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_streaks',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Streak change detected:', payload);
          fetchStreak();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(streakChannel);
    };
  }, [user, fetchStreak]);

  return {
    streak,
    loading,
    refetch: fetchStreak,
  };
};