import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface Challenge {
  id: string;
  title_tr: string;
  title_en: string;
  goal_key: string;
  goal_target: number;
  starts_at: string;
  ends_at: string;
  reward_points: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

interface ChallengeProgress {
  id: string;
  challenge_id: string;
  user_id: string;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  challenge: Challenge;
}

interface UseChallengesReturn {
  activeChallenges: Challenge[];
  userProgress: ChallengeProgress[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useChallenges = (): UseChallengesReturn => {
  const { user } = useAuth();
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [userProgress, setUserProgress] = useState<ChallengeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      
      const now = new Date().toISOString();
      
      // Fetch active challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .eq('active', true)
        .lte('starts_at', now)
        .gte('ends_at', now)
        .order('created_at', { ascending: false });

      if (challengesError) throw challengesError;

      setActiveChallenges(challengesData || []);

      // Fetch user progress if user is logged in
      if (user) {
        const { data: progressData, error: progressError } = await supabase
          .from('challenge_progress')
          .select(`
            *,
            challenge:challenges(*)
          `)
          .eq('user_id', user.id);

        if (progressError) throw progressError;

        setUserProgress(progressData || []);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    fetchChallenges();

    if (!user) return;

    const progressChannel = supabase
      .channel('challenge-progress-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_progress',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Challenge progress change detected:', payload);
          fetchChallenges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(progressChannel);
    };
  }, [user, fetchChallenges]);

  return {
    activeChallenges,
    userProgress,
    loading,
    refetch: fetchChallenges,
  };
};