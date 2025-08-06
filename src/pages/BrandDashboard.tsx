import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  ShoppingCart, 
  Store, 
  DollarSign,
  Users,
  Receipt
} from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';

interface BrandStats {
  totalReceipts: number;
  averageBasket: number;
  totalUsers: number;
  topMerchants: Array<{ name: string; count: number; percentage: number }>;
  monthlyTrends: Array<{ month: string; receipts: number; amount: number }>;
}

const BrandDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user has brand role
  if (!user || user.role !== 'brand') {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchBrandStats();
  }, []);

  const fetchBrandStats = async () => {
    try {
      setIsLoading(true);

      // Fetch basic stats - temporary type assertions until Supabase types are updated
      const { data: receiptsData } = await (supabase as any)
        .from('receipts')
        .select('total, merchant, created_at')
        .eq('status', 'approved');

      const { data: usersData } = await (supabase as any)
        .from('users_profile')
        .select('id');

      if (receiptsData && usersData) {
        // Calculate stats
        const totalReceipts = receiptsData.length;
        const totalAmount = receiptsData.reduce((sum, r) => sum + (r.total || 0), 0);
        const averageBasket = totalAmount / totalReceipts || 0;

        // Group by merchant
        const merchantCounts = receiptsData.reduce((acc, receipt) => {
          acc[receipt.merchant] = (acc[receipt.merchant] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topMerchants = Object.entries(merchantCounts)
          .map(([name, count]) => ({
            name,
            count: count as number,
            percentage: ((count as number) / totalReceipts) * 100
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Monthly trends (last 6 months)
        const monthlyData = receiptsData.reduce((acc: Record<string, { receipts: number; amount: number }>, receipt: any) => {
          const month = new Date(receipt.created_at).toLocaleDateString('en-US', { 
            month: 'short',
            year: '2-digit'
          });
          if (!acc[month]) {
            acc[month] = { receipts: 0, amount: 0 };
          }
          acc[month].receipts += 1;
          acc[month].amount += receipt.total || 0;
          return acc;
        }, {});

        const monthlyTrends = Object.entries(monthlyData)
          .map(([month, data]) => ({ 
            month, 
            receipts: (data as { receipts: number; amount: number }).receipts, 
            amount: (data as { receipts: number; amount: number }).amount 
          }))
          .slice(-6);

        setStats({
          totalReceipts,
          averageBasket,
          totalUsers: usersData.length,
          topMerchants,
          monthlyTrends
        });
      }
    } catch (error) {
      console.error('Error fetching brand stats:', error);
      toast({
        title: "Error",
        description: "Failed to load brand statistics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Brand Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Insights into consumer purchasing behavior and market trends
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold">{stats?.totalReceipts.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Basket Size</p>
                <p className="text-2xl font-bold">₺{stats?.averageBasket.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{stats?.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-success/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Growth Rate</p>
                <p className="text-2xl font-bold">+12.5%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
            <CardDescription>Receipt volume and spending over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'receipts' ? value : `₺${value}`,
                    name === 'receipts' ? 'Receipts' : 'Amount'
                  ]}
                />
                <Bar dataKey="receipts" fill="#3B82F6" />
                <Bar dataKey="amount" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Merchants */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Top Merchants</CardTitle>
            <CardDescription>Market share by receipt volume</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.topMerchants}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
                >
                  {stats?.topMerchants.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} receipts`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Details */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Merchant Performance
          </CardTitle>
          <CardDescription>Detailed breakdown of top performing merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.topMerchants.map((merchant, index) => (
              <div key={merchant.name} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <h4 className="font-medium">{merchant.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {merchant.count} receipts
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{merchant.percentage.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Market Share</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandDashboard;