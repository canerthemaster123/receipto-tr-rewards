import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '../hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, User, Award, Loader2 } from 'lucide-react';

interface UserWithRole {
  id: string;
  display_name: string;
  total_points: number;
  current_role: 'admin' | 'moderator' | 'user';
}

interface UserRoleManagerProps {
  users: UserWithRole[];
  onUserRoleChange: () => void;
}

const UserRoleManager: React.FC<UserRoleManagerProps> = ({ users, onUserRoleChange }) => {
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    setUpdatingUsers(prev => new Set(prev).add(userId));

    try {
      // First, check if user has any role
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (existingRoles && existingRoles.length > 0) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      // Log admin action
      await supabase.rpc('log_admin_action', {
        _action: 'update_user_role',
        _table_name: 'user_roles',
        _record_id: userId,
        _old_values: { role: user.current_role },
        _new_values: { role: newRole }
      });

      toast({
        title: 'Success',
        description: `User role updated to ${newRole} successfully.`,
      });

      onUserRoleChange();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user role. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h3 className="font-semibold">{user.display_name || 'Unknown User'}</h3>
                <p className="text-sm text-muted-foreground">{user.total_points} points</p>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge variant={getRoleBadgeVariant(user.current_role)} className="flex items-center gap-1">
                  {getRoleIcon(user.current_role)}
                  {user.current_role}
                </Badge>
                
                <Select
                  value={user.current_role}
                  onValueChange={(value: 'admin' | 'moderator' | 'user') => handleRoleChange(user.id, value)}
                  disabled={updatingUsers.has(user.id)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                
                {updatingUsers.has(user.id) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default UserRoleManager;