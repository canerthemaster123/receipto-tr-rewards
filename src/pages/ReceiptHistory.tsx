import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Receipt, 
  Search, 
  Filter, 
  Calendar,
  Store,
  Coins,
  Eye,
  Download
} from 'lucide-react';

interface ReceiptRecord {
  id: string;
  storeName: string;
  amount: number;
  points: number;
  date: string;
  status: 'approved' | 'pending' | 'rejected';
  items: string[];
  imageUrl?: string;
}

const ReceiptHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);

  // Mock receipt data
  const receipts: ReceiptRecord[] = [
    {
      id: '1',
      storeName: 'Migros',
      amount: 124.50,
      points: 100,
      date: '2024-01-15',
      status: 'approved',
      items: ['Süt', 'Ekmek', 'Peynir', 'Domates', 'Makarna']
    },
    {
      id: '2',
      storeName: 'CarrefourSA',
      amount: 89.75,
      points: 100,
      date: '2024-01-14',
      status: 'approved',
      items: ['Çay', 'Şeker', 'Un', 'Yoğurt']
    },
    {
      id: '3',
      storeName: 'BIM',
      amount: 45.20,
      points: 100,
      date: '2024-01-13',
      status: 'pending',
      items: ['Çikolata', 'Bisküvi', 'Su']
    },
    {
      id: '4',
      storeName: 'A101',
      amount: 67.30,
      points: 100,
      date: '2024-01-12',
      status: 'approved',
      items: ['Deterjan', 'Şampuan', 'Diş Macunu']
    },
    {
      id: '5',
      storeName: 'ŞOK',
      amount: 156.80,
      points: 100,
      date: '2024-01-11',
      status: 'approved',
      items: ['Et', 'Tavuk', 'Sebze Karışımı', 'Pilav']
    }
  ];

  const filteredReceipts = receipts.filter(receipt =>
    receipt.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    receipt.items.some(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status: ReceiptRecord['status']) => {
    switch (status) {
      case 'approved': return 'bg-success text-white';
      case 'pending': return 'bg-warning text-white';
      case 'rejected': return 'bg-destructive text-white';
      default: return 'bg-muted';
    }
  };

  const getStatusText = (status: ReceiptRecord['status']) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  };

  const totalEarned = receipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.points, 0);

  const totalSpent = receipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0);

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
                <p className="text-2xl font-bold">{receipts.length}</p>
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
                <p className="text-2xl font-bold text-secondary">{totalEarned.toLocaleString()}</p>
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
                <p className="text-2xl font-bold text-accent">₺{totalSpent.toFixed(2)}</p>
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
        {filteredReceipts.map((receipt) => (
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
                      <h3 className="font-semibold text-lg">{receipt.storeName}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(receipt.date).toLocaleDateString('tr-TR')}
                        </span>
                        <span>₺{receipt.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {receipt.items.slice(0, 3).map((item, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                    {receipt.items.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{receipt.items.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Status and Points */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3">
                  <Badge className={getStatusColor(receipt.status)}>
                    {getStatusText(receipt.status)}
                  </Badge>
                  
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
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredReceipts.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="p-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Receipts Found</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Start uploading receipts to see them here'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Receipt Detail Modal (simplified) */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Receipt Details</CardTitle>
              <CardDescription>
                {selectedReceipt.storeName} - {new Date(selectedReceipt.date).toLocaleDateString('tr-TR')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Items:</h4>
                <div className="space-y-1">
                  {selectedReceipt.items.map((item, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      • {item}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="font-semibold">Total:</span>
                <span className="font-semibold">₺{selectedReceipt.amount.toFixed(2)}</span>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setSelectedReceipt(null)}
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReceiptHistory;