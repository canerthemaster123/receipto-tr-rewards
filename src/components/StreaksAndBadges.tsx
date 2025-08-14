import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useStreaks } from '@/hooks/useStreaks';
import { useBadges } from '@/hooks/useBadges';
import { Award, Flame, Star, Medal, Wallet, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const iconMap = {
  Award,
  Flame,
  Star,
  Medal,
  Wallet,
};

const StreaksAndBadges: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { streak, loading: streakLoading } = useStreaks();
  const { allBadges, userBadges, loading: badgesLoading } = useBadges();

  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Award;
    return IconComponent;
  };

  const isEarned = (badgeKey: string) => {
    return userBadges.some(ub => ub.badge_key === badgeKey);
  };

  const getEarnedDate = (badgeKey: string) => {
    const earned = userBadges.find(ub => ub.badge_key === badgeKey);
    return earned ? new Date(earned.awarded_at) : null;
  };

  return (
    <div className="space-y-6">
      {/* Streaks Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            {t('gamification.streaks.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {streakLoading ? (
            <div className="flex justify-between">
              <Skeleton className="h-16 w-32" />
              <Skeleton className="h-16 w-32" />
            </div>
          ) : (
            <div className="flex justify-between">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {streak?.current_streak || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('gamification.streaks.current')}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-secondary">
                  {streak?.longest_streak || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('gamification.streaks.longest')}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Badges Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {t('gamification.badges.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {badgesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {allBadges.map((badge) => {
                const earned = isEarned(badge.key);
                const earnedDate = getEarnedDate(badge.key);
                const IconComponent = getIcon(badge.icon);
                const badgeName = i18n.language === 'tr' ? badge.name_tr : badge.name_en;
                const badgeDesc = i18n.language === 'tr' ? badge.desc_tr : badge.desc_en;

                return (
                  <TooltipProvider key={badge.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`
                            p-4 rounded-lg border text-center transition-all hover:scale-105
                            ${earned 
                              ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 shadow-lg' 
                              : 'bg-muted/50 border-border opacity-60'
                            }
                          `}
                        >
                          <div className="flex justify-center mb-2">
                            {earned ? (
                              <IconComponent className="h-8 w-8 text-yellow-600" />
                            ) : (
                              <Lock className="h-8 w-8 text-muted-foreground" />
                            )}
                          </div>
                          <div className={`text-sm font-medium ${earned ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {badgeName}
                          </div>
                          {earned && earnedDate && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {formatDistanceToNow(earnedDate, { addSuffix: true })}
                            </Badge>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="text-center">
                          <div className="font-medium">{badgeName}</div>
                          {badgeDesc && (
                            <div className="text-sm opacity-75">{badgeDesc}</div>
                          )}
                          {!earned && (
                            <div className="text-xs mt-1 opacity-60">
                              {t('gamification.badges.locked')}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StreaksAndBadges;