import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Updated role types matching the database enum
type AppRole = 
  | 'super_admin'
  | 'academy_admin'
  | 'instructor'
  | 'moderator'
  | 'finance'
  | 'support'
  | 'student';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  phone_verified: boolean;
  profile_complete: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  // Convenience role checks
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAcademyAdmin: boolean;
  isInstructor: boolean;
  isModerator: boolean;
  isFinance: boolean;
  isSupport: boolean;
  isStudent: boolean;
  // Can access admin panel
  canAccessAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin roles that can access the admin panel
const ADMIN_ROLES: AppRole[] = ['super_admin', 'academy_admin', 'instructor', 'moderator', 'finance', 'support'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchUserData = useCallback(async (userId: string): Promise<{ profile: UserProfile | null; roles: AppRole[] }> => {
    try {
      // Fetch profile and roles in parallel
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
      ]);

      const fetchedProfile = profileResult.data || null;
      const fetchedRoles = rolesResult.data?.map((r) => r.role as AppRole) || [];

      return { profile: fetchedProfile, roles: fetchedRoles };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, roles: [] };
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        // Get existing session first
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (existingSession?.user) {
          setSession(existingSession);
          setUser(existingSession.user);
          
          const { profile: fetchedProfile, roles: fetchedRoles } = await fetchUserData(existingSession.user.id);
          
          if (!mounted) return;
          
          setProfile(fetchedProfile);
          setRoles(fetchedRoles);
        }
        
        setIsLoading(false);
        setInitialized(true);
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted || !initialized) return;
        
        // Handle auth state changes after initialization
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid race conditions with Supabase's internal state
          setTimeout(async () => {
            if (!mounted) return;
            const { profile: fetchedProfile, roles: fetchedRoles } = await fetchUserData(newSession.user.id);
            if (mounted) {
              setProfile(fetchedProfile);
              setRoles(fetchedRoles);
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, initialized]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // After successful sign in, fetch user data immediately
    if (!error && data.user) {
      const { profile: fetchedProfile, roles: fetchedRoles } = await fetchUserData(data.user.id);
      setProfile(fetchedProfile);
      setRoles(fetchedRoles);
      setUser(data.user);
      setSession(data.session);
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((checkRoles: AppRole[]) => checkRoles.some(role => roles.includes(role)), [roles]);

  // Memoize role checks to ensure they update when roles change
  const roleChecks = useMemo(() => {
    const isSuperAdmin = roles.includes('super_admin');
    const isAcademyAdmin = roles.includes('academy_admin');
    const isInstructor = roles.includes('instructor');
    const isModerator = roles.includes('moderator');
    const isFinance = roles.includes('finance');
    const isSupport = roles.includes('support');
    const isStudent = roles.includes('student');
    const isAdmin = ADMIN_ROLES.some(role => roles.includes(role));
    const canAccessAdmin = isAdmin;
    
    return {
      isSuperAdmin,
      isAcademyAdmin,
      isInstructor,
      isModerator,
      isFinance,
      isSupport,
      isStudent,
      isAdmin,
      canAccessAdmin,
    };
  }, [roles]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    roles,
    isLoading,
    signUp,
    signIn,
    signOut,
    hasRole,
    hasAnyRole,
    ...roleChecks,
  }), [user, session, profile, roles, isLoading, hasRole, hasAnyRole, roleChecks]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
