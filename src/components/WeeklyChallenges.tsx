import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/enhanced-button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useChallenges } from '@/hooks/useChallenges';
import { Target, Timer, Trophy, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const WeeklyChallenges: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeChallenges, userProgress, loading } = useChallenges();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const getProgressForChallenge = (challengeId: string) => {
    return userProgress.find(p => p.challenge_id === challengeId);
  };

  const getTimeLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    if (end <= now) return null;
    return formatDistanceToNow(end, { addSuffix: false });
  };

  // Get the most relevant challenge to display in the main card
  const mainChallenge = activeChallenges[0];
  const mainProgress = mainChallenge ? getProgressForChallenge(mainChallenge.id) : null;
  const progressPercentage = mainChallenge && mainProgress 
    ? Math.min((mainProgress.progress / mainChallenge.goal_target) * 100, 100)
    : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <Skeleton className="h-6 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!mainChallenge) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('gamification.challenges.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('gamification.challenges.noChallenges')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const timeLeft = getTimeLeft(mainChallenge.ends_at);
  const challengeTitle = i18n.language === 'tr' ? mainChallenge.title_tr : mainChallenge.title_en;

  return (
    <Card data-testid="weekly-challenges">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          {t('gamification.challenges.weeklyChallenge')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-lg">{challengeTitle}</h3>
            <Badge variant="outline" className="text-xs">
              <Trophy className="h-3 w-3 mr-1" />
              +{mainChallenge.reward_points}
            </Badge>
          </div>
          
          {timeLeft && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
              <Timer className="h-4 w-4" />
              {t('gamification.challenges.timeLeft', { time: timeLeft })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('gamification.challenges.progress')}</span>
            <span>
              {mainProgress?.progress || 0} / {mainChallenge.goal_target}
              {mainProgress?.completed && (
                <Badge variant="default" className="ml-2 text-xs">
                  {t('gamification.challenges.completed')}
                </Badge>
              )}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {activeChallenges.length > 1 && (
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                {t('gamification.challenges.viewAll')} ({activeChallenges.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('gamification.challenges.allActiveChallenges')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {activeChallenges.map((challenge) => {
                  const progress = getProgressForChallenge(challenge.id);
                  const percentage = progress 
                    ? Math.min((progress.progress / challenge.goal_target) * 100, 100)
                    : 0;
                  const title = i18n.language === 'tr' ? challenge.title_tr : challenge.title_en;
                  const challengeTimeLeft = getTimeLeft(challenge.ends_at);

                  return (
                    <Card key={challenge.id}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium">{title}</h4>
                          <Badge variant="secondary">
                            <Trophy className="h-3 w-3 mr-1" />
                            +{challenge.reward_points}
                          </Badge>
                        </div>
                        
                        {challengeTimeLeft && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                            <Timer className="h-4 w-4" />
                            {t('gamification.challenges.timeLeft', { time: challengeTimeLeft })}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{t('gamification.challenges.progress')}</span>
                            <span>
                              {progress?.progress || 0} / {challenge.goal_target}
                              {progress?.completed && (
                                <Badge variant="default" className="ml-2 text-xs">
                                  {t('gamification.challenges.completed')}
                                </Badge>
                              )}
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyChallenges;