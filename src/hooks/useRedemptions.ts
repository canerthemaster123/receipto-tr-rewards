import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface Redemption {
  id: string;
  user_id: string;
  reward_id: string;
  status: 'pending' | 'fulfilled' | 'failed';
  code: string | null;
  created_at: string;
  reward_name: string;
  cost: number;
}

interface UseRedemptionsReturn {
  redemptions: Redemption[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useRedemptions = (): UseRedemptionsReturn => {
  const { user } = useAuth();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRedemptions = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: redemptionsData, error } = await supabase
        .from('redemptions')
        .select(`
          *,
          rewards!inner(name, cost)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const transformedData = redemptionsData?.map(r => ({
        ...r,
        reward_name: r.rewards?.name || 'Unknown Reward',
        cost: r.rewards?.cost || 0
      })) || [];

      setRedemptions(transformedData);
    } catch (error) {
      console.error('Error fetching redemptions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchRedemptions();

    const redemptionsChannel = supabase
      .channel('redemptions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'redemptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Redemptions change detected:', payload);
          fetchRedemptions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(redemptionsChannel);
    };
  }, [user, fetchRedemptions]);

  return {
    redemptions,
    loading,
    refetch: fetchRedemptions,
  };
};