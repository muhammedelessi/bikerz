import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CheckoutPaymentPageVisitRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  source: string;
  created_at: string;
  profile: {
    full_name: string | null;
    phone: string | null;
    rider_nickname: string | null;
    city: string | null;
    country: string | null;
  } | null;
  course: { title: string; title_ar: string | null } | null;
};

/** Interpret `YYYY-MM-DD` as the viewer's local calendar day (matches `<input type="date">`). */
function dayRangeLocal(isoDate: string): { start: string; end: string } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useAdminCheckoutPaymentVisits(selectedDay: string) {
  return useQuery({
    queryKey: ["admin-checkout-payment-visits", selectedDay],
    queryFn: async () => {
      const { start, end } = dayRangeLocal(selectedDay);
      const { data: rows, error } = await supabase
        .from("checkout_payment_page_visits")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = rows || [];
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const courseIds = [...new Set(list.map((r) => r.course_id).filter(Boolean))] as string[];

      let profileMap = new Map<
        string,
        {
          full_name: string | null;
          phone: string | null;
          rider_nickname: string | null;
          city: string | null;
          country: string | null;
        }
      >();
      if (userIds.length) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone, rider_nickname, city, country")
          .in("user_id", userIds);
        if (pErr) throw pErr;
        profileMap = new Map((profs || []).map((p) => [p.user_id, p]));
      }

      let courseMap = new Map<string, { title: string; title_ar: string | null }>();
      if (courseIds.length) {
        const { data: courses, error: cErr } = await supabase
          .from("courses")
          .select("id, title, title_ar")
          .in("id", courseIds);
        if (cErr) throw cErr;
        courseMap = new Map((courses || []).map((c) => [c.id, c]));
      }

      return list.map((r) => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
        course: r.course_id ? courseMap.get(r.course_id) ?? null : null,
      })) as CheckoutPaymentPageVisitRow[];
    },
    enabled: !!selectedDay && /^\d{4}-\d{2}-\d{2}$/.test(selectedDay),
  });
}
