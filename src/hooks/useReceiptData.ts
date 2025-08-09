import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface ReceiptData {
  id: string;
  merchant: string;
  total: number;
  purchase_date: string;
  purchase_time?: string;
  store_address?: string;
  payment_method: string | null;
  status: 'approved' | 'pending' | 'rejected';
  points: number;
  items: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

interface UseReceiptDataReturn {
  receipts: ReceiptData[];
  loading: boolean;
  stats: {
    totalReceipts: number;
    approvedReceipts: number;
    pendingReceipts: number;
    rejectedReceipts: number;
    thisMonth: number;
    totalEarned: number;
    totalSpent: number;
  };
  refetch: () => Promise<void>;
}

export const useReceiptData = (): UseReceiptDataReturn => {
  const { user, userProfile } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReceipts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: receiptsData, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setReceipts(receiptsData || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    fetchReceipts();

    // Set up realtime subscription for receipts
    const receiptChannel = supabase
      .channel('receipt-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'receipts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Receipt change detected:', payload);
          fetchReceipts(); // Refetch on any change
        }
      )
      .subscribe();

    // Set up realtime subscription for user profile changes (points updates)
    const profileChannel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users_profile',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile change detected:', payload);
          // This will trigger a re-render with updated points
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(receiptChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, fetchReceipts]);

  // Calculate stats
  const stats = {
    totalReceipts: receipts.length,
    approvedReceipts: receipts.filter(r => r.status === 'approved').length,
    pendingReceipts: receipts.filter(r => r.status === 'pending').length,
    rejectedReceipts: receipts.filter(r => r.status === 'rejected').length,
    thisMonth: receipts.filter(receipt => {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return new Date(receipt.created_at) >= thisMonth;
    }).length,
    totalEarned: userProfile?.total_points || 0,
    totalSpent: receipts
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.total.toString()), 0),
  };

  return {
    receipts,
    loading,
    stats,
    refetch: fetchReceipts,
  };
};