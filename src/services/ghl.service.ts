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
  const fullName = rest.full_name || "";
  const { firstname: firstName, lastname: lastName } = splitNameForWebhook(fullName);
  const countryCode = toCountryCode(rest.country) || "";
  const countryEnglish = resolveCountryEnglish(rest.country) || "";
  const cityEnglish = resolveCityEnglish(rest.city, rest.country) || "";

  // Send the same data under EVERY common field-name convention. GHL's
  // workflow auto-mapping looks for specific keys depending on how the
  // user wired their "Add/Update Contact" action — sending camelCase
  // (their Contact API standard), snake_case, lowercase-no-separator
  // and the original `full_name` covers every workflow shape we've
  // seen in the wild. Why they all matter:
  //   • Auto-mapping in newer GHL workflows expects camelCase
  //     (firstName, lastName, dateOfBirth, postalCode, address1).
  //   • Older workflows / custom field maps use snake_case.
  //   • Some templates the user might have copy-pasted use the bare
  //     lowercase `firstname` / `lastname`.
  // Duplicating doesn't bloat the request meaningfully (~200 extra
  // bytes) and is the difference between "contact created with empty
  // fields" and "contact created fully populated".
  const payload: Record<string, unknown> = {
    // ── Name ──
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    firstname: firstName,
    lastname: lastName,
    name: fullName,
    full_name: fullName,
    fullName: fullName,

    // ── Contact ──
    email: rest.email || "",
    phone: rest.phone || "",

    // ── Address ──
    address1: rest.address || "",
    address: rest.address || "",
    city: cityEnglish || rest.city || "",
    country: countryEnglish || rest.country || "",
    countryCode,
    country_code: countryCode,

    // ── Personal ──
    dateOfBirth: rest.dateOfBirth || "",
    date_of_birth: rest.dateOfBirth || "",
    gender: rest.gender || "",

    // ── Order / context ──
    courseName: rest.courseName || "",
    amount: rest.amount || "",
    currency: rest.currency || "",
    orderStatus: rest.orderStatus || "not purchased",
    courses: rest.courses || "[]",
    totalPurchased: rest.totalPurchased ?? 0,
    source: getVisitSource(),

    // ── Support ticket fields ──
    ticket_subject: rest.ticket_subject || "",
    ticket_message: rest.ticket_message || "",
    ticket_category: rest.ticket_category || "",
    has_motorcycle: rest.has_motorcycle ?? null,
    considering_purchase: rest.considering_purchase ?? null,
  };

  try {
    const res = await fetch(
      "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/0c004a12-e140-49df-8fcf-b62b101c4e8c",
      {
        method: "POST",
        // charset=utf-8 is the explicit signal — fetch sends UTF-8 bytes
        // by default, and the header tells GHL's parser to decode as UTF-8
        // instead of guessing (which is what produces the "???" mojibake).
        headers: { "Content-Type": "application/json; charset=utf-8" },
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
// Dedicated webhook for ALL user-data events. A single GHL workflow listens
// here and routes by the `event_type` discriminator into four branches:
//
//   signup         — generic new account (top-bar / hero CTA)
//   course_page    — ⭐ HIGH-INTENT signup: user clicked "Create account"
//                    after the free preview ended on a course page
//   guest_signup   — guest checkout finalised an account during paying
//   profile_update — existing user edited their profile fields
//
// Payload shapes per event type are documented in ProfileWebhookEvent
// below; the GHL router branches on `event_type` and pulls the relevant
// fields per branch (so it doesn't need to handle absent fields).

const GHL_PROFILE_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/ddAvdgekc94cWL9NBHK1/webhook-trigger/d5e018c9-941d-4425-a382-6f90569dd61b";

export type ProfileWebhookEvent =
  | "signup"
  | "course_page"
  | "guest_signup"
  | "profile_update";

export interface ProfileWebhookData {
  /** Required: routes the payload to the right GHL workflow branch. */
  event_type: ProfileWebhookEvent;
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
  const eventType = data.event_type;
  const country = data.country ?? "";
  const city = data.city ?? "";
  const nationality = data.nationality ?? "";
  const fullName = data.full_name ?? "";
  const { firstname, lastname } = splitNameForWebhook(fullName);

  // ── Fields shared by ALL four event types ─────────────────────────
  // We deliberately DO NOT send the `country` name (e.g. "Saudi Arabia",
  // "Palestine"). GHL's "Add/Update Contact" action validates the country
  // value against its built-in country list and SILENTLY DROPS the entire
  // contact when the value isn't recognised. We confirmed this empirically:
  //
  //   country: "Palestine"             → contact NOT created
  //   country: "Palestinian Territory" → contact NOT created
  //   country: "State of Palestine"    → contact NOT created
  //   country: ""  + country_code: PS  → contact created ✓
  //
  // So we send the ISO 2-letter `country_code` only. GHL maps it to its
  // internal country list. The workflow can derive the display name from
  // the code via a {{custom_value.country_label}} mapping if needed —
  // safer than us guessing which strings GHL accepts.
  const baseFields = {
    event_type: eventType,
    user_id: data.user_id ?? "",
    email: data.email ?? "",
    firstname,
    lastname,
    phone: data.phone ?? "",
    country_code: toCountryCode(country) || "",
    city: resolveCityEnglish(city, country) || "",
  } as const;

  // Build the per-event payload exactly per the agreed spec — no extra
  // keys, no field-name duplicates. Each branch returns a payload shape
  // the GHL workflow's router can pull from cleanly.
  let payload: Record<string, unknown>;

  switch (eventType) {
    case "guest_signup":
      // Same as signup + postal_code (collected during guest checkout).
      payload = {
        ...baseFields,
        postal_code: data.postal_code ?? "",
      };
      break;

    case "profile_update":
      // Full profile dump — every personal field the user can edit.
      // `nationality` (the localized name) is dropped for the same reason
      // as `country` above — GHL silently rejects the entire contact when
      // the nationality value isn't in their built-in list. We send only
      // the ISO code so the workflow can map it internally.
      payload = {
        ...baseFields,
        date_of_birth: data.date_of_birth ?? "",
        gender: data.gender ?? "",
        nationality_code: toCountryCode(nationality) || "",
        rider_nickname: data.rider_nickname ?? "",
        postal_code: data.postal_code ?? "",
        avatar_url: data.avatar_url ?? "",
      };
      break;

    case "signup":
    case "course_page":
    default:
      // Minimal new-account fields — name + contact + location only.
      payload = { ...baseFields };
      break;
  }

  try {
    const res = await fetch(GHL_PROFILE_WEBHOOK_URL, {
      method: "POST",
      // charset=utf-8 makes the encoding explicit — fetch already sends
      // UTF-8 bytes when JSON.stringify() builds the body, but the header
      // tells GHL's parser to decode as UTF-8 instead of guessing.
      headers: { "Content-Type": "application/json; charset=utf-8" },
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
