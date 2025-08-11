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
            errorMessage = "Bu e-posta adresi zaten kayıtlı.";
          }
          throw new Error(errorMessage);
        }

        // Immediately create user profile after successful signup
        if (signUpResult.user) {
          const { error: profileError } = await supabase
            .from('users_profile')
            .upsert({
              id: signUpResult.user.id,
              display_name: name,
              referral_code: signUpResult.user.id.substring(0, 8),
              total_points: 0
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }

          // Handle referral if provided
          if (referralCode.trim()) {
            try {
              const { data: bonusResult, error: bonusError } = await supabase
                .rpc('apply_referral_bonus', {
                  new_user_id: signUpResult.user.id,
                  referral_code: referralCode.trim()
                });

              if (bonusResult?.success) {
                toast({
                  title: "Hesap oluşturuldu!",
                  description: "Kayıt tamamlandı! Siz ve arkadaşınız 200'er puan aldınız!",
                });
              } else {
                toast({
                  title: "Hesap oluşturuldu!",
                  description: "Kayıt tamamlandı, ancak referans kodu geçersizdi.",
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