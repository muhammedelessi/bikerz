import { supabase } from "@/integrations/supabase/client";
import type { AppRole, UserProfile } from "@/types/auth";

export async function fetchUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export async function fetchUserRoles(userId: string): Promise<AppRole[]> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.map((r) => r.role as AppRole) || [];
}

export async function fetchUserData(
  userId: string,
): Promise<{ profile: UserProfile | null; roles: AppRole[] }> {
  try {
    const [profile, roles] = await Promise.all([
      fetchUserProfile(userId),
      fetchUserRoles(userId),
    ]);
    return { profile, roles };
  } catch (error) {
    console.error("Error fetching user data:", error);
    return { profile: null, roles: [] };
  }
}

export async function signUpUser(
  email: string,
  password: string,
  fullName: string,
) {
  try {
    // Use Supabase Auth directly — bypass Edge Function
    // Ensure password meets Supabase minimum requirements (letters + numbers)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const finalPassword = !hasLetter
      ? password + "Aa"
      : !hasNumber
      ? password + "1"
      : password;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: finalPassword,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (!error) {
      // Sign in with the same modified password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: finalPassword,
      });
      if (signInError) return { error: signInError };
      return { error: null };
    }

    if (error) {
      return { error };
    }

    // Sign in immediately after signup
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      return { error: signInError };
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

export function onAuthStateChange(
  callback: (event: any, session: any) => void,
) {
  return (supabase.auth as any).onAuthStateChange(callback);
}
