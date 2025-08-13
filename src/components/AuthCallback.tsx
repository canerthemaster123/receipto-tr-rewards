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
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Kimlik doğrulama hatası",
            description: error.message,
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        if (session?.user) {
          // Check if user profile exists, if not create it
          const { data: profile, error: profileError } = await supabase
            .from('users_profile')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (profileError && profileError.code === 'PGRST116') {
            // Profile doesn't exist, the trigger should have created it but let's ensure it exists
            const displayName = session.user.user_metadata?.display_name || 
                              session.user.user_metadata?.full_name || 
                              session.user.email?.split('@')[0] || 
                              'User';

            const { error: createError } = await supabase
              .from('users_profile')
              .upsert({
                id: session.user.id,
                display_name: displayName,
                referral_code: session.user.id.substring(0, 8),
                total_points: 0
              });

            if (createError) {
              console.error('Profile creation error:', createError);
            }
          }

          toast({
            title: "Başarıyla giriş yapıldı!",
            description: "Google hesabınızla giriş yaptınız.",
          });
          navigate('/dashboard');
        } else {
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        toast({
          title: "Bir hata oluştu",
          description: "Kimlik doğrulama işlemi sırasında bir hata oluştu.",
          variant: "destructive",
        });
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Giriş yapılıyor...</p>
      </div>
    </div>
  );
};

export default AuthCallback;