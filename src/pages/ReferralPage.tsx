import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Users, UserPlus, Award, Copy } from 'lucide-react';

interface ReferralData {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
  points_awarded: number;
  referred_user: {
    display_name: string;
  };
}

const ReferralPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [myReferrals, setMyReferrals] = useState<ReferralData[]>([]);
  const [stats, setStats] = useState({ totalReferred: 0, totalEarned: 0 });

  React.useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

  const fetchReferralData = async () => {
    if (!user) return;

    try {
      // Fetch referrals where current user is the referrer
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          created_at,
          points_awarded
        `)
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get referred users' names
      if (referrals && referrals.length > 0) {
        const referredIds = referrals.map(r => r.referred_id);
        const { data: users } = await supabase
          .from('users_profile')
          .select('id, display_name')
          .in('id', referredIds);

        const userMap = new Map(users?.map(u => [u.id, u.display_name]) || []);

        const referralsWithNames = referrals.map(ref => ({
          ...ref,
          referred_user: {
            display_name: userMap.get(ref.referred_id) || 'Unknown User'
          }
        }));

        setMyReferrals(referralsWithNames);
        setStats({
          totalReferred: referrals.length,
          totalEarned: referrals.reduce((sum, r) => sum + r.points_awarded, 0)
        });
      }
    } catch (error) {
      console.error('Error fetching referral data:', error);
    }
  };

  const handleReferralSubmit = async () => {
    if (!referralCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a referral code.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc('process_referral', {
        referral_code: referralCode.trim()
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Success!',
          description: 'Referral processed successfully! You and your referrer have both received 200 points.',
        });
        setReferralCode('');
        // Refresh page to show updated points
        window.location.reload();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to process referral.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing referral:', error);
      toast({
        title: 'Error',
        description: 'Failed to process referral. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyReferralCode = () => {
    if (userProfile?.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard.',
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Please sign in to access referrals.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Referral Program</h1>
            <p className="text-muted-foreground">
              Invite friends and earn points together! Both you and your friend get 200 points.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Referred</p>
                    <p className="text-2xl font-bold">{stats.totalReferred}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Award className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Points Earned</p>
                    <p className="text-2xl font-bold">{stats.totalEarned}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Gift className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your Points</p>
                    <p className="text-2xl font-bold">{userProfile?.total_points || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Your Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Your Referral Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Share this code with friends</Label>
                <div className="flex gap-2">
                  <Input 
                    value={userProfile?.referral_code || ''} 
                    readOnly 
                    className="font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    onClick={copyReferralCode}
                    disabled={!userProfile?.referral_code}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">How it works:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Share your referral code with friends</li>
                  <li>• They enter your code when they sign up</li>
                  <li>• Both of you get 200 points instantly!</li>
                  <li>• No limit on how many friends you can refer</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Enter Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle>Enter a Referral Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="referralCode">Have a referral code? Enter it here</Label>
                <div className="flex gap-2">
                  <Input
                    id="referralCode"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="Enter referral code"
                    className="font-mono"
                  />
                  <Button
                    onClick={handleReferralSubmit}
                    disabled={isProcessing || !referralCode.trim()}
                  >
                    {isProcessing ? 'Processing...' : 'Apply Code'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Your Referrals */}
          {myReferrals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your Referrals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {myReferrals.map((referral) => (
                    <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{referral.referred_user.display_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Joined {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        +{referral.points_awarded} points
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;