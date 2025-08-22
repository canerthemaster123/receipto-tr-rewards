import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface ReceiptData {
  id: string;
  merchant: string;
  merchant_brand?: string;
  total: number;
  purchase_date: string;
  purchase_time?: string;
  store_address?: string;
  payment_method: string | null;
  status: 'approved' | 'pending' | 'rejected';
  points: number;
  items: string;
  image_url?: string;
  receipt_unique_no?: string;
  fis_no?: string;
  barcode_numbers?: string[];
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
        .select('id, merchant, merchant_brand, total, purchase_date, purchase_time, store_address, payment_method, status, points, items, image_url, receipt_unique_no, fis_no, barcode_numbers, created_at, updated_at')
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

    // Set up realtime subscription for receipts with better error handling
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
          console.log('Receipt change detected:', payload.eventType, (payload.new as any)?.status);
          // Immediate refetch to ensure charts update
          fetchReceipts();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Receipt realtime subscription active');
        } else if (status === 'CLOSED') {
          console.log('Receipt realtime subscription closed');
        }
      });

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
          console.log('Profile change detected:', (payload.new as any)?.total_points);
          // Profile changes might affect calculations, so refetch receipts too
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Profile realtime subscription active');
        }
      });

    return () => {
      supabase.removeChannel(receiptChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, fetchReceipts]);

  // Calculate stats - now using points ledger for accurate totals
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
    totalEarned: userProfile?.total_points || 0, // Will be updated by points ledger hook
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