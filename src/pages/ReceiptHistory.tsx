import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';
import { Link } from 'react-router-dom';
import { 
  Receipt, 
  Search, 
  Filter, 
  Calendar,
  Store,
  Coins,
  Eye,
  Download,
  Upload,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';

interface ReceiptRecord {
  id: string;
  merchant: string;
  total: number;
  points: number;
  purchase_date: string;
  payment_method: string | null;
  status: 'approved' | 'pending' | 'rejected';
  items: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

const ReceiptHistory: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchReceipts();
    }
  }, [user]);

  const fetchReceipts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const { data: receiptsData, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setReceipts(receiptsData || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      toast({
        title: "Error",
        description: "Failed to load receipt history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredReceipts = receipts.filter(receipt =>
    receipt.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.items.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: ReceiptRecord['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalEarned = receipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.points, 0);

  const totalSpent = receipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + parseFloat(r.total.toString()), 0);

  const getItemsArray = (items: string): string[] => {
    if (!items) return [];
    return items.split('\n').filter(item => item.trim().length > 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Receipt History
          </h1>
          <p className="text-muted-foreground">
            Track all your uploaded receipts and earned points
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Receipts</p>
                <p className="text-2xl font-bold">{loading ? '...' : receipts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-xl">
                <Coins className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Points Earned</p>
                <p className="text-2xl font-bold text-secondary">{loading ? '...' : totalEarned.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-xl">
                <Store className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-accent">₺{loading ? '...' : totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search receipts by store or items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List */}
      <div className="space-y-4">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="shadow-card animate-pulse">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg w-9 h-9"></div>
                      <div>
                        <div className="h-5 bg-muted rounded w-24 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-32"></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-6 bg-muted rounded w-16"></div>
                      <div className="h-6 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-muted rounded w-16"></div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredReceipts.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {receipts.length === 0 ? 'No Receipts Found' : 'No Search Results'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {receipts.length === 0 
                  ? 'Start uploading receipts to see them here'
                  : 'Try adjusting your search terms'
                }
              </p>
              {receipts.length === 0 && (
                <Link to="/upload">
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Your First Receipt
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredReceipts.map((receipt) => {
            const itemsArray = getItemsArray(receipt.items);
            return (
              <Card key={receipt.id} className="shadow-card hover:shadow-elegant transition-all">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Receipt Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Receipt className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{receipt.merchant}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(receipt.purchase_date).toLocaleDateString('tr-TR')}
                            </span>
                            <span>₺{parseFloat(receipt.total.toString()).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {itemsArray.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {itemsArray.slice(0, 3).map((item, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                          {itemsArray.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{itemsArray.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status and Points */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3">
                      {getStatusBadge(receipt.status)}
                      
                      {receipt.status === 'approved' && (
                        <div className="flex items-center gap-2 text-secondary font-medium">
                          <Coins className="h-4 w-4" />
                          +{receipt.points} pts
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReceipt(receipt)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      {receipt.image_url && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(receipt.image_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                          Image
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Receipt Details</span>
                {getStatusBadge(selectedReceipt.status)}
              </CardTitle>
              <CardDescription>
                {selectedReceipt.merchant} - {new Date(selectedReceipt.purchase_date).toLocaleDateString('tr-TR')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedReceipt.items && (
                <div>
                  <h4 className="font-semibold mb-2">Items:</h4>
                  <div className="space-y-1">
                     {getItemsArray(selectedReceipt.items).map((item, index) => {
                       // Check if item has quantity suffix
                       const hasQty = item.includes(' x');
                       return (
                       <div key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                        • {item}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Purchase Date:</span>
                  <span className="text-sm">{new Date(selectedReceipt.purchase_date).toLocaleDateString('tr-TR')}</span>
                </div>
                
                {selectedReceipt.payment_method && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Payment Method:</span>
                    <span className="text-sm font-mono">{selectedReceipt.payment_method}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {getStatusBadge(selectedReceipt.status)}
                </div>
                
                {selectedReceipt.status === 'approved' && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Points Earned:</span>
                    <span className="text-sm font-medium text-secondary">+{selectedReceipt.points} pts</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center font-semibold">
                  <span>Total:</span>
                  <span>₺{parseFloat(selectedReceipt.total.toString()).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedReceipt(null)}
                >
                  Close
                </Button>
                {selectedReceipt.image_url && (
                  <Button 
                    variant="default" 
                    className="flex-1"
                    onClick={() => window.open(selectedReceipt.image_url, '_blank')}
                  >
                    View Image
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReceiptHistory;