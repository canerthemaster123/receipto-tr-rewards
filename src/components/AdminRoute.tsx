import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../hooks/useUserRole';
import { Card, CardContent } from './ui/card';
import { Loader2, Shield, AlertCircle } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'moderator';
}

const AdminRoute: React.FC<AdminRouteProps> = ({ 
  children, 
  requiredRole = 'admin' 
}) => {
  const { userRole, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verifying permissions...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAccess = 
    (requiredRole === 'admin' && userRole === 'admin') ||
    (requiredRole === 'moderator' && (userRole === 'admin' || userRole === 'moderator'));

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-8 text-center">
            <div className="p-4 bg-destructive/10 rounded-full w-fit mx-auto mb-4">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have permission to access this area.
            </p>
            <div className="flex items-center gap-2 justify-center text-sm text-warning">
              <AlertCircle className="h-4 w-4" />
              Required role: {requiredRole}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;