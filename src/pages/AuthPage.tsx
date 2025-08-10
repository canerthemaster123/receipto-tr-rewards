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
  const { login, register, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || (!isLogin && !name)) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      result = await register(email, password, name);
      
      // If registration successful and referral code provided, apply bonus
      if (result.success && result.user && referralCode.trim()) {
        try {
          const { data: bonusResult, error: bonusError } = await supabase
            .rpc('apply_referral_bonus', {
              new_user_id: result.user.id,
              referral_code: referralCode.trim()
            });

          if (bonusError) {
            console.error('Referral bonus error:', bonusError);
            // Show warning but don't fail registration
            toast({
              title: "Account created successfully!",
              description: `Registration completed, but referral bonus failed: ${bonusError.message}`,
              variant: "default",
            });
          } else if (bonusResult?.success) {
            toast({
              title: "Welcome bonus applied!",
              description: `Account created! You and your referrer both received +200 points!`,
            });
          } else {
            toast({
              title: "Account created!",
              description: bonusResult?.error || "Registration completed, but referral code was invalid.",
            });
          }
        } catch (error) {
          console.error('Referral processing error:', error);
          toast({
            title: "Account created!",
            description: "Registration completed successfully.",
          });
        }
      }
    }

    if (result.success) {
      if (isLogin || !referralCode.trim()) {
        // Only show standard success message if no referral was processed
        if (isLogin) {
          toast({
            title: "Welcome back!",
            description: "Successfully logged in.",
          });
        } else if (!referralCode.trim()) {
          toast({
            title: "Account created!",
            description: "Please check your email to verify your account.",
          });
        }
      }
      
      if (isLogin) {
        navigate('/dashboard');
      } else {
        // For registration, stay on the auth page and show success message
        setIsLogin(true); // Switch to login mode
        setEmail(''); // Clear form
        setPassword('');
        setName('');
        setReferralCode('');
      }
    } else {
      toast({
        title: "Error",
        description: result.error || (isLogin ? "Invalid credentials." : "Registration failed."),
        variant: "destructive",
      });
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
                    {isLogin ? 'Signing In...' : 'Creating Account...'}
                  </>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
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
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
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