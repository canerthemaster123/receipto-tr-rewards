import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/enhanced-button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { 
  Award, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar, 
  Target, 
  Trophy,
  Star,
  Medal,
  Flame,
  Wallet,
  Loader2,
  Play,
  BarChart3
} from 'lucide-react';

interface Badge {
  id: string;
  key: string;
  name_en: string;
  name_tr: string;
  desc_en?: string;
  desc_tr?: string;
  icon: string;
  active: boolean;
  sort: number;
}

interface Challenge {
  id: string;
  title_en: string;
  title_tr: string;
  goal_key: string;
  goal_target: number;
  starts_at: string;
  ends_at: string;
  reward_points: number;
  active: boolean;
}

interface GamificationAdminProps {
  onDataChange?: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  Award: <Award className="h-4 w-4" />,
  Star: <Star className="h-4 w-4" />,
  Medal: <Medal className="h-4 w-4" />,
  Flame: <Flame className="h-4 w-4" />,
  Wallet: <Wallet className="h-4 w-4" />,
  Trophy: <Trophy className="h-4 w-4" />
};

const GamificationAdmin: React.FC<GamificationAdminProps> = ({ onDataChange }) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .order('sort', { ascending: true });

      if (badgesError) throw badgesError;

      // Fetch challenges
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });

      if (challengesError) throw challengesError;

      setBadges(badgesData || []);
      setChallenges(challengesData || []);
    } catch (error) {
      console.error('Error fetching gamification data:', error);
      toast({
        title: "Error",
        description: "Failed to load gamification data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveBadge = async (badge: Omit<Badge, 'id'> & { id?: string }) => {
    try {
      if (badge.id) {
        // Update existing
        const { error } = await supabase
          .from('badges')
          .update(badge)
          .eq('id', badge.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('badges')
          .insert(badge);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Badge ${badge.id ? 'updated' : 'created'} successfully.`,
      });

      setEditingBadge(null);
      fetchData();
    } catch (error) {
      console.error('Error saving badge:', error);
      toast({
        title: "Error",
        description: "Failed to save badge.",
        variant: "destructive",
      });
    }
  };

  const saveChallenge = async (challenge: Omit<Challenge, 'id'> & { id?: string }) => {
    try {
      if (challenge.id) {
        // Update existing
        const { error } = await supabase
          .from('challenges')
          .update(challenge)
          .eq('id', challenge.id);
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('challenges')
          .insert(challenge);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Challenge ${challenge.id ? 'updated' : 'created'} successfully.`,
      });

      setEditingChallenge(null);
      fetchData();
    } catch (error) {
      console.error('Error saving challenge:', error);
      toast({
        title: "Error",
        description: "Failed to save challenge.",
        variant: "destructive",
      });
    }
  };

  const generateLeaderboard = async (period: 'weekly' | 'monthly') => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      let periodKey: string;

      if (period === 'weekly') {
        // Get start of current week (Monday)
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        const year = startDate.getFullYear();
        const weekNum = Math.ceil((startDate.getDate() - startDate.getDay() + 1) / 7);
        periodKey = `weekly-${year}W${weekNum.toString().padStart(2, '0')}`;
      } else {
        // Get start of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        const year = startDate.getFullYear();
        const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
        periodKey = `monthly-${year}-${month}`;
      }

      const { error } = await supabase.rpc('build_leaderboard_snapshot', {
        p_period_key: periodKey,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${period.charAt(0).toUpperCase() + period.slice(1)} leaderboard generated successfully.`,
      });
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      toast({
        title: "Error",
        description: "Failed to generate leaderboard.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading gamification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Badges Management */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Badges Management
              </CardTitle>
              <CardDescription>
                Create and manage achievement badges
              </CardDescription>
            </div>
            <Button
              onClick={() => setEditingBadge({
                id: '',
                key: '',
                name_en: '',
                name_tr: '',
                desc_en: '',
                desc_tr: '',
                icon: 'Award',
                active: true,
                sort: 100
              })}
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add Badge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge) => (
              <div key={badge.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {iconMap[badge.icon] || <Award className="h-4 w-4" />}
                    <Badge variant={badge.active ? 'default' : 'secondary'}>
                      {badge.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingBadge(badge)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">{badge.name_en}</h3>
                  <p className="text-sm text-muted-foreground">{badge.name_tr}</p>
                  <p className="text-xs text-muted-foreground mt-1">Key: {badge.key}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Challenges Management */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Weekly Challenges
              </CardTitle>
              <CardDescription>
                Create and manage weekly challenges
              </CardDescription>
            </div>
            <Button
              onClick={() => setEditingChallenge({
                id: '',
                title_en: '',
                title_tr: '',
                goal_key: 'uploads',
                goal_target: 1,
                starts_at: new Date().toISOString().split('T')[0],
                ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                reward_points: 100,
                active: true
              })}
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Add Challenge
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <div key={challenge.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{challenge.title_en}</h3>
                    <p className="text-sm text-muted-foreground">{challenge.title_tr}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={challenge.active ? 'default' : 'secondary'}>
                      {challenge.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingChallenge(challenge)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Goal:</span>
                    <p className="font-medium">{challenge.goal_key} = {challenge.goal_target}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reward:</span>
                    <p className="font-medium text-secondary">+{challenge.reward_points} pts</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Starts:</span>
                    <p className="font-medium">{new Date(challenge.starts_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ends:</span>
                    <p className="font-medium">{new Date(challenge.ends_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Management */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Leaderboard Management
          </CardTitle>
          <CardDescription>
            Generate leaderboard snapshots for different periods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => generateLeaderboard('weekly')}
              variant="secondary"
            >
              <Calendar className="h-4 w-4" />
              Generate Weekly
            </Button>
            <Button
              onClick={() => generateLeaderboard('monthly')}
              variant="secondary"
            >
              <Calendar className="h-4 w-4" />
              Generate Monthly
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Badge Edit Modal */}
      {editingBadge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingBadge.id ? 'Edit Badge' : 'Create Badge'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Key</Label>
                <Input
                  value={editingBadge.key}
                  onChange={(e) => setEditingBadge({...editingBadge, key: e.target.value})}
                  placeholder="e.g., first_upload"
                />
              </div>
              <div>
                <Label>Name (English)</Label>
                <Input
                  value={editingBadge.name_en}
                  onChange={(e) => setEditingBadge({...editingBadge, name_en: e.target.value})}
                />
              </div>
              <div>
                <Label>Name (Turkish)</Label>
                <Input
                  value={editingBadge.name_tr}
                  onChange={(e) => setEditingBadge({...editingBadge, name_tr: e.target.value})}
                />
              </div>
              <div>
                <Label>Icon</Label>
                <Input
                  value={editingBadge.icon}
                  onChange={(e) => setEditingBadge({...editingBadge, icon: e.target.value})}
                  placeholder="Award, Star, Medal, Flame, Wallet"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingBadge.active}
                  onCheckedChange={(checked) => setEditingBadge({...editingBadge, active: checked})}
                />
                <Label>Active</Label>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => saveBadge(editingBadge)}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingBadge(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Challenge Edit Modal */}
      {editingChallenge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{editingChallenge.id ? 'Edit Challenge' : 'Create Challenge'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title (English)</Label>
                <Input
                  value={editingChallenge.title_en}
                  onChange={(e) => setEditingChallenge({...editingChallenge, title_en: e.target.value})}
                />
              </div>
              <div>
                <Label>Title (Turkish)</Label>
                <Input
                  value={editingChallenge.title_tr}
                  onChange={(e) => setEditingChallenge({...editingChallenge, title_tr: e.target.value})}
                />
              </div>
              <div>
                <Label>Goal Key</Label>
                <select
                  value={editingChallenge.goal_key}
                  onChange={(e) => setEditingChallenge({...editingChallenge, goal_key: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="uploads">Uploads</option>
                  <option value="approved_uploads">Approved Uploads</option>
                  <option value="spend_total_trl">Spend Total (TRL)</option>
                </select>
              </div>
              <div>
                <Label>Goal Target</Label>
                <Input
                  type="number"
                  value={editingChallenge.goal_target}
                  onChange={(e) => setEditingChallenge({...editingChallenge, goal_target: Number(e.target.value)})}
                />
              </div>
              <div>
                <Label>Reward Points</Label>
                <Input
                  type="number"
                  value={editingChallenge.reward_points}
                  onChange={(e) => setEditingChallenge({...editingChallenge, reward_points: Number(e.target.value)})}
                />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editingChallenge.starts_at.split('T')[0]}
                  onChange={(e) => setEditingChallenge({...editingChallenge, starts_at: e.target.value})}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editingChallenge.ends_at.split('T')[0]}
                  onChange={(e) => setEditingChallenge({...editingChallenge, ends_at: e.target.value})}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={editingChallenge.active}
                  onCheckedChange={(checked) => setEditingChallenge({...editingChallenge, active: checked})}
                />
                <Label>Active</Label>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => saveChallenge(editingChallenge)}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingChallenge(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GamificationAdmin;