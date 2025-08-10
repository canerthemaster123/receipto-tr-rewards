import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePointsLedger } from '@/hooks/usePointsLedger';
import { 
  Plus, 
  Minus, 
  Receipt, 
  Gift, 
  Users, 
  Loader2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const PointsHistory: React.FC = () => {
  const { entries, loading, totalPoints } = usePointsLedger();

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'receipt':
        return Receipt;
      case 'redemption':
        return Gift;
      case 'referral':
        return Users;
      default:
        return Plus;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'receipt':
        return 'Receipt Approval';
      case 'redemption':
        return 'Reward Redemption';
      case 'referral':
        return 'Referral Bonus';
      case 'migration':
        return 'Initial Balance';
      default:
        return 'Other';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'receipt':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'redemption':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'referral':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'migration':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading points history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Points History
        </h1>
        <p className="text-muted-foreground mt-2">
          Track all your points transactions and balance changes
        </p>
      </div>

      {/* Current Balance */}
      <Card className="bg-gradient-primary text-white shadow-elegant">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Current Balance</p>
              <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Complete history of all points earned and spent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
              <p className="text-muted-foreground">
                Start uploading receipts to earn your first points!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const Icon = getSourceIcon(entry.source);
                const isPositive = entry.delta > 0;
                
                return (
                  <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isPositive ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{getSourceLabel(entry.source)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="outline" 
                        className={getSourceColor(entry.source)}
                      >
                        {getSourceLabel(entry.source)}
                      </Badge>
                      <div className={`flex items-center gap-1 font-semibold ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isPositive ? (
                          <Plus className="h-4 w-4" />
                        ) : (
                          <Minus className="h-4 w-4" />
                        )}
                        <span>{Math.abs(entry.delta).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PointsHistory;