import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  id: string;
  period_key: string;
  rank: number;
  user_id: string;
  points: number;
  public_name: string;
  created_at: string;
}

interface UseLeaderboardReturn {
  entries: LeaderboardEntry[];
  loading: boolean;
  refetch: (periodKey: string) => Promise<void>;
  availablePeriods: string[];
}

export const useLeaderboard = (): UseLeaderboardReturn => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);

  const fetchLeaderboard = useCallback(async (periodKey: string) => {
    try {
      setLoading(true);
      
      const { data: leaderboardData, error } = await supabase
        .from('leaderboard_snapshots')
        .select('*')
        .eq('period_key', periodKey)
        .order('rank');

      if (error) throw error;

      setEntries(leaderboardData || []);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailablePeriods = useCallback(async () => {
    try {
      const { data: periodsData, error } = await supabase
        .from('leaderboard_snapshots')
        .select('period_key')
        .order('period_key', { ascending: false });

      if (error) throw error;

      const uniquePeriods = [...new Set(periodsData?.map(p => p.period_key) || [])];
      setAvailablePeriods(uniquePeriods);
    } catch (error) {
      console.error('Error fetching available periods:', error);
    }
  }, []);

  useEffect(() => {
    fetchAvailablePeriods();
  }, [fetchAvailablePeriods]);

  return {
    entries,
    loading,
    refetch: fetchLeaderboard,
    availablePeriods,
  };
};