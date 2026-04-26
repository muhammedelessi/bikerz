import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentTrainer } from "@/hooks/useCurrentTrainer";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES } from "@/data/countryCityData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { BikeGarage } from "@/components/ui/profile/BikeGarage";
import type { BikeEntry } from "@/hooks/useUserProfile";
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
  X,
  Trash2,
  Globe,
  Wrench,
  Mountain,
  Zap,
  Users,
  Compass,
  Map,
  Shield,
} from "lucide-react";

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

const SERVICES = [
  { id: "beginner", Icon: Shield, nameEn: "Beginner Training", nameAr: "تدريب المبتدئين" },
  { id: "advanced", Icon: Zap, nameEn: "Advanced Training", nameAr: "تدريب متقدم" },
  { id: "track", Icon: Wrench, nameEn: "Track Days", nameAr: "أيام الحلبة" },
  { id: "tour", Icon: Map, nameEn: "Tour Riding", nameAr: "رحلات" },
  { id: "offroad", Icon: Mountain, nameEn: "Off-Road", nameAr: "طرق وعرة" },
  { id: "city", Icon: Compass, nameEn: "City Riding", nameAr: "ركوب المدينة" },
  { id: "safety", Icon: Shield, nameEn: "Safety Courses", nameAr: "دورات السلامة" },
  { id: "group", Icon: Users, nameEn: "Group Classes", nameAr: "دروس جماعية" },
];

interface LangSelection {
  code: string;
  level: string;
}

interface FormState {
  fullNameEn: string;
  fullNameAr: string;
  dateOfBirth: string;
  country: string;
  city: string;
  licenseType: string;
  yearsExperience: number;
  bioEn: string;
  bioAr: string;
  bikeEntries: BikeEntry[];
  languages: LangSelection[];
  services: string[];
  termsAccepted: boolean;
}

const EMPTY_FORM: FormState = {
  fullNameEn: "",
  fullNameAr: "",
  dateOfBirth: "",
  country: "",
  city: "",
  licenseType: "",
  yearsExperience: 0,
  bioEn: "",
  bioAr: "",
  bikeEntries: [],
  languages: [],
  services: [],
  termsAccepted: false,
};

const STEPS = [
  { id: 1, Icon: User, titleEn: "Personal", titleAr: "البيانات الشخصية" },
  { id: 2, Icon: Award, titleEn: "Experience", titleAr: "الخبرة" },
  { id: 3, Icon: BikeIcon, titleEn: "Bikes", titleAr: "الدراجات" },
  { id: 4, Icon: Languages, titleEn: "Skills", titleAr: "المهارات" },
  { id: 5, Icon: ClipboardCheck, titleEn: "Review", titleAr: "المراجعة" },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ApplyTrainer: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user, isInstructor } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const { trainer: linkedTrainerRow, isLoading: linkedTrainerLoading } = useCurrentTrainer();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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
  useEffect(() => {
    if (hydrated || isLoading || !user) return;
    let next = { ...EMPTY_FORM };
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) next = { ...next, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    if (profile) {
      const fullName = profile.full_name ?? "";
      if (!next.fullNameEn && /^[\x00-\x7F]+$/.test(fullName)) next.fullNameEn = fullName;
      if (!next.fullNameAr && /[؀-ۿ]/.test(fullName)) next.fullNameAr = fullName;
      if (!next.country && profile.country) next.country = profile.country;
      if (!next.city && profile.city) next.city = profile.city;
      if (!next.dateOfBirth && profile.date_of_birth) next.dateOfBirth = profile.date_of_birth;
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

  // ── Cities for selected country ───────────────────────────────────────────
  const cities = useMemo(() => {
    const entry = COUNTRIES.find((c) => c.en === form.country || c.ar === form.country || c.code === form.country);
    return entry?.cities ?? [];
  }, [form.country]);

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
      return !!(form.fullNameEn.trim() && form.fullNameAr.trim() && form.dateOfBirth && form.country && form.city);
    }
    if (s === 2) {
      return !!(
        form.licenseType &&
        form.yearsExperience > 0 &&
        form.bioAr.trim().length >= 30 &&
        form.bioEn.trim().length >= 30
      );
    }
    if (s === 3) {
      return form.bikeEntries.length > 0 && form.bikeEntries.every((b) => b.photos.length > 0);
    }
    if (s === 4) {
      return form.languages.length > 0 && form.services.length > 0;
    }
    if (s === 5) {
      return form.termsAccepted;
    }
    return true;
  };

  const goNext = () => {
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
      const payload = {
        user_id: user.id,
        status: "pending",
        full_name_en: form.fullNameEn.trim(),
        full_name_ar: form.fullNameAr.trim(),
        avatar_url: profile?.avatar_url ?? null,
        email: user.email ?? null,
        phone: profile?.phone ?? null,
        date_of_birth: form.dateOfBirth,
        country: form.country,
        city: form.city,
        license_type: form.licenseType,
        riding_experience_years: form.yearsExperience,
        bio_en: form.bioEn.trim(),
        bio_ar: form.bioAr.trim(),
        bike_entries: form.bikeEntries,
        languages: form.languages,
        services: form.services,
      };
      const { error } = await (supabase as any).from("trainer_applications").insert(payload);
      if (error) throw error;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      toast.success(isRTL ? "تم إرسال طلبك! سنراجعه خلال 48 ساعة." : "Application sent! We'll review within 48h.");
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
    <div dir={isRTL ? "rtl" : "ltr"} className="max-w-3xl mx-auto p-3 sm:p-6 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{isRTL ? "تقديم كمدرب" : "Apply as Trainer"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isRTL ? "اكمل الخطوات الخمس وسنراجع طلبك" : "Complete the 5 steps and we'll review your application"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-3 sm:-mx-6 px-3 sm:px-6">
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
      <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6 min-h-[400px]">
        {/* ════════ STEP 1: Personal ════════ */}
        {step === 1 && (
          <div className="space-y-4">
            <SectionHeader
              titleAr="البيانات الشخصية"
              titleEn="Personal Information"
              descAr="تأكد من صحة بياناتك"
              descEn="Make sure your details are accurate"
            />

            <div className="grid sm:grid-cols-2 gap-3">
              <FormField label={isRTL ? "الاسم بالعربية *" : "Full Name (Arabic) *"}>
                <Input
                  value={form.fullNameAr}
                  onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })}
                  placeholder="محمد أحمد"
                />
              </FormField>
              <FormField label={isRTL ? "الاسم بالإنجليزية *" : "Full Name (English) *"}>
                <Input
                  value={form.fullNameEn}
                  onChange={(e) => setForm({ ...form, fullNameEn: e.target.value })}
                  placeholder="Mohammed Ahmed"
                  dir="ltr"
                />
              </FormField>
            </div>

            <FormField label={isRTL ? "تاريخ الميلاد *" : "Date of Birth *"}>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </FormField>

            <div className="grid sm:grid-cols-2 gap-3">
              <FormField label={isRTL ? "البلد *" : "Country *"}>
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v, city: "" })}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر البلد" : "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.en}>
                        {isRTL ? c.ar : c.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={isRTL ? "المدينة *" : "City *"}>
                <Select value={form.city} onValueChange={(v) => setForm({ ...form, city: v })} disabled={!form.country}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRTL ? "اختر المدينة" : "Select city"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city.en} value={city.en}>
                        {isRTL ? city.ar : city.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="rounded-xl bg-muted/30 p-3 flex items-start gap-3">
              <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "البريد والهاتف مأخوذان من ملفك. يمكنك تعديلهما من إعدادات الملف."
                  : "Email and phone are from your profile. Edit them in profile settings."}
              </p>
            </div>
          </div>
        )}

        {/* ════════ STEP 2: Experience ════════ */}
        {step === 2 && (
          <div className="space-y-4">
            <SectionHeader
              titleAr="خبرتك"
              titleEn="Your Experience"
              descAr="نوع الرخصة وسنوات الخبرة"
              descEn="License type and years of experience"
            />

            <FormField label={isRTL ? "نوع الرخصة *" : "License Type *"}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LICENSES.map((lic) => (
                  <button
                    key={lic.id}
                    type="button"
                    onClick={() => setForm({ ...form, licenseType: lic.id })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all",
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
              label={
                isRTL ? `سنوات الخبرة: ${form.yearsExperience} *` : `Years of Experience: ${form.yearsExperience} *`
              }
            >
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={form.yearsExperience}
                onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span>
                <span>15</span>
                <span>30+</span>
              </div>
            </FormField>

            <FormField
              label={isRTL ? `نبذة بالعربية * (${form.bioAr.length}/500)` : `Bio (Arabic) * (${form.bioAr.length}/500)`}
              hint={
                isRTL
                  ? "اكتب عن نفسك بطريقة تشجع الطلاب على اختيارك (30 حرف على الأقل)"
                  : "Write about yourself to attract students (min 30 chars)"
              }
            >
              <Textarea
                rows={4}
                maxLength={500}
                value={form.bioAr}
                onChange={(e) => setForm({ ...form, bioAr: e.target.value })}
              />
            </FormField>

            <FormField
              label={
                isRTL ? `نبذة بالإنجليزية * (${form.bioEn.length}/500)` : `Bio (English) * (${form.bioEn.length}/500)`
              }
            >
              <Textarea
                rows={4}
                maxLength={500}
                value={form.bioEn}
                onChange={(e) => setForm({ ...form, bioEn: e.target.value })}
                dir="ltr"
              />
            </FormField>
          </div>
        )}

        {/* ════════ STEP 3: Bikes ════════ */}
        {step === 3 && (
          <div className="space-y-4">
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
          <div className="space-y-5">
            <SectionHeader
              titleAr="مهاراتك"
              titleEn="Your Skills"
              descAr="اللغات التي تتحدثها والخدمات التي ستقدمها"
              descEn="Languages you speak and services you offer"
            />

            {/* Languages */}
            <FormField label={isRTL ? "اللغات *" : "Languages *"}>
              <div className="space-y-2">
                {form.languages.map((lang, i) => {
                  const opt = LANGUAGE_OPTIONS.find((o) => o.code === lang.code);
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/10">
                      <span className="flex-1 text-sm font-medium">
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
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFICIENCIES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {isRTL ? p.labelAr : p.labelEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setForm({ ...form, languages: form.languages.filter((_, j) => j !== i) })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}

                {/* Add language */}
                <Select
                  value=""
                  onValueChange={(code) => {
                    if (form.languages.some((l) => l.code === code)) return;
                    setForm({ ...form, languages: [...form.languages, { code, level: "fluent" }] });
                  }}
                >
                  <SelectTrigger className="border-dashed">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Plus className="w-3.5 h-3.5" />
                      {isRTL ? "إضافة لغة" : "Add language"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.filter((o) => !form.languages.some((l) => l.code === o.code)).map((o) => (
                      <SelectItem key={o.code} value={o.code}>
                        {isRTL ? o.nameAr : o.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FormField>

            {/* Services */}
            <FormField label={isRTL ? "الخدمات التي ستقدمها *" : "Services You'll Offer *"}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SERVICES.map(({ id, Icon, nameEn, nameAr }) => {
                  const active = form.services.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          services: active ? form.services.filter((s) => s !== id) : [...form.services, id],
                        })
                      }
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all relative",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {active && (
                        <div className="absolute top-1.5 end-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <Icon className="w-5 h-5" />
                      <span className="text-[11px] text-center leading-tight font-semibold">
                        {isRTL ? nameAr : nameEn}
                      </span>
                    </button>
                  );
                })}
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
              <ReviewRow label={isRTL ? "الاسم" : "Name"} value={`${form.fullNameAr} / ${form.fullNameEn}`} />
              <ReviewRow label={isRTL ? "تاريخ الميلاد" : "Date of birth"} value={form.dateOfBirth} />
              <ReviewRow label={isRTL ? "الموقع" : "Location"} value={`${form.city}, ${form.country}`} />
            </ReviewBlock>

            <ReviewBlock title={isRTL ? "الخبرة" : "Experience"} onEdit={() => setStep(2)}>
              <ReviewRow label={isRTL ? "الرخصة" : "License"} value={form.licenseType} />
              <ReviewRow
                label={isRTL ? "سنوات الخبرة" : "Years"}
                value={`${form.yearsExperience} ${isRTL ? "سنة" : "years"}`}
              />
            </ReviewBlock>

            <ReviewBlock title={isRTL ? "الدراجات" : "Bikes"} onEdit={() => setStep(3)}>
              <ReviewRow
                label={isRTL ? "العدد" : "Count"}
                value={`${form.bikeEntries.length} ${isRTL ? "دراجة" : "bikes"}`}
              />
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
                value={`${form.services.length} ${isRTL ? "خدمة" : "services"}`}
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
      <div className="fixed bottom-0 inset-x-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="max-w-3xl mx-auto p-3 sm:p-4 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={goPrev} disabled={step === 1 || submitting} className="gap-1.5">
            {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {isRTL ? "السابق" : "Previous"}
          </Button>

          <div className="text-xs text-muted-foreground">
            {step} / {totalSteps}
          </div>

          {step < totalSteps ? (
            <Button onClick={goNext} className="gap-1.5">
              {isRTL ? "التالي" : "Next"}
              {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
          ) : (
            <Button onClick={onSubmit} disabled={submitting || !form.termsAccepted} className="gap-2 min-w-[140px]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isRTL ? "إرسال الطلب" : "Submit Application"}
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

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground font-medium text-end truncate">{value || "—"}</span>
  </div>
);

export default ApplyTrainer;
