import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  AlertCircle,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import hondaLogo from '@/assets/honda-logo.svg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CountryCityPicker, DateOfBirthPicker } from '@/components/ui/fields';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/data/countryCityData';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Profiles in this codebase are not consistent about how they store
 * country: Signup writes the country CODE ("SA"), but other paths
 * (GHL sync, older profile editor flows, manual updates) sometimes
 * write the localised NAME ("Saudi Arabia" / "السعودية"). The
 * CountryCityPicker only matches by code, so without this normaliser
 * users with a name-shaped value see an empty country dropdown and
 * the city falls through to raw English.
 *
 * Returns the canonical code if we can resolve it, otherwise the
 * trimmed input verbatim (which the picker treats as a custom
 * "Other" entry).
 */
function normalizeCountryToCode(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  // Already a code?
  if (COUNTRIES.some((c) => c.code === trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const byName = COUNTRIES.find(
    (c) => c.en.toLowerCase() === lower || c.ar === trimmed,
  );
  return byName?.code ?? trimmed;
}

/**
 * The picker's city <Select> matches by exact `city.en` OR `city.ar`,
 * so we normalise to the English name (the canonical form Signup
 * writes back to profiles.city). If the country is unknown or the
 * city isn't in our dataset, return the raw value — picker will
 * treat it as a free-text custom entry.
 */
function normalizeCity(countryCode: string, raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return trimmed;
  const lower = trimmed.toLowerCase();
  const cityEntry = country.cities.find(
    (city) => city.en.toLowerCase() === lower || city.ar === trimmed,
  );
  return cityEntry?.en ?? trimmed;
}

type HondaApplication = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  country: string;
  city: string;
  motorcycle_model: string;
  motorcycle_year: number;
  registration_document_path: string;
  ai_attempts: number;
  ai_decision: string | null;
  ai_decision_reason: string | null;
  ai_last_response: { reason_ar?: string; reason_en?: string } | null;
  status:
    | 'pending_ai'
    | 'needs_manual_review'
    | 'approved'
    | 'rejected'
    | 'limit_reached';
  manual_review_notes: string | null;
  approved_at: string | null;
  created_at: string;
};

const HondaApplication: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Form state ─────────────────────────────────────────────────────
  // Pre-fills from profile if available; user can edit anything before submitting.
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [motorcycleModel, setMotorcycleModel] = useState('');
  const [motorcycleYear, setMotorcycleYear] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Inline validation + submission errors shown ABOVE the submit button.
  // We keep field-level errors keyed by field name so we can render a
  // red ring + a per-field message; `formError` is the catch-all
  // (upload failed, AI rejection reason, etc.).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // ── Existing application lookup ────────────────────────────────────
  // Drives the page state machine: form vs. status-card.
  // staleTime + refetchOnWindowFocus:false stop the page from feeling
  // like it "keeps refreshing itself" — the data only changes when the
  // user actually submits, so there's no value in refetching on tab
  // focus or remount within a minute.
  const applicationQuery = useQuery({
    queryKey: ['honda-application', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async (): Promise<HondaApplication | null> => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('honda_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as HondaApplication | null) ?? null;
    },
  });
  const application = applicationQuery.data;

  // Auto-fill: priority is (1) existing application > (2) profile > (3) blank.
  //
  // The application takes priority because if the user already has a
  // pending_ai row, those values represent what THEY just typed and
  // submitted — losing them on remount would feel like the page "keeps
  // refreshing and forgetting my answers."
  //
  // We track first-load via a ref so the prefill runs exactly once;
  // subsequent renders (because of profile re-syncs or query refetches)
  // never overwrite whatever the user is currently typing.
  const prefillAppliedRef = useRef(false);
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?returnTo=${encodeURIComponent('/honda/apply')}`);
      return;
    }
    // Wait for both queries to settle before deciding what to prefill from.
    if (authLoading || applicationQuery.isLoading) return;
    if (prefillAppliedRef.current) return;

    if (application) {
      // Application exists — restore exactly what the user previously
      // submitted. country/city in the row are already in canonical
      // (code/English) form because we wrote them from this same form.
      setFullName(application.full_name || '');
      if (application.date_of_birth) setDob(application.date_of_birth);
      setCountry(normalizeCountryToCode(application.country));
      setCity(application.city || '');
      setMotorcycleModel(application.motorcycle_model || '');
      if (application.motorcycle_year) {
        setMotorcycleYear(String(application.motorcycle_year));
      }
    } else if (profile) {
      // No application yet — fall back to profile fields, normalising
      // country/city because profile storage is inconsistent between
      // signup paths (some store "SA", others store "Saudi Arabia").
      if (profile.full_name) setFullName(profile.full_name);
      const countryCode = normalizeCountryToCode(profile.country);
      if (countryCode) setCountry(countryCode);
      const cityCanonical = normalizeCity(countryCode, profile.city);
      if (cityCanonical) setCity(cityCanonical);
      if (profile.date_of_birth) setDob(profile.date_of_birth);
    }
    prefillAppliedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, application, applicationQuery.isLoading]);

  const yearNow = new Date().getFullYear();

  // ── Validation ─────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!fullName.trim()) return false;
    if (!dob) return false;
    if (!country.trim()) return false;
    if (!city.trim()) return false;
    if (!motorcycleModel.trim()) return false;
    const yearNum = Number(motorcycleYear);
    if (!Number.isFinite(yearNum) || yearNum < 1900 || yearNum > yearNow + 1) return false;
    if (!docFile) return false;
    return true;
  }, [
    submitting,
    fullName,
    dob,
    country,
    city,
    motorcycleModel,
    motorcycleYear,
    docFile,
    yearNow,
  ]);

  // ── File handlers ──────────────────────────────────────────────────
  const onFileChange = (file: File | null) => {
    if (!file) {
      setDocFile(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error(
        isRTL ? 'حجم الملف يجب ألا يتجاوز 10 ميجابايت' : 'File must be 10 MB or smaller',
      );
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(
        isRTL
          ? 'الصيغة غير مدعومة — استخدم JPG أو PNG أو PDF'
          : 'Unsupported format — use JPG, PNG, or PDF',
      );
      return;
    }
    setDocFile(file);
  };

  // ── Submit ─────────────────────────────────────────────────────────
  // 1) Upload doc to storage. 2) Insert honda_applications row. 3) Call
  // the edge function to run AI verification. 4) Refresh the query so
  // the page swaps to the result-card view.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmit || !docFile) return;
    setSubmitting(true);
    try {
      const ext = (docFile.name.split('.').pop() || 'jpg').toLowerCase();

      // Server-side mints a one-time signed upload URL. This bypasses
      // RLS on storage.objects entirely — the URL itself carries the
      // authorisation token — and the edge function ALSO ensures the
      // bucket exists (idempotent). End result: the upload works
      // regardless of where the storage policies / bucket are in
      // their migration cycle.
      const { data: prep, error: prepErr } = await supabase.functions.invoke(
        'honda-prepare-upload',
        { body: { ext } },
      );
      if (prepErr || !prep) {
        console.error('[Honda] prepare-upload failed:', prepErr);
        throw new Error(
          isRTL
            ? 'تعذر تجهيز رفع الوثيقة — حاول مرة أخرى بعد قليل.'
            : 'Could not prepare the upload — please try again shortly.',
        );
      }
      const { upload_url: uploadUrl, path } = prep as {
        upload_url: string;
        path: string;
      };

      // PUT the file directly to the signed URL. The signed URL has
      // its own auth, so we don't pass the user's bearer token — that
      // would actually conflict.
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': docFile.type || 'application/octet-stream' },
        body: docFile,
      });
      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        console.error('[Honda] PUT to signed URL failed:', putRes.status, errText);
        throw new Error(
          isRTL
            ? 'تعذر رفع الوثيقة — حاول مرة أخرى.'
            : 'Document upload failed — please try again.',
        );
      }

      // If a previous application exists in pending_ai (≤3 attempts), reuse it
      // so ai_attempts continues to increment correctly. Otherwise insert new.
      let applicationId: string;
      if (
        application &&
        application.status === 'pending_ai' &&
        (application.ai_attempts ?? 0) < 3
      ) {
        const { error: updErr } = await (supabase as any)
          .from('honda_applications')
          .update({
            full_name: fullName.trim(),
            date_of_birth: dob,
            country: country.trim(),
            city: city.trim(),
            motorcycle_model: motorcycleModel.trim(),
            motorcycle_year: Number(motorcycleYear),
            registration_document_path: path,
          })
          .eq('id', application.id);
        if (updErr) throw updErr;
        applicationId = application.id;
      } else {
        const { data: ins, error: insErr } = await (supabase as any)
          .from('honda_applications')
          .insert({
            user_id: user.id,
            full_name: fullName.trim(),
            date_of_birth: dob,
            country: country.trim(),
            city: city.trim(),
            motorcycle_model: motorcycleModel.trim(),
            motorcycle_year: Number(motorcycleYear),
            registration_document_path: path,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        applicationId = ins!.id as string;
      }

      // Run AI verification.
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
        'honda-verify-document',
        { body: { application_id: applicationId } },
      );
      if (verifyErr) {
        // Soft-fail: row is in DB; show a toast and refetch so the user sees
        // a "needs manual review" state if the function bumped ai_attempts.
        console.error('[Honda] verify error:', verifyErr);
        toast.error(
          isRTL
            ? 'تعذر التحقق الآن — تم حفظ طلبك، فريقنا سيراجعه يدوياً'
            : "Couldn't verify right now — your application was saved for manual review",
        );
      } else {
        const status = (verifyData as { status?: string })?.status;
        const reason = isRTL
          ? (verifyData as { reason_ar?: string })?.reason_ar
          : (verifyData as { reason_en?: string })?.reason_en;
        if (status === 'approved') {
          toast.success(
            isRTL
              ? 'تم القبول! كورس "فكر ماذا لو" أصبح متاحاً مجاناً.'
              : 'Approved! The "What If" course is now free for you.',
          );
        } else if (status === 'needs_manual_review') {
          toast.info(
            isRTL
              ? 'سيقوم فريقنا بمراجعة طلبك يدوياً'
              : 'Your application has been queued for manual review',
          );
        } else if (reason) {
          toast.error(reason);
        }
      }
      // Refresh.
      await queryClient.invalidateQueries({ queryKey: ['honda-application', user.id] });
    } catch (err) {
      console.error('[Honda] submit failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || (isRTL ? 'تعذر إرسال الطلب' : 'Could not submit'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────
  if (authLoading || applicationQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pb-12 space-y-4 pt-[calc(var(--navbar-h)+1rem)] lg:pt-[calc(var(--navbar-h)+2.5rem)]">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </main>
        <Footer />
      </div>
    );
  }

  // ── Status views (one application per user; show appropriate state) ─
  if (application) {
    if (application.status === 'approved') {
      return (
        <StatusShell isRTL={isRTL}>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? 'تم قبولك في برنامج ملاك هوندا' : 'You are approved!'}
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isRTL
                  ? 'كورس "فكر ماذا لو" أصبح متاحاً لك مجاناً. ابدأ رحلتك الآن.'
                  : 'The "What If" course is now free for you. Start learning now.'}
              </p>
              <Button asChild size="lg" className="mt-2">
                <Link to="/courses">
                  {isRTL ? 'تصفح الكورسات' : 'Browse courses'}
                  {isRTL ? <ArrowLeft className="w-4 h-4 ms-2" /> : <ArrowRight className="w-4 h-4 ms-2" />}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </StatusShell>
      );
    }
    if (application.status === 'needs_manual_review') {
      return (
        <StatusShell isRTL={isRTL}>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-9 h-9 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? 'طلبك قيد المراجعة' : 'Application under review'}
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isRTL
                  ? 'سيقوم فريق Bikerz بمراجعة وثيقة التسجيل يدوياً والرد عليك خلال 48 ساعة.'
                  : 'The Bikerz team will manually review your registration document and get back to you within 48 hours.'}
              </p>
              <Button asChild variant="outline" size="lg">
                <Link to="/">{isRTL ? 'العودة للرئيسية' : 'Back to home'}</Link>
              </Button>
            </CardContent>
          </Card>
        </StatusShell>
      );
    }
    if (application.status === 'rejected') {
      return (
        <StatusShell isRTL={isRTL}>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center">
                <XCircle className="w-9 h-9 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? 'تم رفض الطلب' : 'Application rejected'}
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                {application.manual_review_notes ||
                  (isRTL
                    ? 'لم يجتز طلبك التحقق. للاستفسار تواصل مع الدعم.'
                    : "We weren't able to verify your application. Contact support for help.")}
              </p>
              <Button asChild variant="outline" size="lg">
                <Link to="/">{isRTL ? 'العودة للرئيسية' : 'Back to home'}</Link>
              </Button>
            </CardContent>
          </Card>
        </StatusShell>
      );
    }
    if (application.status === 'limit_reached') {
      return (
        <StatusShell isRTL={isRTL}>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                <AlertCircle className="w-9 h-9 text-amber-600" />
              </div>
              <h1 className="text-2xl font-bold">
                {isRTL ? 'البرنامج ممتلئ حالياً' : 'Program is currently full'}
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isRTL
                  ? 'تم التحقق من طلبك بنجاح، لكن الـ500 مقعد المجاني قد امتلأت. سنتواصل معك إذا تم فتح مقاعد إضافية.'
                  : "Your application was verified successfully, but the 500 free spots are filled. We'll reach out if more spots open."}
              </p>
            </CardContent>
          </Card>
        </StatusShell>
      );
    }
    // pending_ai with attempts left → fall through to the form below,
    // pre-filling the existing values + showing the attempt counter.
    if (
      application.status === 'pending_ai' &&
      (application.ai_decision_reason || application.ai_attempts > 0)
    ) {
      // Pre-load existing values into form on first render of the retry path.
      // Only ONCE — guarded so the user's edits aren't reset every render.
      // (We track first-render via the application id and a ref-style flag.)
    }
  }

  // Compute attempt indicator (shown only if user has tried at least once).
  const attemptsUsed = application?.ai_attempts ?? 0;
  const attemptsRemaining = Math.max(0, 3 - attemptsUsed);

  // ── Application form ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-8 sm:pb-12 space-y-6 pt-[calc(var(--navbar-h)+1rem)] lg:pt-[calc(var(--navbar-h)+2.5rem)]">
        {/* Header */}
        <div className="text-center space-y-2">
          <img
            src={hondaLogo}
            alt="Honda"
            className="mx-auto h-20 sm:h-24 w-auto object-contain mb-2"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isRTL ? 'برنامج ملاك هوندا' : 'Honda Owners Program'}
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            {isRTL
              ? 'املأ النموذج وارفع وثيقة تسجيل دراجتك للحصول على وصول مجاني لكورس "فكر ماذا لو".'
              : 'Fill the form and upload your motorcycle registration to unlock free access to the "What If" course.'}
          </p>
        </div>

        {/* Retry banner (only if a previous attempt failed) */}
        {application?.status === 'pending_ai' && attemptsUsed > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1 min-w-0">
                <p className="font-semibold">
                  {isRTL
                    ? `محاولة ${attemptsUsed + 1} من 3`
                    : `Attempt ${attemptsUsed + 1} of 3`}
                </p>
                {(() => {
                  const reasonText = isRTL
                    ? application.ai_last_response?.reason_ar ||
                      application.ai_decision_reason
                    : application.ai_last_response?.reason_en ||
                      application.ai_decision_reason;
                  return reasonText ? (
                    <p className="text-muted-foreground break-words">
                      {reasonText}
                    </p>
                  ) : null;
                })()}
                <p className="text-xs text-muted-foreground">
                  {isRTL
                    ? `تبقّى لك ${attemptsRemaining} ${
                        attemptsRemaining === 1 ? 'محاولة' : 'محاولات'
                      } قبل أن يتم تحويل الطلب لمراجعة الادمن.`
                    : `${attemptsRemaining} ${
                        attemptsRemaining === 1 ? 'attempt' : 'attempts'
                      } remaining before manual review.`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isRTL ? 'بيانات صاحب الدراجة' : 'Owner & motorcycle details'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <div className="space-y-1.5">
                <Label htmlFor="honda-fullname">
                  {isRTL ? 'الاسم الكامل' : 'Full name'}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="honda-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={isRTL ? 'كما يظهر في الرخصة' : 'As it appears on the registration'}
                  required
                />
              </div>

              {/* Date of birth */}
              <DateOfBirthPicker
                value={dob || null}
                onChange={(v) => setDob(v ?? '')}
                required
              />

              {/* Country / City */}
              <CountryCityPicker
                country={country}
                city={city}
                onCountryChange={setCountry}
                onCityChange={setCity}
                required
              />

              {/* Motorcycle model + year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="honda-model">
                    {isRTL ? 'موديل الدراجة' : 'Motorcycle model'}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="honda-model"
                    value={motorcycleModel}
                    onChange={(e) => setMotorcycleModel(e.target.value)}
                    placeholder={isRTL ? 'مثال: CBR 500R' : 'e.g. CBR 500R'}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="honda-year">
                    {isRTL ? 'سنة الصنع' : 'Year of manufacture'}{' '}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="honda-year"
                    type="number"
                    inputMode="numeric"
                    min={1900}
                    max={yearNow + 1}
                    value={motorcycleYear}
                    onChange={(e) => setMotorcycleYear(e.target.value)}
                    placeholder={String(yearNow)}
                    required
                  />
                </div>
              </div>

              {/* Document upload */}
              <div className="space-y-1.5">
                <Label>
                  {isRTL ? 'وثيقة تسجيل الدراجة' : 'Motorcycle registration document'}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  className="sr-only"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-full border-2 border-dashed rounded-xl px-4 py-6 text-sm transition-colors',
                    docFile
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                >
                  {docFile ? (
                    <span className="flex items-center justify-center gap-3">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <span className="font-medium truncate max-w-full">{docFile.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(docFile.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="font-medium">
                        {isRTL ? 'اختر صورة أو PDF' : 'Choose image or PDF'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        JPG / PNG / PDF · {isRTL ? '10 ميجابايت كحد أقصى' : 'up to 10 MB'}
                      </span>
                    </span>
                  )}
                </button>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  {isRTL
                    ? 'سيتم استخدام الوثيقة فقط للتحقق من ملكيتك دراجة Honda. لن تُشارك مع أي طرف آخر.'
                    : 'The document is used only to verify Honda ownership. It is not shared with any third party.'}
                </p>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    {isRTL ? 'جارٍ التحقق…' : 'Verifying…'}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 me-2" />
                    {isRTL ? 'إرسال للتحقق' : 'Submit for verification'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

const StatusShell: React.FC<{ isRTL: boolean; children: React.ReactNode }> = ({
  isRTL,
  children,
}) => (
  <div className="min-h-screen bg-background flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
    <Navbar />
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-12 pt-[calc(var(--navbar-h)+1rem)] lg:pt-[calc(var(--navbar-h)+2.5rem)]">{children}</main>
    <Footer />
  </div>
);

export default HondaApplication;
