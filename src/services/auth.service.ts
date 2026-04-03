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
  try {
    const response = await supabase.functions.invoke('signup-user', {
      body: { email, password, full_name: fullName },
    });

    if (response.error) {
      return { error: new Error(response.error.message || 'Signup failed') };
    }

    const result = response.data as any;
    if (result?.error) {
      return { error: new Error(result.error) };
    }

    // Sign in after successful creation
    const { error: signInError, data: signInData } = await (supabase.auth as any).signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return { error: signInError as Error };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err as Error };
  }
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
