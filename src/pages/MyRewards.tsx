import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/enhanced-button';
import { useRedemptions } from '@/hooks/useRedemptions';
import { 
  Gift, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Copy,
  Loader2 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MyRewards: React.FC = () => {
  const { redemptions, loading } = useRedemptions();
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return Clock;
      case 'fulfilled':
        return CheckCircle;
      case 'failed':
        return XCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fulfilled':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code Copied",
      description: "Redemption code copied to clipboard",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your rewards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          My Rewards
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your redeemed rewards and access codes
        </p>
      </div>

      {/* Redemptions List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Redemption History</CardTitle>
          <CardDescription>
            All your reward redemptions and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {redemptions.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                <Gift className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No redemptions yet</h3>
              <p className="text-muted-foreground">
                Visit the Rewards Store to redeem your first reward!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {redemptions.map((redemption) => {
                const StatusIcon = getStatusIcon(redemption.status);
                
                return (
                  <div key={redemption.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{redemption.reward_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Redeemed on {new Date(redemption.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={getStatusColor(redemption.status)}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {redemption.status.charAt(0).toUpperCase() + redemption.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Points Used: <span className="font-medium text-foreground">{redemption.cost.toLocaleString()}</span>
                      </div>
                      
                      {redemption.status === 'fulfilled' && redemption.code && (
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {redemption.code}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyCode(redemption.code!)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      
                      {redemption.status === 'pending' && (
                        <div className="text-sm text-muted-foreground">
                          Processing your reward...
                        </div>
                      )}
                      
                      {redemption.status === 'failed' && (
                        <div className="text-sm text-red-600">
                          Redemption failed - points refunded
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to Use */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>How to Use Your Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Fulfilled Rewards</h3>
              <p className="text-sm text-muted-foreground">
                Use the provided code at checkout or in the respective app/website
              </p>
            </div>
            
            <div className="text-center">
              <div className="p-3 bg-yellow-100 rounded-xl w-fit mx-auto mb-3">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="font-semibold mb-2">Pending Rewards</h3>
              <p className="text-sm text-muted-foreground">
                Your reward is being processed and will be available within 24 hours
              </p>
            </div>
            
            <div className="text-center">
              <div className="p-3 bg-red-100 rounded-xl w-fit mx-auto mb-3">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="font-semibold mb-2">Failed Rewards</h3>
              <p className="text-sm text-muted-foreground">
                If a redemption fails, your points are automatically refunded
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyRewards;