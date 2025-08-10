import React from 'react';
import { useAuth } from '../components/AuthContext';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/enhanced-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useReceiptData } from '../hooks/useReceiptData';
import { SpendingCharts } from '../components/SpendingCharts';
import { formatTRY } from '../utils/currency';
import { 
  Upload, 
  Gift, 
  TrendingUp, 
  Receipt, 
  Coins, 
  Calendar,
  ArrowRight,
  Star,
  CheckCircle,
  Clock,
  XCircle,
  Eye
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { t } = useTranslation();
  const { receipts, loading, stats } = useReceiptData();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />{t('status.approved')}</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />{t('status.pending')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />{t('status.rejected')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Updated stats calculation using the hook
  const nextReward = 2000;
  const pointsToNextReward = nextReward - stats.totalEarned;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-hero rounded-2xl p-6 text-white shadow-elegant">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              {t('dashboard.welcomeBack')}, {userProfile?.display_name || user?.email}! 👋
            </h1>
            <p className="text-white/80 mb-4 md:mb-0">
              {t('dashboard.readyToEarn')}
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload">
              <Button variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90">
                <Upload className="h-5 w-5" />
                {t('dashboard.uploadReceipt')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card hover:shadow-elegant transition-all">
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

        <Card className="shadow-card hover:shadow-elegant transition-all">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <Receipt className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalReceipts')}</p>
                <p className="text-2xl font-bold text-secondary">{stats.totalReceipts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-elegant transition-all">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.thisMonth')}</p>
                <p className="text-2xl font-bold text-accent">{stats.thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card hover:shadow-elegant transition-all">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-xl">
                <Star className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.toNextReward')}</p>
                <p className="text-2xl font-bold text-success">{pointsToNextReward}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress to Next Reward */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" />
            {t('dashboard.progressToNextReward')}
          </CardTitle>
          <CardDescription>
            {pointsToNextReward > 0 
              ? t('dashboard.earnMorePoints', { points: pointsToNextReward })
              : t('dashboard.congratsRedeemable')
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{stats.totalEarned} {t('dashboard.points')}</span>
              <span>{nextReward} {t('dashboard.points')}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-reward h-3 rounded-full transition-all duration-500 animate-glow"
                style={{ width: `${Math.min((stats.totalEarned / nextReward) * 100, 100)}%` }}
              />
            </div>
            {pointsToNextReward <= 0 && (
              <div className="text-center pt-2">
                <Link to="/rewards">
                  <Button size="sm" className="bg-gradient-reward text-white">
                    <Gift className="h-4 w-4 mr-2" />
                    {t('dashboard.claimReward')}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Receipts */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('dashboard.recentReceipts')}</CardTitle>
              <Link to="/history">
                <Button variant="ghost" size="sm">
                  {t('common.view')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg w-8 h-8"></div>
                      <div>
                        <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-muted rounded w-12 mb-1"></div>
                      <div className="h-3 bg-muted rounded w-10"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">{t('dashboard.noReceiptsYet')}</p>
                <Link to="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    {t('dashboard.uploadFirstReceipt')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.slice(0, 5).map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                       <div>
                         <div className="flex items-center gap-2">
                           <p className="font-medium">{receipt.merchant}</p>
                           {getStatusBadge(receipt.status)}
                         </div>
                         <div className="text-sm text-muted-foreground space-y-1">
                           <p>{new Date(receipt.purchase_date).toLocaleDateString('tr-TR')}</p>
                           {receipt.payment_method && (
                             <p className="font-mono text-xs">Card: {receipt.payment_method}</p>
                           )}
                         </div>
                       </div>
                    </div>
                     <div className="text-right">
                       <p className="font-medium">{formatTRY(receipt.total)}</p>
                      <p className="text-sm text-secondary">
                        {receipt.status === 'approved' ? `+${receipt.points} pts` : 
                         receipt.status === 'pending' ? t('dashboard.reviewing') : 
                         '0 pts'}
                      </p>
                    </div>
                  </div>
                ))}
                {receipts.length > 5 && (
                  <div className="text-center pt-2">
                    <Link to="/history">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        {t('dashboard.viewMore', { count: receipts.length - 5 })}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
            <CardDescription>
              {t('dashboard.commonTasks')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link to="/upload">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Upload className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">{t('dashboard.uploadNewReceipt')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('dashboard.earnInstantPoints', { count: stats.pendingReceipts })}
                    </div>
                  </div>
                </Button>
              </Link>
              
              <Link to="/rewards">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Gift className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">{t('dashboard.browseRewards')}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('dashboard.redeemPoints', { points: stats.totalEarned })}
                    </div>
                  </div>
                </Button>
              </Link>

              <Link to="/profile">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Calendar className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">{t('dashboard.setReminders')}</div>
                    <div className="text-sm text-muted-foreground">{t('dashboard.neverMissReceipt')}</div>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spending Charts */}
      <SpendingCharts />
    </div>
  );
};

export default Dashboard;