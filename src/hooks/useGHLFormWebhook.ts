import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getVisitSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) return utmSource.toLowerCase();

    // Check stored UTM from landing
    const stored = sessionStorage.getItem('utm_source');
    if (stored) return stored.toLowerCase();
  } catch {
    // ignore
  }
  return 'direct';
}

// Persist UTM on first load
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    if (utm) sessionStorage.setItem('utm_source', utm);
  } catch {
    // ignore
  }
}

interface FormWebhookData {
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  courseName?: string;
  orderStatus?: string;
  isRTL?: boolean;
}

export function useGHLFormWebhook() {
  const sendFormData = useCallback(async (data: FormWebhookData) => {
    const { isRTL, ...rest } = data;
    const payload = {
      ...rest,
      source: getVisitSource(),
    };

    try {
      const { error } = await supabase.functions.invoke('ghl-form-webhook', {
        body: payload,
      });

      if (error) throw error;

      toast.success(isRTL ? '✅ تم إرسال البيانات بنجاح' : '✅ Data submitted successfully');
      return true;
    } catch (err) {
      console.error('GHL form webhook failed:', err);
      toast.error(isRTL ? '❌ فشل في إرسال البيانات' : '❌ Failed to submit data');
      return false;
    }
  }, []);

  return { sendFormData };
}
