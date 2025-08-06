import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
  Calendar
} from 'lucide-react';

interface ReceiptSubmission {
  id: string;
  userId: string;
  userName: string;
  storeName: string;
  amount: number;
  date: string;
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
}

const AdminPanel: React.FC = () => {
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Mock data
  const pendingReceipts: ReceiptSubmission[] = [
    {
      id: '1',
      userId: 'user1',
      userName: 'Mehmet Yılmaz',
      storeName: 'Migros',
      amount: 124.50,
      date: '2024-01-15',
      status: 'pending',
      submitDate: '2024-01-15T10:30:00'
    },
    {
      id: '2',
      userId: 'user2',
      userName: 'Ayşe Demir',
      storeName: 'CarrefourSA',
      amount: 89.75,
      date: '2024-01-14',
      status: 'pending',
      submitDate: '2024-01-14T15:45:00'
    },
    {
      id: '3',
      userId: 'user3',
      userName: 'Ali Kaya',
      storeName: 'BIM',
      amount: 45.20,
      date: '2024-01-13',
      status: 'pending',
      submitDate: '2024-01-13T09:15:00'
    }
  ];

  const users: UserStats[] = [
    {
      id: '1',
      name: 'Mehmet Yılmaz',
      email: 'mehmet@example.com',
      totalReceipts: 23,
      totalPoints: 2300,
      joinDate: '2024-01-01',
      status: 'active'
    },
    {
      id: '2',
      name: 'Ayşe Demir',
      email: 'ayse@example.com',
      totalReceipts: 18,
      totalPoints: 1800,
      joinDate: '2024-01-05',
      status: 'active'
    },
    {
      id: '3',
      name: 'Ali Kaya',
      email: 'ali@example.com',
      totalReceipts: 31,
      totalPoints: 3100,
      joinDate: '2023-12-15',
      status: 'active'
    }
  ];

  const stats = {
    totalUsers: 1250,
    pendingReceipts: pendingReceipts.length,
    totalPointsIssued: 125000,
    thisMonthRevenue: 45280
  };

  const handleReceiptAction = (receiptId: string, action: 'approve' | 'reject') => {
    // Mock action - in real app would update database
    console.log(`${action}ing receipt ${receiptId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage users, receipts, and platform analytics
        </p>
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="receipts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Pending Receipts
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
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
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Amount:</span>
                        <p className="font-medium">₺{receipt.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Purchase Date:</span>
                        <p className="font-medium">{new Date(receipt.date).toLocaleDateString('tr-TR')}</p>
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
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleReceiptAction(receipt.id, 'reject')}
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

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
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
                  <div className="flex justify-between items-center">
                    <span>January 2024</span>
                    <span className="font-semibold">1,248 receipts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{width: '85%'}}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>December 2023</span>
                    <span className="font-semibold">1,156 receipts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{width: '78%'}}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span>November 2023</span>
                    <span className="font-semibold">1,089 receipts</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{width: '73%'}}></div>
                  </div>
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
                  {[
                    { name: 'Migros', count: 342, percentage: 28 },
                    { name: 'CarrefourSA', count: 289, percentage: 23 },
                    { name: 'BIM', count: 256, percentage: 21 },
                    { name: 'A101', count: 198, percentage: 16 },
                    { name: 'ŞOK', count: 163, percentage: 13 }
                  ].map((store) => (
                    <div key={store.name} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{store.name}</p>
                        <p className="text-sm text-muted-foreground">{store.count} receipts</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{store.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;