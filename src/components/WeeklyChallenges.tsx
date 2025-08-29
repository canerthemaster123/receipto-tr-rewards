import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/enhanced-button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useChallenges } from '@/hooks/useChallenges';
import { Target, Timer, Trophy, Calendar, Flame, Star, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const WeeklyChallenges: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { activeChallenges, userProgress, loading, refetch } = useChallenges();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);

  const getProgressForChallenge = (challengeId: string) => {
    return userProgress.find(p => p.challenge_id === challengeId);
  };

  const getTimeLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    if (end <= now) return null;
    return formatDistanceToNow(end, { addSuffix: false });
  };

  const claimReward = async (challengeId: string, challengeTitle: string) => {
    try {
      setClaimingReward(challengeId);
      
      const { data, error } = await supabase.rpc('claim_challenge_reward', {
        p_challenge_id: challengeId
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "🎉 Görev Tamamlandı!",
          description: `${challengeTitle} görevini tamamladınız ve ${data.points_awarded} puan kazandınız!`,
          duration: 6000,
        });
        refetch(); // Refresh challenge data
      } else {
        toast({
          title: "Hata",
          description: data?.error === 'already_claimed' ? 'Bu ödül zaten alınmış!' : 'Ödül alınamadı.',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: "Hata",
        description: "Ödül alınırken bir hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setClaimingReward(null);
    }
  };

  const isRewardClaimed = (progress: any) => {
    return progress?.meta?.claimed === true;
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
  const isCompleted = mainProgress?.completed;
  const isClaimed = isRewardClaimed(mainProgress);

  return (
    <Card 
      data-testid="weekly-challenges" 
      className={isCompleted && !isClaimed ? 'relative overflow-hidden animate-pulse border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20' : ''}
    >
      {isCompleted && !isClaimed && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-2 right-2 animate-bounce">
            <Flame className="h-6 w-6 text-orange-500" />
          </div>
          <div className="absolute top-4 right-8 animate-pulse">
            <Star className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="absolute top-6 right-14 animate-bounce delay-100">
            <Star className="h-3 w-3 text-yellow-400" />
          </div>
        </div>
      )}
      
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          {t('gamification.challenges.weeklyChallenge')}
          {isCompleted && !isClaimed && (
            <Badge variant="default" className="ml-auto bg-gradient-to-r from-yellow-400 to-orange-500 text-white animate-pulse">
              <Award className="h-3 w-3 mr-1" />
              Ödül Hazır!
            </Badge>
          )}
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
                  {isClaimed ? 'Ödül Alındı' : t('gamification.challenges.completed')}
                </Badge>
              )}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {isCompleted && !isClaimed && (
          <Button 
            onClick={() => claimReward(mainChallenge.id, challengeTitle)}
            disabled={claimingReward === mainChallenge.id}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-semibold animate-pulse"
          >
            {claimingReward === mainChallenge.id ? (
              <>
                <Flame className="h-4 w-4 mr-2 animate-spin" />
                Ödül Alınıyor...
              </>
            ) : (
              <>
                <Award className="h-4 w-4 mr-2" />
                {mainChallenge.reward_points} Puan Al! 🎉
              </>
            )}
          </Button>
        )}

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
                   const challengeCompleted = progress?.completed;
                   const challengeClaimed = isRewardClaimed(progress);

                   return (
                     <Card 
                       key={challenge.id}
                       className={challengeCompleted && !challengeClaimed ? 'relative overflow-hidden border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20' : ''}
                     >
                       {challengeCompleted && !challengeClaimed && (
                         <div className="absolute inset-0 pointer-events-none">
                           <div className="absolute top-2 right-2 animate-bounce">
                             <Flame className="h-5 w-5 text-orange-500" />
                           </div>
                           <div className="absolute top-3 right-7 animate-pulse">
                             <Star className="h-3 w-3 text-yellow-500" />
                           </div>
                         </div>
                       )}
                       
                       <CardContent className="pt-4">
                         <div className="flex justify-between items-start mb-3">
                           <h4 className="font-medium">{title}</h4>
                           <div className="flex items-center gap-2">
                             <Badge variant="secondary">
                               <Trophy className="h-3 w-3 mr-1" />
                               +{challenge.reward_points}
                             </Badge>
                             {challengeCompleted && !challengeClaimed && (
                               <Badge variant="default" className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white animate-pulse">
                                 <Award className="h-3 w-3 mr-1" />
                                 Hazır!
                               </Badge>
                             )}
                           </div>
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
                                   {challengeClaimed ? 'Ödül Alındı' : t('gamification.challenges.completed')}
                                 </Badge>
                               )}
                             </span>
                           </div>
                           <Progress value={percentage} className="h-2" />
                         </div>

                         {challengeCompleted && !challengeClaimed && (
                           <Button 
                             onClick={() => claimReward(challenge.id, title)}
                             disabled={claimingReward === challenge.id}
                             className="w-full mt-3 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-semibold"
                             size="sm"
                           >
                             {claimingReward === challenge.id ? (
                               <>
                                 <Flame className="h-4 w-4 mr-2 animate-spin" />
                                 Alınıyor...
                               </>
                             ) : (
                               <>
                                 <Award className="h-4 w-4 mr-2" />
                                 {challenge.reward_points} Puan Al!
                               </>
                             )}
                           </Button>
                         )}
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