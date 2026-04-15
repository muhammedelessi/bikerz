import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole, UserProfile, AuthContextType } from '@/types/auth';
import { ADMIN_ROLES } from '@/types/auth';
import {
  fetchUserData,
  signUpUser,
  signInUser,
  signOutUser,
  getSession,
  onAuthStateChange,
} from '@/services/auth.service';
import { clearGuestPreviewStorage } from '@/lib/guestPreview';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const OAUTH_VIEWPORT_RESET_KEY = 'oauth_viewport_reset_pending';

function redirectAfterOAuth() {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  const isOAuthRedirect = hash.includes('access_token') || search.includes('code=');

  if (!isOAuthRedirect) return;

  try {
    sessionStorage.setItem(OAUTH_VIEWPORT_RESET_KEY, '1');
  } catch {
    // sessionStorage may be unavailable in some WebKit contexts
  }

  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');

  window.scrollTo(0, 0);
  window.location.replace('/');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const loadUserData = useCallback(async (userId: string) => {
    const { profile: fetchedProfile, roles: fetchedRoles } = await fetchUserData(userId);
    return { fetchedProfile, fetchedRoles };
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const existingSession = await getSession();

        if (!mounted) return;

        if (existingSession?.user) {
          setSession(existingSession);
          setUser(existingSession.user);

          redirectAfterOAuth();

          const { fetchedProfile, fetchedRoles } = await loadUserData(existingSession.user.id);

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

    const { data: { subscription } } = onAuthStateChange(
      async (_event: any, newSession: any) => {
        if (_event === 'SIGNED_IN') {
          redirectAfterOAuth();
        }

        if (!mounted || !initialized) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            const { fetchedProfile, fetchedRoles } = await loadUserData(newSession.user.id);
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
  }, [loadUserData, initialized]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    return signUpUser(email, password, fullName);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error, data } = await signInUser(email, password);

    if (!error && data.user) {
      const { fetchedProfile, fetchedRoles } = await loadUserData(data.user.id);
      setProfile(fetchedProfile);
      setRoles(fetchedRoles);
      setUser(data.user);
      setSession(data.session);
    }

    return { error };
  }, [loadUserData]);

  const signOut = useCallback(async () => {
    await signOutUser();
    clearGuestPreviewStorage();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((checkRoles: AppRole[]) => checkRoles.some(role => roles.includes(role)), [roles]);

  const roleChecks = useMemo(() => {
    const isSuperAdmin = roles.includes('super_admin');
    const isDeveloper = roles.includes('developer');
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
      isDeveloper,
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
  }), [user, session, profile, roles, isLoading, signUp, signIn, signOut, hasRole, hasAnyRole, roleChecks]);

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
