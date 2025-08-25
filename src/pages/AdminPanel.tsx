import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { formatTRY } from '../utils/currency';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AdminRoute from '../components/AdminRoute';
import UserRoleManager from '../components/UserRoleManager';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Receipt, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  BarChart,
  DollarSign,
  Calendar,
  Loader2,
  Settings,
  LogOut
} from 'lucide-react';
import GamificationAdmin from '../components/GamificationAdmin';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { config, setQAConfig } from '../config';

interface ReceiptSubmission {
  id: string;
  userId: string;
  userName: string;
  storeName: string;
  amount: number;
  date: string;
  paymentMethod: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitDate: string;
}

interface UserStats {
  id: string;
  name: string;
  email: string;
  totalReceipts: number;
  totalPoints: number;
  joinDate: string;
  status: 'active' | 'suspended';
  current_role: 'admin' | 'moderator' | 'user';
}

const AdminPanel: React.FC = () => {
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [pendingReceipts, setPendingReceipts] = useState<ReceiptSubmission[]>([]);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // ⚠️ QA ONLY – disable before production release
  const [allowDuplicates, setAllowDuplicates] = useState(config.ALLOW_DUPLICATE_RECEIPTS);
  // Analytics state (dynamic instead of hard-coded)
  const [monthlyReceipts, setMonthlyReceipts] = useState<{ label: string; count: number; ratio: number }[]>([]);
  const [topRetailers, setTopRetailers] = useState<{ name: string; count: number; percentage: number }[]>([]);
  const { toast } = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Handle QA toggle for duplicate receipts
  const handleDuplicateToggle = (checked: boolean) => {
    setAllowDuplicates(checked);
    setQAConfig({ ALLOW_DUPLICATE_RECEIPTS: checked });
    toast({
      title: "QA Setting Updated",
      description: `Duplicate receipts are now ${checked ? 'allowed' : 'blocked'}`,
      variant: checked ? "default" : "destructive",
    });
  };

  // Fetch real data from database
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch pending receipts with user info
      const { data: receiptsData, error: receiptsError } = await supabase
        .from('receipts')
        .select(`
          id,
          user_id,
          merchant,
          total,
          purchase_date,
          payment_method,
          status,
          created_at,
          points
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (receiptsError) throw receiptsError;

      // Get user info for each receipt
      const userIds = [...new Set(receiptsData?.map(r => r.user_id) || [])];
      const { data: usersInfo } = await supabase
        .from('users_profile')
        .select('id, display_name')
        .in('id', userIds);

      const userMap = new Map(usersInfo?.map(u => [u.id, u.display_name]) || []);

      // Transform data
      const transformedReceipts: ReceiptSubmission[] = (receiptsData || []).map(receipt => ({
        id: receipt.id,
        userId: receipt.user_id,
        userName: userMap.get(receipt.user_id) || 'Unknown User',
        storeName: receipt.merchant || 'Unknown Store',
        amount: receipt.total || 0,
        date: receipt.purchase_date || receipt.created_at.split('T')[0],
        paymentMethod: receipt.payment_method,
        status: receipt.status as 'pending',
        submitDate: receipt.created_at
      }));

      setPendingReceipts(transformedReceipts);

      // Fetch user stats  
      const { data: usersData, error: usersError } = await supabase
        .from('users_profile')
        .select('id, display_name, total_points, created_at')
        .order('total_points', { ascending: false })
        .limit(50);

      if (usersError) throw usersError;

      // Get receipt counts for each user
      const { data: receiptCounts } = await supabase
        .from('receipts')
        .select('user_id')
        .in('user_id', usersData?.map(u => u.id) || []);

      const receiptCountMap = new Map();
      receiptCounts?.forEach(receipt => {
        const count = receiptCountMap.get(receipt.user_id) || 0;
        receiptCountMap.set(receipt.user_id, count + 1);
      });


      // Get user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', usersData?.map(u => u.id) || []);

      const roleMap = new Map(userRoles?.map(ur => [ur.user_id, ur.role]) || []);

      const transformedUsers: UserStats[] = (usersData || []).map(user => ({
        id: user.id,
        name: user.display_name || 'Unknown User',
        email: '', // Email not available in profiles table for privacy
        totalReceipts: receiptCountMap.get(user.id) || 0,
        totalPoints: user.total_points || 0,
        joinDate: user.created_at.split('T')[0],
        status: 'active' as const,
        current_role: roleMap.get(user.id) || 'user'
      }));

      setUsers(transformedUsers);

      // ----- Analytics (dynamic) -----
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setMonth(start.getMonth() - 2, 1); // first day of month, 3-month window
      const startISO = start.toISOString().split('T')[0];

      const { data: recentReceipts, error: recentErr } = await supabase
        .from('receipts')
        .select('purchase_date, merchant, merchant_brand, status')
        .gte('purchase_date', startISO)
        .eq('status', 'approved');

      if (!recentErr && recentReceipts) {
        // Prepare month keys for 3 months range
        const monthKeys: { key: string; label: string }[] = [];
        const tmp = new Date(start);
        for (let i = 0; i < 3; i++) {
          const key = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}`;
          const label = tmp.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
          monthKeys.push({ key, label });
          tmp.setMonth(tmp.getMonth() + 1, 1);
        }

        const counts = new Map<string, number>();
        recentReceipts.forEach((r: any) => {
          const d = new Date(r.purchase_date);
          const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          counts.set(mk, (counts.get(mk) || 0) + 1);
        });

        const maxVal = Math.max(1, ...monthKeys.map((m) => counts.get(m.key) || 0));
        const monthly = monthKeys
          .slice() // copy
          .reverse() // show newest first
          .map((m) => ({
            label: m.label.charAt(0).toUpperCase() + m.label.slice(1),
            count: counts.get(m.key) || 0,
            ratio: Math.round(((counts.get(m.key) || 0) / maxVal) * 100),
          }));
        setMonthlyReceipts(monthly);

        // Top retailers
        const brandCounts = new Map<string, number>();
        recentReceipts.forEach((r: any) => {
          const name = r.merchant_brand || r.merchant || 'Unknown';
          brandCounts.set(name, (brandCounts.get(name) || 0) + 1);
        });
        const total = Array.from(brandCounts.values()).reduce((a, b) => a + b, 0) || 1;
        const top = Array.from(brandCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }));
        setTopRetailers(top);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Replace mock data with actual stats calculation
  const stats = {
    totalUsers: users.length,
    pendingReceipts: pendingReceipts.length,
    totalPointsIssued: users.reduce((sum, user) => sum + user.totalPoints, 0),
    thisMonthRevenue: 0 // Would need additional calculation
  };

  const handleReceiptAction = async (receiptId: string, action: 'approve' | 'reject') => {
    try {
      const receipt = pendingReceipts.find(r => r.id === receiptId);
      if (!receipt) {
        toast({
          title: "Hata",
          description: "Fiş bulunamadı",
          variant: "destructive",
        });
        return;
      }

      if (action === 'approve') {
        // Use the new approve function that handles points in transaction
        const { data: approveResult, error: approveError } = await supabase
          .rpc('approve_receipt_with_points', {
            receipt_id: receiptId,
            points_awarded: 100
          });

        if (approveError) {
          console.error('Approve error:', approveError);
          throw new Error(approveError.message || 'Onaylama başarısız');
        }

        if (!approveResult?.success) {
          throw new Error(approveResult?.error || 'Onaylama başarısız');
        }

        toast({
          title: "Başarılı",
          description: `Fiş onaylandı ve 100 puan verildi`,
        });
      } else {
        // Use the new reject function with logging
        const { data: rejectResult, error: rejectError } = await supabase
          .rpc('reject_receipt', {
            p_receipt_id: receiptId
          });

        if (rejectError) {
          console.error('Reject error:', rejectError);
          throw new Error(rejectError.message || 'Reddetme başarısız');
        }

        if (!rejectResult?.success) {
          throw new Error(rejectResult?.error || 'Reddetme başarısız');
        }

        toast({
          title: "Başarılı",
          description: "Fiş reddedildi",
        });
      }

      // Update local state by removing the processed receipt
      setPendingReceipts(prev => prev.filter(r => r.id !== receiptId));

    } catch (error) {
      console.error(`Error ${action}ing receipt:`, error);
      
      let errorMessage = 'Bilinmeyen hata';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast({
        title: "Hata",
        description: `Fiş ${action === 'approve' ? 'onaylanırken' : 'reddedilirken'} hata oluştu: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading admin data...</p>
        </div>
      </div>
    );
  }


  return (
    <AdminRoute>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage users, receipts, and platform analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/admin/analytics')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <BarChart className="h-4 w-4" />
            B2B Analytics
          </Button>
          <Button
            onClick={() => {
              logout();
              navigate('/auth');
            }}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-warning/10 rounded-xl">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Receipts</p>
                <p className="text-2xl font-bold text-warning">{stats.pendingReceipts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <TrendingUp className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Issued</p>
                <p className="text-2xl font-bold text-secondary">{stats.totalPointsIssued.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold text-accent">₺{stats.thisMonthRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QA Settings Panel */}
      <Card className="shadow-card border-warning/20 bg-warning/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-warning">
            <Settings className="h-5 w-5" />
            QA Settings
          </CardTitle>
          <CardDescription>
            ⚠️ Development and testing configuration only - disable before production release
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-duplicates" className="text-base">
                Allow duplicate receipts (QA)
              </Label>
              <p className="text-sm text-muted-foreground">
                Bypass duplicate receipt validation for testing purposes
              </p>
            </div>
            <Switch
              id="allow-duplicates"
              checked={allowDuplicates}
              onCheckedChange={handleDuplicateToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="receipts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Pending Receipts
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="gamification" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Gamification
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Pending Receipts Tab */}
        <TabsContent value="receipts" className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Pending Receipt Reviews</CardTitle>
              <CardDescription>
                Review and approve/reject submitted receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingReceipts.map((receipt) => (
                  <div key={receipt.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{receipt.storeName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Submitted by {receipt.userName}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-warning border-warning">
                        Pending Review
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                       <div>
                         <span className="text-muted-foreground">Amount:</span>
                         <p className="font-medium">{formatTRY(receipt.amount)}</p>
                       </div>
                      <div>
                        <span className="text-muted-foreground">Purchase Date:</span>
                        <p className="font-medium">{new Date(receipt.date).toLocaleDateString('tr-TR')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Card:</span>
                        <p className="font-medium font-mono text-xs">
                          {receipt.paymentMethod || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Submitted:</span>
                        <p className="font-medium">{new Date(receipt.submitDate).toLocaleDateString('tr-TR')}</p>
                      </div>
                       <div>
                         <span className="text-muted-foreground">Points:</span>
                         <p className="font-medium text-secondary">100 pts</p>
                       </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedReceipt(receipt.id)}
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => handleReceiptAction(receipt.id, 'approve')}
                        data-testid="approve-button"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleReceiptAction(receipt.id, 'reject')}
                        data-testid="reject-button"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserRoleManager 
            users={users.map(u => ({
              id: u.id,
              display_name: u.name,
              total_points: u.totalPoints,
              current_role: u.current_role
            }))} 
            onUserRoleChange={fetchData}
          />
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Monitor user activity and manage accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                        {user.status === 'active' ? 'Active' : 'Suspended'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Receipts:</span>
                        <p className="font-medium">{user.totalReceipts}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Points:</span>
                        <p className="font-medium text-secondary">{user.totalPoints.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Joined:</span>
                        <p className="font-medium">{new Date(user.joinDate).toLocaleDateString('tr-TR')}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <p className="font-medium">{user.status}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gamification Tab */}
        <TabsContent value="gamification" className="space-y-4">
          <GamificationAdmin onDataChange={fetchData} />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Receipt Analytics</CardTitle>
                <CardDescription>Monthly receipt submission trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyReceipts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Veri yok</p>
                  ) : (
                    monthlyReceipts.map((m) => (
                      <div key={m.label} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span>{m.label}</span>
                          <span className="font-semibold">{m.count.toLocaleString()} receipts</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full" style={{ width: `${m.ratio}%` }}></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Top Retailers</CardTitle>
                <CardDescription>Most popular stores by receipt count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topRetailers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Veri yok</p>
                  ) : (
                    topRetailers.map((store) => (
                      <div key={store.name} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{store.name}</p>
                          <p className="text-sm text-muted-foreground">{store.count} receipts</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{store.percentage}%</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </AdminRoute>
  );
};

export default AdminPanel;