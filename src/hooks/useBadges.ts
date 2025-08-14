import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';

interface Badge {
  id: string;
  key: string;
  name_tr: string;
  name_en: string;
  desc_tr: string | null;
  desc_en: string | null;
  icon: string;
  active: boolean;
  sort: number;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_key: string;
  awarded_at: string;
  badge: Badge;
}

interface UseBadgesReturn {
  allBadges: Badge[];
  userBadges: UserBadge[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export const useBadges = (): UseBadgesReturn => {
  const { user } = useAuth();
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .eq('active', true)
        .order('sort');

      if (badgesError) throw badgesError;

      setAllBadges(badgesData || []);

      // Fetch user badges if user is logged in
      if (user) {
        const { data: userBadgesData, error: userBadgesError } = await supabase
          .from('user_badges')
          .select(`
            *,
            badge:badges(*)
          `)
          .eq('user_id', user.id);

        if (userBadgesError) throw userBadgesError;

        setUserBadges(userBadgesData || []);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Set up realtime subscription
  useEffect(() => {
    fetchBadges();

    if (!user) return;

    const badgeChannel = supabase
      .channel('user-badge-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Badge change detected:', payload);
          fetchBadges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(badgeChannel);
    };
  }, [user, fetchBadges]);

  return {
    allBadges,
    userBadges,
    loading,
    refetch: fetchBadges,
  };
};