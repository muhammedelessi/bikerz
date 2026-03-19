import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function getVisitSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) return utmSource.toLowerCase();

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
  address?: string;
  courseName?: string;
  amount?: string;
  orderStatus?: string;
  courses?: string;
  totalPurchased?: number;
  dateOfBirth?: string;
  gender?: string;
  isRTL?: boolean;
  silent?: boolean;
}

export function useGHLFormWebhook() {
  const sendFormData = useCallback(async (data: FormWebhookData) => {
    const { isRTL, silent, ...rest } = data;
    const payload = {
      ...rest,
      source: getVisitSource(),
    };

    try {
      const { error } = await supabase.functions.invoke('ghl-form-webhook', {
        body: payload,
      });

      if (error) throw error;

      if (!silent) {
        toast.success(isRTL ? '✅ تم إرسال البيانات بنجاح' : '✅ Data submitted successfully');
      }
      return true;
    } catch (err) {
      console.error('GHL form webhook failed:', err);
      if (!silent) {
        toast.error(isRTL ? '❌ فشل في إرسال البيانات' : '❌ Failed to submit data');
      }
      return false;
    }
  }, []);

  /**
   * Upsert a course status, then send the full courses array to GHL.
   */
  const sendCourseStatus = useCallback(async (
    userId: string,
    courseId: string,
    courseName: string,
    orderStatus: string,
    extraData: Omit<FormWebhookData, 'courses' | 'totalPurchased' | 'orderStatus' | 'courseName'>
  ) => {
    try {
      // Upsert and get full array
      const { data, error: rpcError } = await supabase.rpc('upsert_course_status', {
        p_user_id: userId,
        p_course_id: courseId,
        p_course_name: courseName,
        p_order_status: orderStatus,
      });

      if (rpcError) {
        console.error('upsert_course_status error:', rpcError);
      }

      const row = Array.isArray(data) ? data[0] : data;
      const coursesJson = row?.courses_json || '[]';
      const totalPurchased = row?.total_purchased ?? 0;

      return sendFormData({
        ...extraData,
        courseName,
        orderStatus,
        courses: coursesJson,
        totalPurchased,
      });
    } catch (err) {
      console.error('sendCourseStatus failed:', err);
      return false;
    }
  }, [sendFormData]);

  /**
   * Send webhook with current courses array (no upsert). Used at signup.
   */
  const sendWithCourses = useCallback(async (
    userId: string,
    extraData: FormWebhookData
  ) => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_user_course_statuses', {
        p_user_id: userId,
      });

      if (rpcError) {
        console.error('get_user_course_statuses error:', rpcError);
      }

      const row = Array.isArray(data) ? data[0] : data;
      const coursesJson = row?.courses_json || '[]';
      const totalPurchased = row?.total_purchased ?? 0;

      return sendFormData({
        ...extraData,
        courses: coursesJson,
        totalPurchased,
      });
    } catch (err) {
      console.error('sendWithCourses failed:', err);
      return sendFormData(extraData);
    }
  }, [sendFormData]);

  return { sendFormData, sendCourseStatus, sendWithCourses };
}
