import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { COUNTRIES, getCityDisplayLabel } from "@/data/countryCityData";
import { PHONE_COUNTRIES } from "@/data/phoneCountryCodes";
import { toast } from "sonner";
import { cn, formatDobLong } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BikeGarage } from "@/components/ui/profile/BikeGarage";
import type { BikeEntry } from "@/hooks/useUserProfile";
import {
  CountryCityPicker,
  DateOfBirthPicker,
  GenderPicker,
  NameFields,
  NationalityPicker,
  PhoneField,
} from "@/components/ui/fields";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  Award,
  Bike as BikeIcon,
  Languages,
  ClipboardCheck,
  Plus,
  Trash2,
  Zap,
  Shield,
} from "lucide-react";

/** Must match `CountryCityPicker` internal value for “Other”. */
const COUNTRY_CITY_OTHER = "__other__";

/** Split stored E.164-style phone into prefix key + local digits (same logic as profile editor). */
function parseFullPhoneToFormParts(fullPhone: string | null | undefined): { prefixKey: string; localDigits: string } {
  if (!fullPhone?.trim()) return { prefixKey: "+966_SA", localDigits: "" };
  const trimmed = fullPhone.trim();
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const c of sorted) {
    if (trimmed.startsWith(c.prefix)) {
      return {
        prefixKey: `${c.prefix}_${c.code}`,
        localDigits: trimmed.slice(c.prefix.length).replace(/\D/g, ""),
      };
    }
  }
  return { prefixKey: "+966_SA", localDigits: trimmed.replace(/^\+/, "").replace(/\D/g, "") };
}

/** Same composition as `Signup` / `RiderIdentity` when saving `profiles.phone`. */
function buildFullPhone(phonePrefix: string, phoneLocal: string): string {
  const phonePrefixValue = phonePrefix.split("_")[0];
  const phoneDigits = phoneLocal.replace(/[^0-9]/g, "");
  const phoneWithoutLeadingZero = phoneDigits.startsWith("0") ? phoneDigits.slice(1) : phoneDigits;
  return `${phonePrefixValue}${phoneWithoutLeadingZero}`;
}

function isPhoneLocalDigitsValid(localDigits: string): boolean {
  const d = localDigits.replace(/[^0-9]/g, "");
  return d.length >= 7 && d.length <= 15;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LICENSES = [
  { id: "A1", labelEn: "A1 — Light Bike", labelAr: "A1 — دراجة خفيفة", desc: "≤ 125cc" },
  { id: "A2", labelEn: "A2 — Medium", labelAr: "A2 — متوسطة", desc: "≤ 35kW" },
  { id: "A", labelEn: "A — Full License", labelAr: "A — رخصة كاملة", desc: "All bikes" },
  { id: "Pro", labelEn: "Pro Instructor", labelAr: "مدرب محترف", desc: "Certified" },
];

const LANGUAGE_OPTIONS = [
  { code: "ar", nameEn: "Arabic", nameAr: "العربية" },
  { code: "en", nameEn: "English", nameAr: "الإنجليزية" },
  { code: "fr", nameEn: "French", nameAr: "الفرنسية" },
  { code: "es", nameEn: "Spanish", nameAr: "الإسبانية" },
  { code: "de", nameEn: "German", nameAr: "الألمانية" },
  { code: "ru", nameEn: "Russian", nameAr: "الروسية" },
  { code: "hi", nameEn: "Hindi", nameAr: "الهندية" },
  { code: "ur", nameEn: "Urdu", nameAr: "الأوردية" },
  { code: "tl", nameEn: "Filipino", nameAr: "الفلبينية" },
];
const PROFICIENCIES = [
  { id: "native", labelEn: "Native", labelAr: "لغة أم" },
  { id: "fluent", labelEn: "Fluent", labelAr: "بطلاقة" },
  { id: "conversational", labelEn: "Conversational", labelAr: "محادثة" },
  { id: "basic", labelEn: "Basic", labelAr: "أساسي" },
];

interface LangSelection {
  code: string;
  level: string;
}

interface FormState {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryCode: string;
  city: string;
  customCountry: string;
  customCity: string;
  licenseType: string;
  yearsExperience: number;
  summary: string;
  bikeEntries: BikeEntry[];
  languages: LangSelection[];
  serviceLines: string[];
  termsAccepted: boolean;
  gender: string;
  nationality: string;
  /** Country code row value for `PhoneField`, e.g. `+966_SA`. */
  phonePrefix: string;
  /** Local phone digits only (no country prefix). */
  phone: string;
}

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  countryCode: "",
  city: "",
  customCountry: "",
  customCity: "",
  licenseType: "",
  yearsExperience: 0,
  summary: "",
  bikeEntries: [],
  languages: [],
  serviceLines: [""],
  termsAccepted: false,
  gender: "",
  nationality: "",
  phonePrefix: "+966_SA",
  phone: "",
};

const STEPS = [
  { id: 1, Icon: User, titleEn: "Personal", titleAr: "البيانات الشخصية" },
  { id: 2, Icon: Award, titleEn: "Experience", titleAr: "الخبرة" },
  { id: 3, Icon: BikeIcon, titleEn: "Bikes", titleAr: "الدراجات" },
  { id: 4, Icon: Languages, titleEn: "Skills", titleAr: "المهارات" },
  { id: 5, Icon: ClipboardCheck, titleEn: "Review", titleAr: "المراجعة" },
];

function normalizeDraft(raw: Record<string, unknown>): Partial<FormState> {
  const p = { ...raw } as Partial<FormState> & {
    fullNameAr?: string;
    fullNameEn?: string;
    country?: string;
    bioAr?: string;
    bioEn?: string;
    services?: string[];
  };
  if (!p.firstName && !p.lastName && p.fullNameAr) {
    const parts = String(p.fullNameAr).trim().split(/\s+/);
    p.firstName = parts[0] ?? "";
    p.lastName = parts.slice(1).join(" ") ?? "";
  }
  if (!p.countryCode && p.country) {
    const byEn = COUNTRIES.find((c) => c.en === p.country);
    const byAr = COUNTRIES.find((c) => c.ar === p.country);
    p.countryCode = byEn?.code ?? byAr?.code ?? "";
  }
  if (p.summary === undefined || p.summary === "") {
    const ar = typeof p.bioAr === "string" ? p.bioAr : "";
    const en = typeof p.bioEn === "string" ? p.bioEn : "";
    p.summary = ar || en || "";
  }
  if ((!p.serviceLines || p.serviceLines.length === 0) && Array.isArray(p.services)) {
    const preset = new Set(["beginner", "advanced", "track", "tour", "offroad", "city", "safety", "group"]);
    const fromPreset = (p.services as string[]).filter((s) => preset.has(s));
    if (fromPreset.length === (p.services as string[]).length) {
      p.serviceLines = [""];
    } else {
      p.serviceLines = (p.services as string[]).length ? [...(p.services as string[])] : [""];
    }
  }
  if (!Array.isArray(p.serviceLines) || p.serviceLines.length === 0) {
    p.serviceLines = [""];
  }
  const rawPhone = typeof p.phone === "string" ? p.phone.trim() : "";
  if (rawPhone.startsWith("+")) {
    const parsed = parseFullPhoneToFormParts(rawPhone);
    const existingPrefix = typeof p.phonePrefix === "string" && p.phonePrefix.includes("_") ? p.phonePrefix : null;
    p.phonePrefix = existingPrefix ?? parsed.prefixKey;
    p.phone = parsed.localDigits;
  } else if (typeof p.phone === "string") {
    p.phone = p.phone.replace(/\D/g, "");
  }
  if (typeof p.phonePrefix !== "string" || !p.phonePrefix.includes("_")) {
    p.phonePrefix = "+966_SA";
  }
  return p;
}

function resolveLocationStrings(
  form: FormState,
  useArabic: boolean,
): { country: string; city: string } {
  if (form.countryCode === COUNTRY_CITY_OTHER) {
    return {
      country: form.customCountry.trim(),
      city: form.customCity.trim(),
    };
  }
  const c = COUNTRIES.find((x) => x.code === form.countryCode);
  const country = c ? (useArabic ? c.ar : c.en) : "";
  const city =
    form.city === COUNTRY_CITY_OTHER
      ? form.customCity.trim()
      : getCityDisplayLabel(form.countryCode, form.city, useArabic);
  return { country, city };
}

// ─── Component ────────────────────────────────────────────────────────────────

const ApplyTrainer: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user, isInstructor } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const { trainer: linkedTrainerRow, isLoading: linkedTrainerLoading } = useCurrentTrainer();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [hydrated, setHydrated] = useState(false);
  const draftKey = user ? `apply-trainer-draft-${user.id}` : "";

  // ── Load existing application status ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("trainer_applications")
        .select("status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.status) setExistingStatus(data.status);
    })();
  }, [user]);

  // ── Hydrate from draft, then profile ──────────────────────────────────────
  // Wait for profile so the form is auto-filled with the user's saved details
  // (name, phone, country/city, DOB, gender, nationality, bikes, …).
  useEffect(() => {
    if (hydrated || isLoading || !user || !profile) return;
    let next: FormState = { ...EMPTY_FORM };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        next = { ...EMPTY_FORM, ...normalizeDraft(parsed) };
      }
    } catch {
      /* ignore */
    }
    if (profile) {
      const fullName = (profile.full_name ?? "").trim();
      if (!next.firstName && !next.lastName && fullName) {
        const parts = fullName.split(/\s+/);
        next.firstName = parts[0] ?? "";
        next.lastName = parts.slice(1).join(" ") || parts[0] || "";
      }
      if (!next.countryCode && profile.country) {
        const byEn = COUNTRIES.find((c) => c.en === profile.country);
        const byAr = COUNTRIES.find((c) => c.ar === profile.country);
        const byCode = COUNTRIES.find((c) => c.code === profile.country);
        next.countryCode = byCode?.code ?? byEn?.code ?? byAr?.code ?? "";
      }
      if (!next.city && profile.city) {
        const c = COUNTRIES.find((x) => x.code === next.countryCode);
        const match = c?.cities.find((ci) => ci.en === profile.city || ci.ar === profile.city);
        next.city = match?.en ?? profile.city;
      }
      if (!next.dateOfBirth && profile.date_of_birth) next.dateOfBirth = profile.date_of_birth;
      if (!next.gender.trim() && profile.gender?.trim()) next.gender = profile.gender.trim();
      if (!next.nationality.trim() && profile.nationality?.trim()) next.nationality = profile.nationality.trim();
      if (!next.phone.replace(/\D/g, "") && profile.phone?.trim()) {
        const parsed = parseFullPhoneToFormParts(profile.phone);
        next.phone = parsed.localDigits;
        next.phonePrefix = parsed.prefixKey;
      }
      if (!next.yearsExperience && profile.riding_experience_years)
        next.yearsExperience = profile.riding_experience_years;
      if (next.bikeEntries.length === 0 && Array.isArray(profile.bike_entries)) next.bikeEntries = profile.bike_entries;
    }
    setForm(next);
    setHydrated(true);
  }, [profile, isLoading, user, hydrated, draftKey]);

  // ── Persist draft on change ───────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [form, draftKey, hydrated]);

  if (user && isInstructor) {
    if (linkedTrainerLoading) {
      return (
        <div className="max-w-2xl mx-auto p-6" dir={isRTL ? "rtl" : "ltr"} aria-busy="true">
          <div className="rounded-2xl border border-border p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      );
    }
    if (linkedTrainerRow) {
      return <Navigate to="/dashboard/trainer" replace />;
    }
  }

  // ── Step validation ───────────────────────────────────────────────────────
  const isStepValid = (s: number): boolean => {
    if (s === 1) {
      const loc = resolveLocationStrings(form, false);
      if (!form.firstName.trim() || !form.lastName.trim() || !form.dateOfBirth) return false;
      if (!form.gender.trim() || !form.nationality.trim()) return false;
      if (!isPhoneLocalDigitsValid(form.phone)) return false;
      if (form.countryCode === COUNTRY_CITY_OTHER) {
        if (!form.customCountry.trim()) return false;
      } else if (!form.countryCode) return false;
      if (form.city === COUNTRY_CITY_OTHER && !form.customCity.trim()) return false;
      return !!(loc.country && loc.city);
    }
    if (s === 2) {
      return !!(form.licenseType && form.yearsExperience > 0 && form.summary.trim().length >= 30);
    }
    if (s === 3) {
      return form.bikeEntries.length > 0 && form.bikeEntries.every((b) => b.photos.length > 0);
    }
    if (s === 4) {
      const servicesOk = form.serviceLines.some((line) => line.trim().length >= 2);
      return form.languages.length > 0 && servicesOk;
    }
    if (s === 5) {
      return form.termsAccepted;
    }
    return true;
  };

  const goNext = () => {
    if (step === 1) {
      const digitsOnly = form.phone.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 7) {
        setPhoneError(isRTL ? "رقم الهاتف قصير جداً (7 أرقام على الأقل)" : "Phone number too short (min 7 digits)");
        toast.error(isRTL ? "أكمل البيانات المطلوبة" : "Please complete required fields");
        return;
      }
      if (digitsOnly.length > 15) {
        setPhoneError(isRTL ? "رقم الهاتف طويل جداً (15 رقم كحد أقصى)" : "Phone number too long (max 15 digits)");
        toast.error(isRTL ? "أكمل البيانات المطلوبة" : "Please complete required fields");
        return;
      }
      setPhoneError(null);
    }
    if (!isStepValid(step)) {
      toast.error(isRTL ? "أكمل البيانات المطلوبة" : "Please complete required fields");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
  };
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async () => {
    if (!user) return;
    if (!isStepValid(5)) {
      toast.error(isRTL ? "وافق على الشروط أولاً" : "Please accept the terms");
      return;
    }
    setSubmitting(true);
    try {
      const displayName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const locEn = resolveLocationStrings(form, false);
      const locAr = resolveLocationStrings(form, true);
      const summary = form.summary.trim();
      const services = form.serviceLines.map((s) => s.trim()).filter((s) => s.length >= 2);
      const bike_type = form.bikeEntries.map((b) => b.type_name).filter(Boolean).join(", ");
      const langSpecialties = form.languages.map((l) => `${l.code}:${l.level}`);
      const genderVal = (form.gender.trim() || profile?.gender?.trim() || "").trim() || null;
      const nationalityVal = (form.nationality.trim() || profile?.nationality?.trim() || "").trim() || null;
      const fullPhone = buildFullPhone(form.phonePrefix, form.phone);
      const localDigits = form.phone.replace(/[^0-9]/g, "");
      const phoneVal =
        localDigits.length >= 7 && localDigits.length <= 15 ? fullPhone : (profile?.phone?.trim() || null);
      const firstBikePhoto =
        form.bikeEntries.map((b) => b.photos?.[0]).find((u) => typeof u === "string" && u.trim().length > 0) ?? null;
      const photoUrl = profile?.avatar_url?.trim() || firstBikePhoto || null;
      const languagesJson = form.languages.map((l) => ({ language: l.code, level: l.level }));
      const payload = {
        user_id: user.id,
        status: "pending",
        name_ar: displayName,
        name_en: displayName,
        full_name: displayName,
        photo_url: photoUrl,
        email: user.email ?? null,
        phone: phoneVal,
        date_of_birth: form.dateOfBirth,
        country: locEn.country || locAr.country,
        city: locEn.city || locAr.city,
        years_of_experience: form.yearsExperience,
        experience_years: form.yearsExperience,
        bio: summary,
        bio_ar: summary,
        bio_en: summary,
        bike_type,
        bike_entries: form.bikeEntries as unknown as Json,
        languages: languagesJson as unknown as Json,
        services,
        specialties: langSpecialties,
        gender: genderVal,
        nationality: nationalityVal,
      };
      const { error } = await supabase.from("trainer_applications").insert(payload);
      if (error) throw error;

      const profileUpdate: Record<string, unknown> = {
        full_name: displayName,
        date_of_birth: form.dateOfBirth,
        country: locEn.country || null,
        city: locEn.city || null,
        phone: phoneVal,
        gender: genderVal,
        nationality: nationalityVal,
        riding_experience_years: form.yearsExperience,
        bike_entries: form.bikeEntries as unknown as Json,
      };
      const { error: profileErr } = await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);
      if (profileErr) {
        console.error(profileErr);
        toast.error(
          isRTL
            ? "تم إرسال الطلب لكن تعذّر تحديث الملف الشخصي. حدّث بياناتك من الملف لاحقًا."
            : "Application sent, but your profile could not be synced. Please update your profile.",
        );
      }
      toast.success(isRTL ? "تم إرسال طلبك! سنراجعه خلال 48 ساعة." : "Application sent! We'll review within 48h.");
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      navigate("/profile");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? (isRTL ? "فشل الإرسال" : "Submit failed"));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Existing application screen ──────────────────────────────────────────
  if (existingStatus === "pending") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 p-8 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
          <h2 className="text-lg font-bold">{isRTL ? "طلبك قيد المراجعة" : "Your application is under review"}</h2>
          <p className="text-sm text-muted-foreground">
            {isRTL ? "سنراجع طلبك ونعود إليك خلال 48 ساعة" : "We'll review your application within 48 hours"}
          </p>
          <Button variant="outline" onClick={() => navigate("/profile")}>
            {isRTL ? "العودة للملف الشخصي" : "Back to Profile"}
          </Button>
        </div>
      </div>
    );
  }
  if (existingStatus === "approved") {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-2xl border-2 border-green-500/30 bg-green-500/5 p-8 text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-green-500/15 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-bold">{isRTL ? "تمت الموافقة على طلبك!" : "Your application is approved!"}</h2>
          <Button onClick={() => navigate("/dashboard/trainer")}>
            {isRTL ? "اذهب إلى لوحة المدرب" : "Go to Trainer Dashboard"}
          </Button>
        </div>
      </div>
    );
  }

  const totalSteps = STEPS.length;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  // ─── Render wizard ────────────────────────────────────────────────────────
  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="w-full max-w-3xl min-w-0 mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 sm:pb-32"
    >
      {/* Header */}
      <div className="mb-4 sm:mb-6 space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
          {isRTL ? "تقديم كمدرب" : "Apply as Trainer"}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isRTL ? "اكمل الخطوات الخمس وسنراجع طلبك" : "Complete the 5 steps and we'll review your application"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-4 sm:mb-6 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 sm:py-3 -mx-3 sm:-mx-6 px-3 sm:px-6">
        <div className="relative h-1 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="absolute inset-y-0 start-0 bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-1">
          {STEPS.map(({ id, Icon, titleEn, titleAr }) => {
            const done = step > id;
            const active = step === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id < step) setStep(id);
                }}
                disabled={id > step}
                className={cn(
                  "flex flex-col items-center gap-1 flex-1 group",
                  id > step && "opacity-50 cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                    done && "bg-primary border-primary text-primary-foreground",
                    active && "bg-primary/10 border-primary text-primary scale-110",
                    !done && !active && "bg-muted border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold text-center leading-tight hidden sm:block",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {isRTL ? titleAr : titleEn}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6 md:p-8 min-h-[min(400px,70dvh)] sm:min-h-[420px]">
        {/* ════════ STEP 1: Personal ════════ */}
        {step === 1 && (
          <div className="space-y-4 sm:space-y-6">
            <SectionHeader
              titleAr="البيانات الشخصية"
              titleEn="Personal Information"
              descAr="تأكد من صحة بياناتك"
              descEn="Make sure your details are accurate"
            />

            <NameFields
              firstName={form.firstName}
              lastName={form.lastName}
              onFirstNameChange={(firstName) => setForm({ ...form, firstName })}
              onLastNameChange={(lastName) => setForm({ ...form, lastName })}
              required
              inputDir={isRTL ? "rtl" : "ltr"}
            />

            <DateOfBirthPicker
              value={form.dateOfBirth || null}
              onChange={(date) => setForm({ ...form, dateOfBirth: date ?? "" })}
              required
            />

            <GenderPicker
              value={form.gender}
              onChange={(gender) => setForm({ ...form, gender })}
              required
            />

            <NationalityPicker
              value={form.nationality}
              onChange={(nationality) => setForm({ ...form, nationality })}
              required
            />

            <PhoneField
              phonePrefix={form.phonePrefix}
              phoneNumber={form.phone}
              onPrefixChange={(val) => {
                setForm({ ...form, phonePrefix: val });
                setPhoneError(null);
              }}
              onNumberChange={(val) => {
                setForm({ ...form, phone: val });
                setPhoneError(null);
              }}
              error={phoneError}
              required
            />

            <div className="min-w-0">
              <CountryCityPicker
                country={form.countryCode}
                city={form.city}
                onCountryChange={(countryCode) =>
                  setForm({ ...form, countryCode, city: "", customCity: "" })
                }
                onCityChange={(city) => setForm({ ...form, city })}
                customCountry={form.customCountry}
                onCustomCountryChange={(customCountry) => setForm({ ...form, customCountry })}
                customCity={form.customCity}
                onCustomCityChange={(customCity) => setForm({ ...form, customCity })}
                required
                layout="column"
              />
            </div>
          </div>
        )}

        {/* ════════ STEP 2: Experience ════════ */}
        {step === 2 && (
          <div className="space-y-4 sm:space-y-6">
            <SectionHeader
              titleAr="خبرتك"
              titleEn="Your Experience"
              descAr="نوع الرخصة وسنوات الخبرة والملخص"
              descEn="License, years of experience, and summary"
            />

            <FormField label={isRTL ? "نوع الرخصة *" : "License Type *"}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {LICENSES.map((lic) => (
                  <button
                    key={lic.id}
                    type="button"
                    onClick={() => setForm({ ...form, licenseType: lic.id })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 sm:p-3 rounded-xl border-2 transition-all min-h-[88px] sm:min-h-0",
                      form.licenseType === lic.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <span className="text-base font-bold">{lic.id}</span>
                    <span className="text-[10px] text-center leading-tight">
                      {isRTL ? lic.labelAr.split("—")[1]?.trim() : lic.labelEn.split("—")[1]?.trim()}
                    </span>
                    <span className="text-[9px] opacity-60">{lic.desc}</span>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField
              label={isRTL ? "سنوات الخبرة (كم عدد السنوات؟) *" : "Years of experience *"}
              hint={isRTL ? "أدخل عدد السنوات كرقم." : "Enter your years of experience as a number."}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={80}
                className="max-w-full sm:max-w-[200px]"
                value={form.yearsExperience > 0 ? String(form.yearsExperience) : ""}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setForm({ ...form, yearsExperience: Number.isFinite(n) ? Math.min(80, Math.max(0, n)) : 0 });
                }}
                placeholder={isRTL ? "مثال: 5" : "e.g. 5"}
                dir="ltr"
              />
            </FormField>

            <FormField
              label={isRTL ? `ملخص تعريفي * (${form.summary.length}/500)` : `Professional summary * (${form.summary.length}/500)`}
              hint={
                isRTL
                  ? "ملخص واحد عن خبرتك وأسلوبك (30 حرفًا على الأقل)."
                  : "One summary about your experience and teaching style (min. 30 characters)."
              }
            >
              <Textarea
                rows={5}
                maxLength={500}
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                className="min-h-[120px] sm:min-h-[140px] resize-y"
                dir={isRTL ? "rtl" : "ltr"}
              />
            </FormField>
          </div>
        )}

        {/* ════════ STEP 3: Bikes ════════ */}
        {step === 3 && (
          <div className="space-y-4 sm:space-y-6 min-w-0">
            <SectionHeader
              titleAr="دراجاتك"
              titleEn="Your Bikes"
              descAr="أضف الدراجات التي تجيد التدريب عليها — صورة الدراجة إجبارية"
              descEn="Add bikes you can teach on — bike photo is required"
            />
            <BikeGarage
              entries={form.bikeEntries}
              onChange={(entries) => setForm({ ...form, bikeEntries: entries })}
              userId={user?.id}
              storageFolder="trainer-applications"
            />
            {form.bikeEntries.length > 0 && form.bikeEntries.some((b) => b.photos.length === 0) && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {isRTL
                  ? "بعض دراجاتك بدون صور — أضف صورة لكل دراجة قبل المتابعة"
                  : "Some bikes have no photos — add at least one photo per bike"}
              </div>
            )}
          </div>
        )}

        {/* ════════ STEP 4: Skills ════════ */}
        {step === 4 && (
          <div className="space-y-5 sm:space-y-6">
            <SectionHeader
              titleAr="مهاراتك"
              titleEn="Your Skills"
              descAr="اللغات والخدمات التي تقدمها"
              descEn="Languages and services you offer"
            />

            {/* Languages */}
            <FormField label={isRTL ? "اللغات *" : "Languages *"}>
              <div className="space-y-2 sm:space-y-3">
                {form.languages.map((lang, i) => {
                  const opt = LANGUAGE_OPTIONS.find((o) => o.code === lang.code);
                  return (
                    <div
                      key={i}
                      dir={isRTL ? "rtl" : "ltr"}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border border-border bg-muted/10 min-w-0"
                    >
                      <span className="flex-1 text-sm font-medium min-w-0 break-words">
                        {opt ? (isRTL ? opt.nameAr : opt.nameEn) : lang.code}
                      </span>
                      <Select
                        value={lang.level}
                        onValueChange={(v) => {
                          const next = [...form.languages];
                          next[i] = { ...next[i], level: v };
                          setForm({ ...form, languages: next });
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-40 h-9 sm:h-8 text-xs" dir={isRTL ? "rtl" : "ltr"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir={isRTL ? "rtl" : "ltr"}>
                          {PROFICIENCIES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {isRTL ? p.labelAr : p.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 sm:h-8 sm:w-8 shrink-0 self-end sm:self-center text-muted-foreground hover:text-destructive"
                        onClick={() => setForm({ ...form, languages: form.languages.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}

                <Select
                  value=""
                  onValueChange={(code) => {
                    if (form.languages.some((l) => l.code === code)) return;
                    setForm({ ...form, languages: [...form.languages, { code, level: "fluent" }] });
                  }}
                >
                  <SelectTrigger className="border-dashed w-full min-h-10" dir={isRTL ? "rtl" : "ltr"}>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="w-4 h-4 shrink-0" />
                      {isRTL ? "إضافة لغة" : "Add language"}
                    </span>
                  </SelectTrigger>
                  <SelectContent dir={isRTL ? "rtl" : "ltr"}>
                    {LANGUAGE_OPTIONS.filter((o) => !form.languages.some((l) => l.code === o.code)).map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {isRTL ? o.nameAr : o.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>

            <FormField
              label={isRTL ? "الخدمات التي تقدمها *" : "Services you offer *"}
              hint={
                isRTL
                  ? "اكتب كل خدمة في حقل منفصل. يمكنك إضافة أكثر من خدمة."
                  : "Enter each service in its own field. Add as many as you need."
              }
            >
              <div className="space-y-2 sm:space-y-3">
                {form.serviceLines.map((line, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center min-w-0">
                    <Input
                      value={line}
                      onChange={(e) => {
                        const next = [...form.serviceLines];
                        next[i] = e.target.value;
                        setForm({ ...form, serviceLines: next });
                      }}
                      placeholder={isRTL ? "مثال: تدريب المبتدئين في المدينة" : "e.g. Beginner city training"}
                      className="flex-1 min-w-0"
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 sm:w-auto w-full"
                      disabled={form.serviceLines.length <= 1}
                      onClick={() =>
                        setForm({
                          ...form,
                          serviceLines: form.serviceLines.filter((_, j) => j !== i),
                        })
                      }
                    >
                      {isRTL ? "حذف" : "Remove"}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto gap-1.5"
                  onClick={() => setForm({ ...form, serviceLines: [...form.serviceLines, ""] })}
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? "إضافة خدمة" : "Add service"}
                </Button>
              </div>
            </FormField>
          </div>
        )}

        {/* ════════ STEP 5: Review ════════ */}
        {step === 5 && (
          <div className="space-y-4">
            <SectionHeader
              titleAr="مراجعة الطلب"
              titleEn="Review Your Application"
              descAr="تأكد من البيانات قبل الإرسال"
              descEn="Confirm your details before submitting"
            />

            <ReviewBlock title={isRTL ? "البيانات الشخصية" : "Personal"} onEdit={() => setStep(1)}>
              <ReviewRow
                label={isRTL ? "الاسم" : "Name"}
                value={`${form.firstName.trim()} ${form.lastName.trim()}`.trim()}
              />
              <ReviewRow
                label={isRTL ? "البريد الإلكتروني" : "Email"}
                value={user?.email ?? ""}
                dir="ltr"
              />
              <ReviewRow
                label={isRTL ? "رقم الجوال" : "Phone"}
                value={
                  isPhoneLocalDigitsValid(form.phone)
                    ? buildFullPhone(form.phonePrefix, form.phone)
                    : (profile?.phone ?? "").trim()
                }
                dir="ltr"
              />
              <ReviewRow
                label={isRTL ? "تاريخ الميلاد" : "Date of birth"}
                value={form.dateOfBirth ? formatDobLong(form.dateOfBirth, isRTL) : ""}
              />
              <ReviewRow
                label={isRTL ? "الجنس" : "Gender"}
                value={formatGenderLabel((form.gender || profile?.gender || "").trim(), isRTL)}
              />
              <ReviewRow
                label={isRTL ? "الجنسية" : "Nationality"}
                value={(() => {
                  const code = (form.nationality || profile?.nationality || "").trim();
                  if (!code) return "";
                  const nat = COUNTRIES.find((c) => c.code === code);
                  return nat ? nat[isRTL ? "ar" : "en"] : code;
                })()}
              />
              <ReviewRow
                label={isRTL ? "الموقع" : "Location"}
                value={(() => {
                  const loc = resolveLocationStrings(form, isRTL);
                  return [loc.city, loc.country].filter(Boolean).join(", ");
                })()}
              />
              {profile?.avatar_url?.trim() ? (
                <div className="pt-1 space-y-1">
                  <span className="text-muted-foreground text-xs">{isRTL ? "صورة الملف" : "Profile photo"}</span>
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover border border-border"
                  />
                </div>
              ) : null}
            </ReviewBlock>

            <ReviewBlock title={isRTL ? "الخبرة" : "Experience"} onEdit={() => setStep(2)}>
              <ReviewRow label={isRTL ? "الرخصة" : "License"} value={form.licenseType} />
              <ReviewRow
                label={isRTL ? "سنوات الخبرة" : "Years of experience"}
                value={`${form.yearsExperience} ${isRTL ? "سنة" : "years"}`}
              />
              <ReviewRow label={isRTL ? "التوضيح" : "Explanation"} value={form.summary} multiline />
            </ReviewBlock>

            <ReviewBlock title={isRTL ? "الدراجات" : "Bikes"} onEdit={() => setStep(3)}>
              <ReviewRow
                label={isRTL ? "العدد" : "Count"}
                value={`${form.bikeEntries.length} ${
                  isRTL
                    ? form.bikeEntries.length === 1
                      ? "دراجة"
                      : "دراجات"
                    : form.bikeEntries.length === 1
                      ? "bike"
                      : "bikes"
                }`}
              />
              {form.bikeEntries.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {form.bikeEntries.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border border-border/60 bg-background/80 overflow-hidden text-start"
                    >
                      <div className="aspect-square bg-muted/40 relative">
                        {b.photos[0] ? (
                          <img src={b.photos[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-1">
                            {isRTL ? "بدون صورة" : "No photo"}
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-medium p-1.5 leading-tight line-clamp-2">{b.type_name}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </ReviewBlock>

            <ReviewBlock title={isRTL ? "المهارات" : "Skills"} onEdit={() => setStep(4)}>
              <ReviewRow
                label={isRTL ? "اللغات" : "Languages"}
                value={form.languages
                  .map((l) => LANGUAGE_OPTIONS.find((o) => o.code === l.code)?.[isRTL ? "nameAr" : "nameEn"])
                  .filter(Boolean)
                  .join(", ")}
              />
              <ReviewRow
                label={isRTL ? "الخدمات" : "Services"}
                value={form.serviceLines
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join(isRTL ? " · " : " · ")}
                multiline
              />
            </ReviewBlock>

            {/* Terms */}
            <label className="flex items-start gap-3 p-4 rounded-xl border border-border bg-muted/10 cursor-pointer hover:bg-muted/20 transition-colors">
              <Checkbox
                checked={form.termsAccepted}
                onCheckedChange={(v) => setForm({ ...form, termsAccepted: !!v })}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground leading-relaxed">
                {isRTL
                  ? "أؤكد أن البيانات صحيحة وأوافق على شروط المنصة لمقدمي الخدمة"
                  : "I confirm the information is accurate and accept the platform's trainer terms"}
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="max-w-3xl w-full min-w-0 mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={step === 1 || submitting}
            className="gap-1.5 flex-1 sm:flex-none min-h-11 sm:min-h-10"
          >
            {isRTL ? <ArrowRight className="w-4 h-4 shrink-0" /> : <ArrowLeft className="w-4 h-4 shrink-0" />}
            <span className="truncate">{isRTL ? "السابق" : "Previous"}</span>
          </Button>

          <div className="text-xs text-muted-foreground order-last sm:order-none w-full sm:w-auto text-center sm:text-start py-1 sm:py-0">
            {step} / {totalSteps}
          </div>

          {step < totalSteps ? (
            <Button onClick={goNext} className="gap-1.5 flex-1 sm:flex-none min-h-11 sm:min-h-10">
              <span className="truncate">{isRTL ? "التالي" : "Next"}</span>
              {isRTL ? <ArrowLeft className="w-4 h-4 shrink-0" /> : <ArrowRight className="w-4 h-4 shrink-0" />}
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={submitting || !form.termsAccepted}
              className="gap-2 flex-1 sm:flex-none min-h-11 sm:min-h-10 sm:min-w-[160px]"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
              <span className="truncate">{isRTL ? "إرسال الطلب" : "Submit Application"}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Helper components ────────────────────────────────────────────────────────

const SectionHeader: React.FC<{ titleAr: string; titleEn: string; descAr: string; descEn: string }> = ({
  titleAr,
  titleEn,
  descAr,
  descEn,
}) => {
  const { isRTL } = useLanguage();
  return (
    <div className="border-b border-border/30 pb-3 mb-2">
      <h2 className="text-lg font-bold">{isRTL ? titleAr : titleEn}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{isRTL ? descAr : descEn}</p>
    </div>
  );
};

const FormField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold">{label}</Label>
    {children}
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const ReviewBlock: React.FC<{ title: string; onEdit: () => void; children: React.ReactNode }> = ({
  title,
  onEdit,
  children,
}) => (
  <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold">{title}</h3>
      <button onClick={onEdit} className="text-xs text-primary hover:underline">
        Edit
      </button>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

const ReviewRow: React.FC<{ label: string; value: string; multiline?: boolean; dir?: "ltr" | "rtl" }> = ({
  label,
  value,
  multiline,
  dir,
}) => (
  <div
    className={cn(
      "flex gap-3 text-xs",
      multiline ? "flex-col sm:flex-row sm:items-start sm:justify-between" : "items-center justify-between",
    )}
  >
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span
      className={cn(
        "text-foreground font-medium text-start sm:text-end min-w-0",
        multiline ? "whitespace-pre-wrap break-words" : "truncate",
      )}
      dir={dir}
    >
      {value || "—"}
    </span>
  </div>
);

export default ApplyTrainer;
