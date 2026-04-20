import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget: records that an authenticated user opened the checkout / payment step
 * (e.g. after clicking Subscribe now). Never throws to callers.
 */
export function recordCheckoutPaymentPageVisit(params: {
  userId: string;
  courseId: string | null;
  source: string;
}): void {
  void (async () => {
    try {
      const { error } = await supabase.from("checkout_payment_page_visits").insert({
        user_id: params.userId,
        course_id: params.courseId,
        source: params.source,
      });
      if (error) {
        console.warn("[checkoutVisitAnalytics]", error.message);
      }
    } catch (e) {
      console.warn("[checkoutVisitAnalytics]", e);
    }
  })();
}
