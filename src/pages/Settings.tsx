import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/enhanced-button';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import AdminRoute from '@/components/AdminRoute';
import { Settings, AlertTriangle, Save } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { settings, loading, updateSetting, getSetting } = useAppSettings();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleDuplicateToggle = async (checked: boolean) => {
    try {
      setIsUpdating(true);
      await updateSetting('dup_enforcement_enabled', checked);
      
      toast({
        title: "Setting Updated",
        description: `Duplicate enforcement is now ${checked ? 'enabled' : 'disabled'}`,
        variant: checked ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAutoApproveToggle = async (checked: boolean) => {
    try {
      setIsUpdating(true);
      await updateSetting('auto_approve_receipts', checked);
      
      toast({
        title: "Setting Updated",
        description: `Auto-approval is now ${checked ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin mx-auto mb-4 rounded-full border-2 border-primary border-t-transparent"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminRoute>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            App Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure global application settings and feature flags
          </p>
        </div>

        {/* Receipt Processing Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Receipt Processing
            </CardTitle>
            <CardDescription>
              Configure how receipts are processed and validated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="duplicate-enforcement" className="text-base">
                  Duplicate Receipt Enforcement
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, blocks duplicate receipt submissions
                </p>
              </div>
              <Switch
                id="duplicate-enforcement"
                checked={getSetting('dup_enforcement_enabled', true)}
                onCheckedChange={handleDuplicateToggle}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-approve" className="text-base">
                  Auto-approve Receipts
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, automatically approves receipts after OCR processing
                </p>
              </div>
              <Switch
                id="auto-approve"
                checked={getSetting('auto_approve_receipts', false)}
                onCheckedChange={handleAutoApproveToggle}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Warning Card */}
        <Card className="shadow-card border-warning/20 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Important Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Changes to these settings affect all users immediately. Auto-approval should only be enabled in trusted environments. 
              Disabling duplicate enforcement may lead to fraudulent submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default SettingsPage;