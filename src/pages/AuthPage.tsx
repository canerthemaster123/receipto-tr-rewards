import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Receipt, Mail, Lock, User, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { supabase } from '../integrations/supabase/client';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (!isLogin && !name)) {
      toast({
        title: "Hata",
        description: "Lütfen tüm gerekli alanları doldurun.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.success) {
          toast({
            title: "Hoş geldiniz!",
            description: "Başarıyla giriş yaptınız.",
          });
          navigate('/dashboard');
        } else {
          toast({
            title: "Hata",
            description: result.error || "Geçersiz kimlik bilgileri.",
            variant: "destructive",
          });
        }
      } else {
        // Sign up flow with improved error handling
        const redirectUrl = `${window.location.origin}/`;
        
        const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: name,
            }
          }
        });

        if (signUpError) {
          let errorMessage = signUpError.message;
          if (signUpError.message.includes('already registered')) {
            errorMessage = "Kullanıcı zaten kayıtlı.";
          }
          throw new Error(errorMessage);
        }

        // User profile will be created automatically by the handle_new_user trigger
        // So we don't need to manually create it here anymore
        if (signUpResult.user) {
          // Handle referral if provided - normalize input
          if (referralCode.trim()) {
            try {
              // Normalize referral code client-side (consistent with backend)
              const normalizedCode = referralCode.trim().toLowerCase().replace(/\s+/g, '');
              
              const { data: bonusResult, error: bonusError } = await supabase
                .rpc('apply_referral_bonus', {
                  new_user_id: signUpResult.user.id,
                  code: normalizedCode
                });

              if (bonusError) {
                console.error('Referral RPC error:', bonusError);
                toast({
                  title: "Hesap oluşturuldu!",
                  description: "Kayıt tamamlandı, ancak referans kodu işlenirken bir hata oluştu.",
                  variant: "default",
                });
              } else if (bonusResult?.success) {
                toast({
                  title: "🎉 Referans Bonusu!",
                  description: "+200 puan eklendi! Siz ve arkadaşınız bonus kazandınız!",
                });
              } else {
                // Non-blocking warning for invalid code
                const errorMsg = bonusResult?.error === 'self_ref' 
                  ? "Kendi referans kodunuzu kullanamazsınız"
                  : bonusResult?.error === 'already_used'
                  ? "Bu hesap zaten bir referans kodu kullanmış"
                  : "Geçersiz referans kodu";
                
                toast({
                  title: "Hesap oluşturuldu!",
                  description: `Kayıt tamamlandı, ancak ${errorMsg.toLowerCase()}.`,
                  variant: "default",
                });
              }
            } catch (referralError) {
              console.error('Referral error:', referralError);
              toast({
                title: "Hesap oluşturuldu!",
                description: "Kayıt başarıyla tamamlandı.",
              });
            }
          } else {
            toast({
              title: "Hesap oluşturuldu!",
              description: "Kayıt başarıyla tamamlandı.",
            });
          }
          
          // Navigate to dashboard immediately
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // If preview runs inside an iframe, force top-level navigation first
      if (window.self !== window.top) {
        if (window.top) {
          (window.top as Window).location.href = window.location.origin;
        }
        return;
      }

      setIsLoading(true);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        // Show a friendly TR toast
        toast({
          title: "Giriş Hatası",
          description: "Google ile giriş sırasında bir hata oluştu.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      toast({
        title: "Giriş Hatası",
        description: "Google ile giriş sırasında bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 mb-4 mx-auto hover:scale-105 transition-transform"
          >
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
              <Receipt className="h-8 w-8 text-white" />
            </div>
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="block hover:scale-105 transition-transform mx-auto"
          >
            <h1 className="text-3xl font-bold text-white mb-2">Receipto</h1>
          </button>
          <p className="text-white/80">Turn your receipts into rewards</p>
        </div>

        {/* Auth Form */}
        <Card className="bg-white/95 backdrop-blur-sm border-white/20 shadow-elegant">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin 
                ? 'Sign in to start earning rewards' 
                : 'Join thousands earning cashback on receipts'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required={!isLogin}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="referralCode"
                      type="text"
                      placeholder="Enter referral code for +200 bonus points"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Have a referral code? Both you and your referrer get +200 points!
                  </p>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                variant="hero"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isLogin ? 'Giriş yapılıyor...' : 'Hesap oluşturuluyor...'}
                  </>
                ) : (
                  isLogin ? 'Giriş Yap' : 'Hesap Oluştur'
                )}
              </Button>
            </form>

            {/* Google Sign-In Button */}
            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Veya
                  </span>
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full mt-4"
                data-testid="google-auth-button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google ile devam et
              </Button>
              
              {/* Google Setup Help Link */}
              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => window.open('/google-auth-setup', '_blank')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Google giriş sorunu mu yaşıyorsunuz? Kurulum rehberi
                </button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin 
                  ? "Hesabınız yok mu? Kayıt olun" 
                  : "Zaten hesabınız var mı? Giriş yapın"
                }
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;