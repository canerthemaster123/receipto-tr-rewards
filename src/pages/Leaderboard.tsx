import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuth } from '@/components/AuthContext';
import { Trophy, Medal, Award, Crown } from 'lucide-react';

const Leaderboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { entries, loading, refetch, availablePeriods } = useLeaderboard();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');

  // Filter periods by type
  const weeklyPeriods = availablePeriods.filter(p => p.startsWith('weekly-'));
  const monthlyPeriods = availablePeriods.filter(p => p.startsWith('monthly-'));

  // Auto-select latest period when tab changes
  useEffect(() => {
    const periods = activeTab === 'weekly' ? weeklyPeriods : monthlyPeriods;
    if (periods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(periods[0]);
    }
  }, [activeTab, weeklyPeriods, monthlyPeriods, selectedPeriod]);

  // Fetch leaderboard when period changes
  useEffect(() => {
    if (selectedPeriod) {
      refetch(selectedPeriod);
    }
  }, [selectedPeriod, refetch]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getUserRank = () => {
    if (!user) return null;
    const userEntry = entries.find(entry => entry.user_id === user.id);
    return userEntry ? userEntry.rank : null;
  };

  const formatPeriodDisplay = (period: string) => {
    if (period.startsWith('weekly-')) {
      const yearWeek = period.replace('weekly-', '');
      return `${t('gamification.leaderboard.week')} ${yearWeek}`;
    } else if (period.startsWith('monthly-')) {
      const yearMonth = period.replace('monthly-', '');
      return `${t('gamification.leaderboard.month')} ${yearMonth}`;
    }
    return period;
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">{t('auth.pleaseSignIn')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('gamification.leaderboard.title')}</h1>
        <p className="text-muted-foreground">{t('gamification.leaderboard.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as 'weekly' | 'monthly');
        setSelectedPeriod('');
      }}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="weekly">{t('gamification.leaderboard.weekly')}</TabsTrigger>
          <TabsTrigger value="monthly">{t('gamification.leaderboard.monthly')}</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <div className="flex gap-4 items-center">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t('gamification.leaderboard.selectWeek')} />
              </SelectTrigger>
              <SelectContent>
                {weeklyPeriods.map(period => (
                  <SelectItem key={period} value={period}>
                    {formatPeriodDisplay(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LeaderboardTable 
            entries={entries} 
            loading={loading} 
            userRank={getUserRank()} 
          />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
          <div className="flex gap-4 items-center">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t('gamification.leaderboard.selectMonth')} />
              </SelectTrigger>
              <SelectContent>
                {monthlyPeriods.map(period => (
                  <SelectItem key={period} value={period}>
                    {formatPeriodDisplay(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LeaderboardTable 
            entries={entries} 
            loading={loading} 
            userRank={getUserRank()} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface LeaderboardTableProps {
  entries: any[];
  loading: boolean;
  userRank: number | null;
}

const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ entries, loading, userRank }) => {
  const { t } = useTranslation();

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t('gamification.leaderboard.rankings')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('gamification.leaderboard.noData')}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${entry.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200' : 'bg-background'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(entry.rank)}
                    </div>
                    <div>
                      <div className="font-medium">{entry.public_name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={entry.rank <= 3 ? "default" : "secondary"}>
                      {entry.points.toLocaleString()} {t('common.points')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {userRank && userRank > 10 && (
              <div className="mt-6 pt-4 border-t">
                <div className="text-center text-sm text-muted-foreground">
                  {t('gamification.leaderboard.yourRank', { 
                    rank: userRank, 
                    points: entries.find(e => e.rank === userRank)?.points || 0 
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Leaderboard;