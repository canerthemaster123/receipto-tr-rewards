import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { handleError } from '@/utils/errorHandling';
import { measureAsync } from '@/utils/performance';

interface Reward {
  id: string;
  name: string;
  cost: number;
  stock: number;
  active: boolean;
  description?: string;
  category?: string;
}

interface UseRewardsReturn {
  rewards: Reward[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useRewards = (): UseRewardsReturn => {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRewards = useCallback(async () => {
    try {
      setLoading(true);
      
      await measureAsync(async () => {
        const { data: rewardsData, error } = await supabase
          .from('rewards')
          .select('*')
          .eq('active', true)
          .order('cost', { ascending: true });

        if (error) {
          throw error;
        }

        setRewards(rewardsData || []);
      }, 'Fetch Rewards');
    } catch (error) {
      handleError(error, 'Fetch Rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRewards();

    const rewardsChannel = supabase
      .channel('rewards-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rewards'
        },
        (payload) => {
          console.log('Rewards change detected:', payload);
          fetchRewards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rewardsChannel);
    };
  }, [fetchRewards]);

  return {
    rewards,
    loading,
    refetch: fetchRewards,
  };
};