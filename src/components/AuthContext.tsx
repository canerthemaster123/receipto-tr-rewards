import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  display_name: string | null;
  total_points: number;
  referral_code: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updatePoints: (points: number) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ensure Google user profile exists (since trigger might fail for Google OAuth)
  const ensureGoogleUserProfile = async (user: any) => {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('users_profile')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Create profile manually for Google users
        const { error } = await supabase
          .from('users_profile')
          .upsert({
            id: user.id,
            display_name: user.user_metadata?.full_name || user.email.split('@')[0],
            referral_code: user.id.substring(0, 8),
            total_points: 0
          });

        if (error) {
          console.error('Error creating Google user profile:', error);
        }
      }
    } catch (error) {
      console.error('Error ensuring Google user profile:', error);
    }
  };

  // Fetch user profile data
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Handle Google OAuth callback - ensure profile exists
          if (event === 'SIGNED_IN' && session.user.app_metadata.provider === 'google') {
            // For Google auth, ensure profile exists and handle referral if needed
            setTimeout(async () => {
              await ensureGoogleUserProfile(session.user);
              fetchUserProfile(session.user.id);
            }, 0);
          } else {
            // Regular profile fetch for other auth methods
            setTimeout(() => {
              fetchUserProfile(session.user.id);
            }, 0);
          }
        } else {
          setUserProfile(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setIsLoading(false);
        // Provide more user-friendly error messages
        let friendlyMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          friendlyMessage = 'Email and password don\'t match. Please check your credentials.';
        }
        return { success: false, error: friendlyMessage };
      }

      return { success: true };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const register = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: name,
          }
        }
      });

      if (error) {
        setIsLoading(false);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const logout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  const updatePoints = async (newPoints: number): Promise<void> => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ total_points: newPoints })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating points:', error);
        return;
      }

      // Update local state
      setUserProfile(prev => prev ? { ...prev, total_points: newPoints } : null);
    } catch (error) {
      console.error('Error updating points:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userProfile,
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