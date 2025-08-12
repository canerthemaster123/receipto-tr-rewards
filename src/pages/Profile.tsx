import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { useUserRole } from '../hooks/useUserRole';
import { usePointsLedger } from '../hooks/usePointsLedger';
import { Copy, User, Award, Shield, HelpCircle, Clock, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PointsLedgerEntry {
  id: string;
  source: string;
  delta: number;
  created_at: string;
  meta: any;
}

const Profile: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { userRole, isLoading: roleLoading } = useUserRole();
  const { entries: pointsHistory, totalPoints, loading: isLoadingHistory } = usePointsLedger();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(userProfile?.display_name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'receipt':
        return <TrendingUp className="h-4 w-4 text-success" />;
      case 'referral':
        return <User className="h-4 w-4 text-secondary" />;
      case 'redemption':
        return <Award className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSourceLabel = (source: string, meta: any) => {
    switch (source) {
      case 'receipt':
        return meta?.merchant ? `Receipt from ${meta.merchant}` : 'Receipt approved';
      case 'referral':
        return meta?.type === 'referrer' ? 'Referral bonus (referred someone)' : 'Referral bonus (signed up)';
      case 'redemption':
        return `Redeemed: ${meta?.reward_name || 'Reward'}`;
      default:
        return 'Points activity';
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !displayName.trim()) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh the page to get updated profile data
      window.location.reload();
      toast({
        title: 'Profile updated',
        description: 'Your display name has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyReferralCode = () => {
    if (userProfile?.referral_code) {
      navigator.clipboard.writeText(userProfile.referral_code);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard.',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'moderator':
        return <Award className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Please sign in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email || ''} disabled />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                />
              </div>

              <Button 
                onClick={handleUpdateProfile} 
                disabled={isUpdating || !displayName.trim()}
                className="w-full"
              >
                {isUpdating ? 'Updating...' : 'Update Profile'}
              </Button>
            </CardContent>
          </Card>

          {/* Points & Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Points</span>
                <Badge variant="secondary" className="text-lg px-3 py-1" data-testid="total-points">
                  {totalPoints.toLocaleString()}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-medium">Account Role</span>
                {roleLoading ? (
                  <Badge variant="outline">Loading...</Badge>
                 ) : (
                   <Badge variant={getRoleBadgeVariant(userRole || 'user')} className="flex items-center gap-1">
                     {getRoleIcon(userRole || 'user')}
                     {userRole || 'user'}
                   </Badge>
                 )}
               </div>

               {userRole === 'admin' && (
                 <>
                   <Separator />
                   <div className="flex items-center justify-between">
                     <span className="font-medium">Admin Resources</span>
                     <Link to="/admin/help">
                       <Button variant="outline" size="sm" className="flex items-center gap-1">
                         <HelpCircle className="h-4 w-4" />
                         Admin Guide
                       </Button>
                     </Link>
                   </div>
                 </>
               )}
             </CardContent>
           </Card>

          {/* Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle>Referral Program</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Your Referral Code</Label>
                <div className="flex gap-2">
                  <Input 
                    value={userProfile?.referral_code || ''} 
                    readOnly 
                    className="font-mono"
                    data-testid="referral-code"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyReferralCode}
                    disabled={!userProfile?.referral_code}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Share your referral code to earn 200 points when someone signs up using it. 
                They'll also get 200 points!
              </p>
            </CardContent>
          </Card>

          {/* Points History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Points History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 w-3/4 bg-muted rounded mb-1 animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                      </div>
                      <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : pointsHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No points history yet</p>
                  <p className="text-xs mt-2">Upload receipts or refer friends to start earning points!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {pointsHistory.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {getSourceIcon(entry.source)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {getSourceLabel(entry.source, entry.meta)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleDateString('tr-TR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge 
                        variant={entry.delta > 0 ? 'default' : 'destructive'}
                        className="font-mono"
                      >
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </Badge>
                    </div>
                  ))}
                  {pointsHistory.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground pt-2">
                      Showing latest 10 entries of {pointsHistory.length} total
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;