import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Badge } from '../components/ui/badge';
import { useRewards } from '../hooks/useRewards';
import { usePointsLedger } from '../hooks/usePointsLedger';
import { supabase } from '@/integrations/supabase/client';
import { 
  Gift, 
  Coins, 
  ShoppingBag, 
  Coffee, 
  Smartphone, 
  GamepadIcon,
  CreditCard,
  CheckCircle,
  Star,
  Loader2
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface StaticReward {
  id: string;
  title: string;
  description: string;
  points: number;
  category: 'gift_card' | 'cashback' | 'discount';
  icon: any;
  brand: string;
  value: string;
  popular?: boolean;
  image?: string;
}

interface DatabaseReward {
  id: string;
  name: string;
  cost: number;
  stock: number;
  active: boolean;
  description?: string;
  category?: string;
}

type RewardType = StaticReward | DatabaseReward;

const Rewards: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { rewards: dbRewards, loading: rewardsLoading } = useRewards();
  const { totalPoints } = usePointsLedger();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Fallback static rewards for demo if no database rewards
  const staticRewards: StaticReward[] = [
    {
      id: '1',
      title: 'Amazon Gift Card',
      description: '₺10 Amazon Gift Card',
      points: 1000,
      category: 'gift_card',
      icon: ShoppingBag,
      brand: 'Amazon',
      value: '₺10',
      popular: true
    },
    {
      id: '2',
      title: 'Starbucks Gift Card',
      description: '₺15 Starbucks Gift Card',
      points: 1500,
      category: 'gift_card',
      icon: Coffee,
      brand: 'Starbucks',
      value: '₺15'
    },
    {
      id: '3',
      title: 'PayPal Cashback',
      description: 'Direct cashback to PayPal',
      points: 2000,
      category: 'cashback',
      icon: CreditCard,
      brand: 'PayPal',
      value: '₺20',
      popular: true
    },
    {
      id: '4',
      title: 'Steam Gift Card',
      description: '₺25 Steam Wallet Credit',
      points: 2500,
      category: 'gift_card',
      icon: GamepadIcon,
      brand: 'Steam',
      value: '₺25'
    },
    {
      id: '5',
      title: 'iTunes Gift Card',
      description: '₺20 iTunes Gift Card',
      points: 2000,
      category: 'gift_card',
      icon: Smartphone,
      brand: 'Apple',
      value: '₺20'
    },
    {
      id: '6',
      title: 'Bank Transfer',
      description: 'Direct bank transfer',
      points: 5000,
      category: 'cashback',
      icon: CreditCard,
      brand: 'Bank',
      value: '₺50'
    }
  ];

  // Use database rewards if available, otherwise fallback to static
  const displayRewards: RewardType[] = dbRewards.length > 0 ? dbRewards : staticRewards;

  const categories = [
    { id: 'all', label: 'All Rewards', icon: Gift },
    { id: 'gift_card', label: 'Gift Cards', icon: ShoppingBag },
    { id: 'cashback', label: 'Cashback', icon: CreditCard },
    { id: 'discount', label: 'Discounts', icon: Star }
  ];

  const filteredRewards = selectedCategory === 'all' 
    ? displayRewards 
    : displayRewards.filter(reward => reward.category === selectedCategory);

  const getRewardCost = (reward: RewardType): number => {
    return 'cost' in reward ? reward.cost : reward.points;
  };

  const getRewardName = (reward: RewardType): string => {
    return 'name' in reward ? reward.name : reward.title;
  };

  const getRewardDescription = (reward: RewardType): string => {
    return reward.description || `Redeem ${getRewardName(reward)} with your points`;
  };

  const handleRedeem = async (reward: RewardType) => {
    if (!user) return;

    const cost = getRewardCost(reward);
    const name = getRewardName(reward);

    if (totalPoints < cost) {
      toast({
        title: "Insufficient Points",
        description: `You need ${cost - totalPoints} more points to redeem this reward.`,
        variant: "destructive",
      });
      return;
    }

    setIsRedeeming(true);
    
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        reward_name: name,
        points_cost: cost
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Reward Redeemed!",
          description: `${name} redemption is being processed. Check "My Rewards" for updates.`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Redemption error:', error);
      toast({
        title: "Redemption Failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  const canAfford = (points: number) => totalPoints >= points;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Rewards Store
        </h1>
        <p className="text-muted-foreground mt-2">
          Redeem your points for amazing rewards
        </p>
      </div>

      {/* Points Balance */}
      <Card className="bg-gradient-reward text-white shadow-elegant">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Your Points Balance</p>
              <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Coins className="h-8 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {category.label}
            </Button>
          );
        })}
      </div>

      {/* Rewards Grid */}
      {rewardsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRewards.map((reward) => {
            const cost = getRewardCost(reward);
            const name = getRewardName(reward);
            const description = getRewardDescription(reward);
            const affordable = canAfford(cost);
          
            return (
              <Card 
                key={reward.id} 
                className={`shadow-card hover:shadow-elegant transition-all relative ${
                  !affordable ? 'opacity-75' : ''
                }`}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${
                      affordable ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <Gift className={`h-6 w-6 ${
                        affordable ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{name}</CardTitle>
                      <CardDescription>
                        {'brand' in reward ? reward.brand : reward.category || 'Reward'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-secondary">
                      <Coins className="h-4 w-4" />
                      <span className="font-medium">{cost.toLocaleString()}</span>
                    </div>
                    {'stock' in reward ? (
                      <div className="text-sm text-muted-foreground">
                        Stock: {reward.stock}
                      </div>
                    ) : 'value' in reward ? (
                      <div className="text-sm text-primary font-medium">
                        {reward.value}
                      </div>
                    ) : null}
                  </div>
                  
                  <Button
                    onClick={() => handleRedeem(reward)}
                    disabled={!affordable || isRedeeming || ('stock' in reward && reward.stock <= 0)}
                    variant={affordable ? "default" : "outline"}
                    className="w-full"
                  >
                    {isRedeeming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redeeming...
                      </>
                    ) : affordable ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        Redeem Now
                      </>
                    ) : (
                      `Need ${(cost - totalPoints).toLocaleString()} more points`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* How it Works */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>How Redemption Works</CardTitle>
          <CardDescription>
            Get your rewards delivered digitally in minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="p-3 bg-primary/10 rounded-xl w-fit mx-auto mb-3">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Choose Reward</h3>
              <p className="text-sm text-muted-foreground">
                Select from our wide range of gift cards and cashback options
              </p>
            </div>
            
            <div className="text-center">
              <div className="p-3 bg-secondary/10 rounded-xl w-fit mx-auto mb-3">
                <CheckCircle className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="font-semibold mb-2">Instant Redemption</h3>
              <p className="text-sm text-muted-foreground">
                Points are deducted and your reward is processed immediately
              </p>
            </div>
            
            <div className="text-center">
              <div className="p-3 bg-accent/10 rounded-xl w-fit mx-auto mb-3">
                <Gift className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">Receive & Enjoy</h3>
              <p className="text-sm text-muted-foreground">
                Get your digital reward via email within 5 minutes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Rewards;