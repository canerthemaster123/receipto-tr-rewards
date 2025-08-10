import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface PointsLedgerEntry {
  id: string;
  user_id: string;
  source: 'receipt' | 'redemption' | 'referral' | 'migration';
  delta: number;
  meta: any;
  created_at: string;
}

interface UsePointsLedgerReturn {
  entries: PointsLedgerEntry[];
  loading: boolean;
  totalPoints: number;
  refetch: () => Promise<void>;
}

export const usePointsLedger = (): UsePointsLedgerReturn => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PointsLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: entriesData, error } = await supabase
        .from('points_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setEntries(entriesData || []);
    } catch (error) {
      console.error('Error fetching points ledger:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    fetchEntries();

    const ledgerChannel = supabase
      .channel('points-ledger-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'points_ledger',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Points ledger change detected:', payload);
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ledgerChannel);
    };
  }, [user, fetchEntries]);

  // Calculate total points from ledger
  const totalPoints = entries.reduce((sum, entry) => sum + entry.delta, 0);

  return {
    entries,
    loading,
    totalPoints,
    refetch: fetchEntries,
  };
};