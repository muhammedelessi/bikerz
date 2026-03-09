import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useGHLSync() {
  const { user, session } = useAuth();
  const syncingRef = useRef(false);

  const invoke = useCallback(async (action: string, data: Record<string, unknown>) => {
    if (!user || !session?.access_token) return;

    try {
      const { data: result, error } = await supabase.functions.invoke('ghl-sync', {
        body: { action, data },
      });

      if (error) {
        console.error('GHL sync error:', error);
      }
      return result;
    } catch (err) {
      console.error('GHL sync failed:', err);
    }
  }, [user, session]);

  const syncContact = useCallback(async (profileData: {
    full_name?: string | null;
    phone?: string | null;
    city?: string | null;
    country?: string | null;
    postal_code?: string | null;
    experience_level?: string | null;
    bike_brand?: string | null;
    bike_model?: string | null;
  }) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await invoke('create_or_update_contact', profileData as Record<string, unknown>);
    } finally {
      syncingRef.current = false;
    }
  }, [invoke]);

  const trackPayment = useCallback(async (paymentData: {
    amount: number;
    currency?: string;
    course_id?: string;
    course_title?: string;
    status?: string;
  }) => {
    await invoke('track_payment', paymentData as Record<string, unknown>);
  }, [invoke]);

  const addNote = useCallback(async (note: string, tags?: string[]) => {
    await invoke('add_note', { note, tags });
  }, [invoke]);

  return { syncContact, trackPayment, addNote };
}