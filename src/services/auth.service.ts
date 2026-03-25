import { supabase } from '@/integrations/supabase/client';
import type { AppRole, UserProfile } from '@/types/auth';

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data || null;
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  return data?.map((r) => r.role as AppRole) || [];
}

export async function fetchUserData(userId: string): Promise<{ profile: UserProfile | null; roles: AppRole[] }> {
  try {
    const [profile, roles] = await Promise.all([
      fetchUserProfile(userId),
      fetchUserRoles(userId),
    ]);
    return { profile, roles };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { profile: null, roles: [] };
  }
}

export async function signUpUser(email: string, password: string, fullName: string) {
  const { error } = await (supabase.auth as any).signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
      data: { full_name: fullName },
    },
  });
  return { error: error as Error | null };
}

export async function signInUser(email: string, password: string) {
  const { error, data } = await (supabase.auth as any).signInWithPassword({
    email,
    password,
  });
  return { error: error as Error | null, data };
}

export async function signOutUser() {
  await (supabase.auth as any).signOut();
}

export async function getSession() {
  const { data: { session } } = await (supabase.auth as any).getSession();
  return session;
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
  return (supabase.auth as any).onAuthStateChange(callback);
}
