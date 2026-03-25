import { useCallback } from 'react';
import { toast } from 'sonner';
import type { FormWebhookData } from '@/types/ghl';
import {
  sendGHLFormData,
  upsertCourseStatus,
  getUserCourseStatuses,
} from '@/services/ghl.service';

export function useGHLFormWebhook() {
  const sendFormData = useCallback(async (data: FormWebhookData) => {
    const { isRTL, silent } = data;

    try {
      const success = await sendGHLFormData(data);
      if (!success) throw new Error('Webhook failed');

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

  const sendCourseStatus = useCallback(async (
    userId: string,
    courseId: string,
    courseName: string,
    orderStatus: string,
    extraData: Omit<FormWebhookData, 'courses' | 'totalPurchased' | 'orderStatus' | 'courseName'>
  ) => {
    try {
      const { coursesJson, totalPurchased } = await upsertCourseStatus(
        userId,
        courseId,
        courseName,
        orderStatus,
      );

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

  const sendWithCourses = useCallback(async (
    userId: string,
    extraData: FormWebhookData
  ) => {
    try {
      const { coursesJson, totalPurchased } = await getUserCourseStatuses(userId);

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
