import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '../hooks/use-toast';

interface UserProfile {
  id: string;
  display_name: string;
  points: number;
  role: 'user' | 'admin' | 'brand';
  referral_code: string;
  // Add computed property for backward compatibility
  name?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string, referralCode?: string) => Promise<boolean>;
  logout: () => void;
  updatePoints: (points: number) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUser(null);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Temporary type assertion until Supabase types are updated
      const { data, error } = await (supabase as any)
        .from('users_profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        // Add name property for backward compatibility
        setUser({ ...data, name: data.display_name });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      toast({
        title: "Welcome back!",
        description: "Successfully logged in."
      });
      
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: error.message || "Invalid credentials.",
        variant: "destructive"
      });
      setIsLoading(false);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string, referralCode?: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: name,
            referral_code: referralCode
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "Account created!",
          description: "Welcome to Receipto! You've earned 100 welcome points."
        });
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Error",
        description: error.message || "Registration failed.",
        variant: "destructive"
      });
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updatePoints = async (newPoints: number) => {
    if (user) {
      try {
        // Temporary type assertion until Supabase types are updated
        const { error } = await (supabase as any).rpc('update_user_points', {
          user_id: user.id,
          new_points: newPoints
        });

        if (error) throw error;

        setUser({ ...user, points: newPoints });
      } catch (error) {
        console.error('Error updating points:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      login,
      register, 
      logout,
      updatePoints,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};