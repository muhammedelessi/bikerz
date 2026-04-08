import { supabase } from "@/integrations/supabase/client";
import type { FormWebhookData } from "@/types/ghl";
import { COUNTRIES } from "@/data/countryCityData";

function getVisitSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    if (utmSource) return utmSource.toLowerCase();

    const stored = sessionStorage.getItem("utm_source");
    if (stored) return stored.toLowerCase();
  } catch {
    // ignore
  }
  return "direct";
}

// Convert country name (en/ar) or code to 2-letter code for GHL
export function toCountryCode(country: string | null | undefined): string {
  if (!country) return "";
  const entry = COUNTRIES.find((c) => c.en === country || c.ar === country || c.code === country);
  return entry ? entry.code : country;
}

// Persist UTM on first load
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source");
    if (utm) sessionStorage.setItem("utm_source", utm);
  } catch {
    // ignore
  }
}

export async function sendGHLFormData(data: FormWebhookData): Promise<boolean> {
  const { isRTL, silent, ...rest } = data;
  const payload: Record<string, unknown> = {
    full_name: rest.full_name || "",
    email: rest.email || "",
    phone: rest.phone || "",
    country: toCountryCode(rest.country) || "",
    city: rest.city || "",
    address: rest.address || "",
    courseName: rest.courseName || "",
    amount: rest.amount || "",
    orderStatus: rest.orderStatus || "not purchased",
    courses: rest.courses || "[]",
    totalPurchased: rest.totalPurchased ?? 0,
    dateOfBirth: rest.dateOfBirth || "",
    gender: rest.gender || "",
    source: getVisitSource(),
  };

  try {
    const res = await fetch(
      "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/0c004a12-e140-49df-8fcf-b62b101c4e8c",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) console.warn(`GHL webhook returned ${res.status}`);
    return true;
  } catch (err) {
    console.error("GHL form webhook failed:", err);
    return false;
  }
}

export async function upsertCourseStatus(userId: string, courseId: string, courseName: string, orderStatus: string) {
  const { data, error } = await supabase.rpc("upsert_course_status", {
    p_user_id: userId,
    p_course_id: courseId,
    p_course_name: courseName,
    p_order_status: orderStatus,
  });

  if (error) {
    console.error("upsert_course_status error:", error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    coursesJson: row?.courses_json || "[]",
    totalPurchased: row?.total_purchased ?? 0,
  };
}

export async function getUserCourseStatuses(userId: string) {
  const { data, error } = await supabase.rpc("get_user_course_statuses", {
    p_user_id: userId,
  });

  if (error) {
    console.error("get_user_course_statuses error:", error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    coursesJson: row?.courses_json || "[]",
    totalPurchased: row?.total_purchased ?? 0,
  };
}
