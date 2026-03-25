import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  createGuestAccount,
  sendPasswordReset,
  updateProfile,
} from '@/services/supabase.service';

export function useGuestSignup() {
  const { isRTL } = useLanguage();
  const [guestSigningUp, setGuestSigningUp] = useState(false);

  const generatePassword = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => chars[b % chars.length]).join('');
  }, []);

  const handleGuestSignup = useCallback(async (
    email: string,
    fullName: string,
    profileData: {
      phone: string;
      city: string;
      country: string;
      postalCode: string;
    },
  ): Promise<string | null> => {
    setGuestSigningUp(true);
    try {
      const password = generatePassword();
      const { data, error } = await createGuestAccount(email.trim(), fullName.trim(), password);

      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
          toast.error(isRTL
            ? 'هذا البريد مسجل بالفعل. يرجى تسجيل الدخول أولاً.'
            : 'This email is already registered. Please log in first.');
          return null;
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Account creation failed');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      await updateProfile(data.user.id, {
        full_name: fullName.trim(),
        phone: profileData.phone,
        city: profileData.city,
        country: profileData.country,
        postal_code: profileData.postalCode || null,
        profile_complete: true,
      });

      sendPasswordReset(email.trim());

      return data.user.id;
    } catch (err: any) {
      console.error('Guest signup error:', err);
      toast.error(err.message || (isRTL ? 'فشل إنشاء الحساب' : 'Failed to create account'));
      return null;
    } finally {
      setGuestSigningUp(false);
    }
  }, [generatePassword, isRTL]);

  return { guestSigningUp, handleGuestSignup };
}
