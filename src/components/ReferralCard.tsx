import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/enhanced-button';
import { Input } from './ui/input';
import { Users, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/use-toast';

const ReferralCard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyReferralCode = async () => {
    if (user?.referral_code) {
      try {
        await navigator.clipboard.writeText(user.referral_code);
        setCopied(true);
        toast({
          title: "Copied!",
          description: "Referral code copied to clipboard"
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    }
  };

  if (!user) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t('inviteFriends')}
        </CardTitle>
        <CardDescription>
          {t('shareCode')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('yourReferralCode')}</label>
          <div className="flex gap-2">
            <Input 
              value={user.referral_code}
              readOnly
              className="font-mono"
            />
            <Button
              onClick={copyReferralCode}
              variant="outline"
              size="sm"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : t('copyCode')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralCard;