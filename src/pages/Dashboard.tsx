import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/enhanced-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useTranslation } from 'react-i18next';
import { 
  Upload, 
  Gift, 
  TrendingUp, 
  Receipt, 
  Coins, 
  Calendar,
  ArrowRight,
  Star,
  Users,
  Copy,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard: React.FC = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [receiptsCount, setReceiptsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userPoints = userProfile?.total_points || 0;

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch receipts count
      const { count } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id);

      setReceiptsCount(count || 0);

      // Fetch recent receipts
      const { data: receipts } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentActivity(receipts || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setIsLoading(false);
  };

  const copyReferralCode = () => {
    if (userProfile?.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      toast({
        title: t('dashboard.codeCopied'),
        description: "Share it with friends to earn bonus points!",
      });
    }
  };

  const stats = {
    totalReceipts: receiptsCount,
    thisMonth: receiptsCount, // Could be filtered by month
    totalEarned: userPoints,
    nextReward: 2000,
  };

  const pointsToNextReward = Math.max(0, stats.nextReward - stats.totalEarned);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-hero rounded-2xl p-6 text-white shadow-elegant">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {t('dashboard.title')}, {userProfile?.display_name || user?.email}! 👋
            </h1>
            <p className="text-white/80 mb-4 md:mb-0">
              Ready to turn more receipts into rewards?
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload">
              <Button variant="secondary" size="lg" className="gap-2">
                <Upload className="h-5 w-5" />
                {t('dashboard.uploadReceipt')}
              </Button>
            </Link>
            <Link to="/rewards">
              <Button variant="ghost" size="lg" className="gap-2 text-white border-white hover:bg-white/10">
                <Gift className="h-5 w-5" />
                {t('dashboard.viewRewards')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalPoints')}</p>
                <p className="text-2xl font-bold text-primary">{stats.totalEarned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <Receipt className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.receiptsUploaded')}</p>
                <p className="text-2xl font-bold text-secondary">{stats.totalReceipts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-accent">{stats.thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-xl">
                <Star className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">To Next Reward</p>
                <p className="text-2xl font-bold text-warning">{pointsToNextReward}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('dashboard.recentActivity')}
              </CardTitle>
              <CardDescription>
                Your latest receipt uploads and earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div className="h-4 bg-muted rounded w-24"></div>
                      <div className="h-4 bg-muted rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((receipt) => (
                    <div key={receipt.id} className="flex justify-between items-center p-3 bg-secondary-light/50 rounded-lg">
                      <div>
                        <p className="font-medium">{receipt.merchant}</p>
                        <p className="text-sm text-muted-foreground">
                          ₺{receipt.total} • {new Date(receipt.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-secondary font-semibold">+{receipt.points} pts</span>
                        <p className="text-xs text-muted-foreground capitalize">{receipt.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No receipts uploaded yet</p>
                  <Link to="/upload">
                    <Button variant="outline" className="mt-3">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Receipt
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Referral Card */}
        <div>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('dashboard.inviteFriends')}
              </CardTitle>
              <CardDescription>
                Earn 200 points for each friend who joins!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">{t('dashboard.yourReferralCode')}</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 bg-muted rounded-lg font-mono text-center">
                    {userProfile?.referral_code || 'Loading...'}
                  </div>
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={copyReferralCode}
                    disabled={!userProfile?.referral_code}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-secondary-light p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-secondary" />
                  <span className="text-sm font-medium">How it works</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share your code with friends. When they sign up, you both get 200 bonus points!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;