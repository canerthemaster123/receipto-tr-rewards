import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Bell, Award } from 'lucide-react';

export const RealtimeNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('receipt-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload;
          
          // Only show notification if status actually changed
          if (newRecord.status !== oldRecord.status) {
            if (newRecord.status === 'approved') {
              toast.success('Fiş Onaylandı! ✅', {
                description: `${newRecord.merchant} mağazasından fişiniz onaylandı. ${newRecord.points} puan kazandınız!`,
                icon: <CheckCircle className="h-4 w-4" />,
                duration: 6000,
              });
            } else if (newRecord.status === 'rejected') {
              toast.error('Fiş Reddedildi ❌', {
                description: `${newRecord.merchant} mağazasından fişiniz reddedildi. Hata olduğunu düşünüyorsanız destek ekibiyle iletişime geçin.`,
                icon: <XCircle className="h-4 w-4" />,
                duration: 6000,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users_profile',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          const { new: newRecord, old: oldRecord } = payload;
          
          // Notify about points changes
          if (newRecord.total_points !== oldRecord.total_points) {
            const pointsDiff = newRecord.total_points - oldRecord.total_points;
            if (pointsDiff > 0) {
              toast.success('Points Earned!', {
                description: `You earned ${pointsDiff} points! Total: ${newRecord.total_points}`,
                icon: <Bell className="h-4 w-4" />,
                duration: 3000,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const { new: newBadge } = payload;
          
          // Fetch badge details
          const { data: badgeData } = await supabase
            .from('badges')
            .select('name_tr, name_en, desc_tr, desc_en')
            .eq('key', newBadge.badge_key)
            .single();
          
          if (badgeData) {
            toast.success('Yeni Başarım Kazandınız! 🏆', {
              description: `${badgeData.name_tr}${badgeData.desc_tr ? ` - ${badgeData.desc_tr}` : ''}`,
              icon: <Award className="h-4 w-4" />,
              duration: 6000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'challenge_progress',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const { new: newProgress, old: oldProgress } = payload;
          
          // Only notify when challenge is newly completed
          if (newProgress.completed && !oldProgress.completed) {
            // Fetch challenge details
            const { data: challengeData } = await supabase
              .from('challenges')
              .select('title_tr, title_en, reward_points')
              .eq('id', newProgress.challenge_id)
              .single();
            
            if (challengeData) {
              toast.success('🎯 Görev Tamamlandı!', {
                description: `"${challengeData.title_tr}" görevini başarıyla tamamladınız! Meydan Okumalar bölümünden ${challengeData.reward_points} puanınızı alabilirsiniz.`,
                icon: <Award className="h-4 w-4" />,
                duration: 8000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null; // This component doesn't render anything
};