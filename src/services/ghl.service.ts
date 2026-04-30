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

// Resolve country to English name
export function resolveCountryEnglish(country: string | null | undefined): string {
  if (!country) return "";
  const entry = COUNTRIES.find((c) => c.en === country || c.ar === country || c.code === country);
  return entry ? entry.en : country;
}

// Resolve city to English name
export function resolveCityEnglish(city: string | null | undefined, country: string | null | undefined): string {
  if (!city) return "";
  const countryEntry = COUNTRIES.find((c) => c.en === country || c.ar === country || c.code === country);
  if (!countryEntry) return city;
  const cityEntry = countryEntry.cities.find((c) => c.en === city || c.ar === city);
  return cityEntry ? cityEntry.en : city;
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

  // Build a SPARSE payload — include only fields the caller actually
  // populated. Sending empty strings, null booleans, "[]" for courses, or
  // "not purchased" sentinels for non-purchase events used to fill the
  // CRM with noise (e.g. ticket events arriving with empty purchase
  // fields, purchase events arriving with empty ticket fields). The
  // CRM workflow filters by event-type fields anyway, so omitting
  // irrelevant ones makes each event self-describing.
  //
  // ALWAYS included (identity + analytics): email, full_name, phone,
  //   country (ISO-2), city, source.
  // ONLY-IF-SET (purchase): courseName, amount, currency, orderStatus,
  //   totalPurchased, courses.
  // ONLY-IF-SET (support ticket): ticket_subject, ticket_message,
  //   ticket_category.
  // ONLY-IF-SET (signup survey): has_motorcycle, considering_purchase.
  // Profile fields (dateOfBirth, gender) are sent via the dedicated
  //   profile webhook (sendGHLProfileData) — don't duplicate them here.
  const payload: Record<string, unknown> = {
    email: (rest.email || "").trim(),
    full_name: (rest.full_name || "").trim(),
    phone: (rest.phone || "").trim(),
    country: toCountryCode(rest.country) || "",
    city: (rest.city || "").trim(),
    source: getVisitSource(),
  };

  // Purchase fields — only when this is a purchase event.
  if (rest.courseName) payload.courseName = rest.courseName;
  if (rest.amount) payload.amount = rest.amount;
  if (rest.currency) payload.currency = rest.currency;
  if (rest.orderStatus) payload.orderStatus = rest.orderStatus;
  if (rest.totalPurchased != null && rest.totalPurchased > 0) {
    payload.totalPurchased = rest.totalPurchased;
  }
  if (rest.courses && rest.courses !== "[]") payload.courses = rest.courses;

  // Support-ticket fields.
  if (rest.ticket_subject) payload.ticket_subject = rest.ticket_subject;
  if (rest.ticket_message) payload.ticket_message = rest.ticket_message;
  if (rest.ticket_category) payload.ticket_category = rest.ticket_category;

  // Signup-survey answers — bool/null tri-state, send only when user answered.
  if (rest.has_motorcycle != null) payload.has_motorcycle = rest.has_motorcycle;
  if (rest.considering_purchase != null) {
    payload.considering_purchase = rest.considering_purchase;
  }

  try {
    // Theory-course purchase webhook (and other form events that include
    // courseName + orderStatus). Same UUID as the server-side fallbacks in
    // supabase/functions/ghl-form-webhook + supabase/functions/tap-webhook,
    // so failures on either path land in the same GHL workflow.
    const res = await fetch(
      "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/9a3cf7c3-0405-4667-ad02-e9c89073feb4",
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

// ─── Profile-only webhook ────────────────────────────────────────────────────
// Dedicated webhook for user identity events (signup + profile updates).
// One URL, multiple event types — disambiguated by the `event_type` field
// so GHL workflows can branch (welcome email for `signup`, change-detection
// for `profile_update`, high-intent funnel for `course_page`, etc.).

const GHL_PROFILE_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/d5e018c9-941d-4425-a382-6f90569dd61b";

/**
 * Allowed values for the `event_type` field in the profile webhook payload.
 *
 * - "signup"          — new account from the regular Sign Up form
 * - "course_page"     — new account from the free-preview-ended prompt on
 *                       a course page (higher purchase intent)
 * - "guest_signup"    — new account auto-created during checkout for guests
 * - "profile_update"  — existing user edited their profile fields
 */
export type ProfileEventType = "signup" | "course_page" | "guest_signup" | "profile_update";

export interface ProfileWebhookData {
  /** Required for routing. Defaults to "profile_update" when omitted. */
  event_type?: ProfileEventType;
  user_id?: string | null;
  email?: string | null;
  /** Full name string — gets split into firstname/lastname before sending. */
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  rider_nickname?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  postal_code?: string | null;
  avatar_url?: string | null;
}

function splitNameForWebhook(fullName: string): { firstname: string; lastname: string } {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstname: parts[0] || "",
    lastname: parts.slice(1).join(" ") || "",
  };
}

export async function sendGHLProfileData(data: ProfileWebhookData): Promise<boolean> {
  const country = data.country ?? "";
  const city = data.city ?? "";
  const nationality = data.nationality ?? "";
  const { firstname, lastname } = splitNameForWebhook(data.full_name ?? "");

  // Always-included fields: event_type (for GHL routing) + user_id + email.
  // Everything else is sparse — omitted when empty so the CRM inbox doesn't
  // get noise (signup events that haven't filled DOB yet, profile updates
  // that didn't touch postal_code, etc.).
  const payload: Record<string, unknown> = {
    event_type: data.event_type || "profile_update",
    user_id: data.user_id ?? "",
    email: (data.email ?? "").trim(),
  };

  if (firstname) payload.firstname = firstname;
  if (lastname) payload.lastname = lastname;
  if (data.date_of_birth) payload.date_of_birth = data.date_of_birth;
  if (data.gender) payload.gender = data.gender;
  if (nationality) {
    payload.nationality = resolveCountryEnglish(nationality);
    payload.nationality_code = toCountryCode(nationality);
  }
  if (data.rider_nickname) payload.rider_nickname = data.rider_nickname;
  if (data.phone) payload.phone = data.phone;
  if (country) {
    payload.country = resolveCountryEnglish(country);
    payload.country_code = toCountryCode(country);
  }
  if (city) payload.city = resolveCityEnglish(city, country);
  if (data.postal_code) payload.postal_code = data.postal_code;
  if (data.avatar_url) payload.avatar_url = data.avatar_url;

  try {
    const res = await fetch(GHL_PROFILE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn(`GHL profile webhook returned ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error("GHL profile webhook failed:", err);
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
