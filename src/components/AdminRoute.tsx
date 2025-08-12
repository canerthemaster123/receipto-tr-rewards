import React from 'react';
import { useAuth } from './AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/enhanced-button';
import { Shield, UserCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user } = useAuth();
  const { userRole, isLoading } = useUserRole();
  const { toast } = useToast();

  // Dev-only admin bootstrap for @e2e.local emails
  const handleMakeAdmin = async () => {
    if (!user?.email?.endsWith('@e2e.local')) {
      toast({
        title: "Unauthorized",
        description: "Admin bootstrap only available for test accounts",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc('qa_make_self_admin');
      
      if (error) throw error;
      
      if (data?.ok) {
        toast({
          title: "Success",
          description: "Admin role granted. Please refresh the page.",
        });
        // Refresh page to update role
        window.location.reload();
      } else {
        throw new Error(data?.error || 'Failed to grant admin role');
      }
    } catch (error) {
      console.error('Error making self admin:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to grant admin role",
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto mt-12 space-y-6">
        <Card className="shadow-card border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This area is restricted to administrators only. You currently have {userRole || 'user'} permissions.
            </p>
            
            {/* Dev-only admin bootstrap */}
            {user.email?.endsWith('@e2e.local') && (
              <div className="border-t pt-4 mt-6">
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Development Mode</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Test account detected. You can grant yourself admin access for testing.
                  </p>
                </div>
                <Button onClick={handleMakeAdmin} variant="outline">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Make Me Admin (Dev Only)
                </Button>
              </div>
            )}
            
            <div className="border-t pt-4 mt-6">
              <h3 className="font-semibold mb-2">How to Access Admin</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>1. Contact your system administrator to request admin access</p>
                <p>2. They can grant you admin permissions through the user management panel</p>
                <p>3. Once granted, refresh this page to access admin features</p>
              </div>
              
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  For more information, see the <a href="/admin/help" className="text-primary hover:underline">Admin Guide</a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;