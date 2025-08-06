import React, { useState } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/enhanced-button';
import { Badge } from '../components/ui/badge';
import { 
  Gift, 
  Coins, 
  ShoppingBag, 
  Coffee, 
  Smartphone, 
  GamepadIcon,
  CreditCard,
  CheckCircle,
  Star
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface Reward {
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

const Rewards: React.FC = () => {
  const { user, userProfile, updatePoints } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const rewards: Reward[] = [
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

  const categories = [
    { id: 'all', label: 'All Rewards', icon: Gift },
    { id: 'gift_card', label: 'Gift Cards', icon: ShoppingBag },
    { id: 'cashback', label: 'Cashback', icon: CreditCard },
    { id: 'discount', label: 'Discounts', icon: Star }
  ];

  const filteredRewards = selectedCategory === 'all' 
    ? rewards 
    : rewards.filter(reward => reward.category === selectedCategory);

  const handleRedeem = async (reward: Reward) => {
    if (!user) return;

    const currentPoints = userProfile?.total_points || 0;
    if (currentPoints < reward.points) {
      toast({
        title: "Insufficient Points",
        description: `You need ${reward.points - currentPoints} more points to redeem this reward.`,
        variant: "destructive",
      });
      return;
    }

    // Mock redemption process
    updatePoints(currentPoints - reward.points);
    
    toast({
      title: "Reward Redeemed!",
      description: `${reward.title} has been sent to your email. Check your inbox!`,
    });
  };

  const canAfford = (points: number) => userProfile ? userProfile.total_points >= points : false;

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
              <p className="text-3xl font-bold">{userProfile?.total_points?.toLocaleString() || 0}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRewards.map((reward) => {
          const Icon = reward.icon;
          const affordable = canAfford(reward.points);
          
          return (
            <Card 
              key={reward.id} 
              className={`shadow-card hover:shadow-elegant transition-all relative ${
                !affordable ? 'opacity-75' : ''
              }`}
            >
              {reward.popular && (
                <Badge className="absolute -top-2 -right-2 bg-accent text-white z-10">
                  Popular
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${
                    affordable ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Icon className={`h-6 w-6 ${
                      affordable ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{reward.title}</CardTitle>
                    <CardDescription>{reward.brand}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {reward.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-primary">
                    {reward.value}
                  </div>
                  <div className="flex items-center gap-1 text-secondary">
                    <Coins className="h-4 w-4" />
                    <span className="font-medium">{reward.points.toLocaleString()}</span>
                  </div>
                </div>
                
                <Button
                  onClick={() => handleRedeem(reward)}
                  disabled={!affordable}
                  variant={affordable ? "reward" : "outline"}
                  className="w-full"
                >
                  {affordable ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Redeem Now
                    </>
                  ) : (
                    `Need ${(reward.points - (userProfile?.total_points || 0)).toLocaleString()} more points`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

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