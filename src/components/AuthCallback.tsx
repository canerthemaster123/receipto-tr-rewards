import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Force fetch session; Supabase parses the hash/query automatically
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Oturum Hatası",
            description: 'Oturum oluşturulamadı.',
            variant: "destructive",
          });
          navigate('/auth', { replace: true });
          return;
        }

        if (session?.user) {
          // Optional: ensure profile row exists (idempotent)
          try {
            const { data: userRes } = await supabase.auth.getUser();
            const user = userRes?.user;
            if (user) {
              await supabase.from('users_profile').upsert({
                id: user.id,
                display_name: user.user_metadata?.full_name
                  ?? user.user_metadata?.name
                  ?? (user.email?.split('@')[0] ?? 'Kullanıcı'),
              }, { onConflict: 'id' });
            }
          } catch (e) {
            console.warn('Profile upsert warning:', e);
          }

          // Handle pending referral code
          const pendingRef = sessionStorage.getItem('pending_ref');
          if (pendingRef) {
            try {
              const { data: bonusResult, error: bonusError } = await supabase
                .rpc('apply_referral_bonus', {
                  new_user_id: session.user.id,
                  code: pendingRef.toLowerCase().replace(/\s+/g, '')
                });

              if (!bonusError && bonusResult?.success) {
                toast({
                  title: "🎉 Referans Bonusu!",
                  description: "+200 puan eklendi! Siz ve arkadaşınız bonus kazandınız!",
                });
              }
              sessionStorage.removeItem('pending_ref');
            } catch (referralError) {
              console.warn('Referral error:', referralError);
              sessionStorage.removeItem('pending_ref');
            }
          }

          toast({
            title: "Başarıyla giriş yapıldı!",
            description: "Google hesabınızla giriş yaptınız.",
          });
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast({
          title: "Bir hata oluştu",
          description: "Kimlik doğrulama işlemi sırasında bir hata oluştu.",
          variant: "destructive",
        });
        navigate('/auth', { replace: true });
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-lg font-medium">Giriş yapılıyor…</div>
        <div className="mt-2 text-sm text-muted-foreground">Lütfen bekleyin.</div>
      </div>
    </div>
  );
};

export default AuthCallback;