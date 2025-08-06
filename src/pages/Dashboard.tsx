import React from 'react';
import { useAuth } from '../components/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/enhanced-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Upload, 
  Gift, 
  TrendingUp, 
  Receipt, 
  Coins, 
  Calendar,
  ArrowRight,
  Star
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, userProfile } = useAuth();

  // Mock data for dashboard
  const stats = {
    totalReceipts: 23,
    thisMonth: 8,
    totalEarned: userProfile?.total_points || 0,
    nextReward: 2000,
  };

  const recentReceipts = [
    { id: 1, store: 'Migros', amount: 124.50, points: 100, date: '2024-01-15' },
    { id: 2, store: 'CarrefourSA', amount: 89.75, points: 100, date: '2024-01-14' },
    { id: 3, store: 'BIM', amount: 45.20, points: 100, date: '2024-01-13' },
  ];

  const pointsToNextReward = stats.nextReward - stats.totalEarned;

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-hero rounded-2xl p-6 text-white shadow-elegant">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {userProfile?.display_name || user?.email}! 👋
            </h1>
            <p className="text-white/80 mb-4 md:mb-0">
              Ready to turn more receipts into rewards?
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload">
              <Button variant="secondary" size="lg" className="bg-white text-primary hover:bg-white/90">
                <Upload className="h-5 w-5" />
                Upload Receipt
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
                <p className="text-sm text-muted-foreground">Total Points</p>
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
                <p className="text-sm text-muted-foreground">Total Receipts</p>
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
                <p className="text-sm text-muted-foreground">This Month</p>
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
                <p className="text-sm text-muted-foreground">To Next Reward</p>
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
            Progress to Next Reward
          </CardTitle>
          <CardDescription>
            Earn {pointsToNextReward} more points to unlock a ₺20 gift card
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{stats.totalEarned} points</span>
              <span>{stats.nextReward} points</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-gradient-reward h-3 rounded-full transition-all duration-500 animate-glow"
                style={{ width: `${(stats.totalEarned / stats.nextReward) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Receipts */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Receipts</CardTitle>
              <Link to="/history">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentReceipts.map((receipt) => (
                <div key={receipt.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{receipt.store}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(receipt.date).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₺{receipt.amount}</p>
                    <p className="text-sm text-secondary">+{receipt.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks to maximize your rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Link to="/upload">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Upload className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Upload New Receipt</div>
                    <div className="text-sm text-muted-foreground">Earn 100 points instantly</div>
                  </div>
                </Button>
              </Link>
              
              <Link to="/rewards">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Gift className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Browse Rewards</div>
                    <div className="text-sm text-muted-foreground">Redeem your points</div>
                  </div>
                </Button>
              </Link>

              <Link to="/profile">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <Calendar className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Set Reminders</div>
                    <div className="text-sm text-muted-foreground">Never miss a receipt</div>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;