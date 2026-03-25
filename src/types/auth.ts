import type { User, Session } from '@supabase/supabase-js';

export type AppRole =
  | 'super_admin'
  | 'academy_admin'
  | 'instructor'
  | 'moderator'
  | 'finance'
  | 'support'
  | 'student';

export interface UserProfile {
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
  date_of_birth: string | null;
  gender: string | null;
}

export interface AuthContextType {
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
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAcademyAdmin: boolean;
  isInstructor: boolean;
  isModerator: boolean;
  isFinance: boolean;
  isSupport: boolean;
  isStudent: boolean;
  canAccessAdmin: boolean;
}

export const ADMIN_ROLES: AppRole[] = [
  'super_admin',
  'academy_admin',
  'instructor',
  'moderator',
  'finance',
  'support',
];
