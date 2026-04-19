import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrollmentsWithLiveProgress, type EnrollmentWithProgress } from "@/lib/enrollmentProgress";
import { useBundleTiers } from "@/hooks/useBundleTiers";
import { loadBundleSelectionIds, saveBundleSelectionIds } from "@/lib/bundleSelectionStorage";
import { navigateToSignup } from "@/lib/authReturnUrl";
import { SelectableBundleCourseCard } from "@/components/bundles/SelectableBundleCourseCard";
import { BundleBottomBar } from "@/components/bundles/BundleBottomBar";
import { BundleTierLadder } from "@/components/bundles/BundleTierLadder";
import BundleCheckoutModal from "@/components/checkout/BundleCheckoutModal";
import type { CheckoutCourse } from "@/types/payment";
import type { BundleCourseInput } from "@/types/bundle";

const STEPS = [
  {
    titleAr: "اختر الكورسات",
    titleEn: "Pick courses",
    descAr: "أضف كورسين أو أكثر إلى سلة الباقة.",
    descEn: "Add two or more courses to your bundle.",
  },
  {
    titleAr: "يُطبّق الخصم تلقائياً",
    titleEn: "Discount applies",
    descAr: "كلما زاد العدد، زاد نسبة التوفير حسب الجدول.",
    descEn: "The more you add, the higher the tier discount.",
  },
  {
    titleAr: "ادفع وابدأ",
    titleEn: "Pay & learn",
    descAr: "تفعيل فوري لجميع الكورسات بعد الدفع.",
    descEn: "All courses unlock instantly after checkout.",
  },
] as const;

const Bundles: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: tiers = [], isLoading: tiersLoading } = useBundleTiers();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["bundles-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, title, title_ar, thumbnail_url, preview_video_thumbnail, price, discount_percentage, discount_expires_at, vat_percentage, is_published",
        )
        .eq("is_published", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["user-enrollments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      return (await fetchEnrollmentsWithLiveProgress(user.id)) as EnrollmentWithProgress[];
    },
    enabled: !!user,
  });

  const getEnrollment = (courseId: string) => enrollments.find((e) => e.course_id === courseId);

  useEffect(() => {
    const fromUrl = searchParams.get("selected");
    const fromLs = loadBundleSelectionIds();
    const parsed = fromUrl
      ? fromUrl
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const merged = [...new Set([...parsed, ...fromLs])];
    if (merged.length) setSelectedIds(merged);
  }, [searchParams]);

  useEffect(() => {
    saveBundleSelectionIds(selectedIds);
  }, [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleBundleCheckout = useCallback(() => {
    if (!user) {
      saveBundleSelectionIds(selectedIds);
      navigateToSignup(navigate);
      return;
    }
    setCheckoutOpen(true);
  }, [user, selectedIds, navigate]);

  const selectedCoursesData = useMemo(
    () => courses.filter((c: { id: string }) => selectedIds.includes(c.id)),
    [courses, selectedIds],
  );

  const bundleInputs: BundleCourseInput[] = useMemo(
    () =>
      selectedCoursesData.map((c: any) => ({
        id: c.id,
        price: c.price,
        discount_percentage: c.discount_percentage,
        discount_expires_at: c.discount_expires_at,
        vat_percentage: c.vat_percentage ?? 15,
      })),
    [selectedCoursesData],
  );

  const checkoutCourses: CheckoutCourse[] = useMemo(
    () =>
      selectedCoursesData.map((c: any) => ({
        id: c.id,
        title: c.title,
        title_ar: c.title_ar,
        price: c.price,
        discount_percentage: c.discount_percentage,
        discount_expires_at: c.discount_expires_at,
        thumbnail_url: c.thumbnail_url,
        vat_percentage: c.vat_percentage ?? 15,
      })),
    [selectedCoursesData],
  );

  const loading = coursesLoading || tiersLoading;
  const activeTiers = tiers.filter((t) => t.is_active !== false);
  const noTiers = !tiersLoading && activeTiers.length === 0;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <SEOHead
        title={isRTL ? "باقات الكورسات" : "Course bundles"}
        description={isRTL ? "اختر أكثر من كورس ووفّر أكثر." : "Pick multiple courses and save more."}
        canonical="/bundles"
      />
      <Navbar />

      <main
        className={cn(
          "pt-[calc(var(--navbar-h)+1rem)]",
          "pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:pb-[calc(env(safe-area-inset-bottom)+5rem)]",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Page intro */}
          <header className="border-b border-border/60 pb-8 sm:pb-10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {isRTL ? "التسعير" : "Pricing"}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {isRTL ? "باقات الكورسات" : "Course bundles"}
                </h1>
                <p className="max-w-xl text-sm text-muted-foreground">
                  {isRTL
                    ? "اجمع الكورسات التي تحتاجها في عملية شراء واحدة واستفد من خصم يزداد مع عدد الكورسات."
                    : "Combine the courses you need in one purchase—discounts increase as you add more."}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground sm:pb-0.5">
                <Layers className="h-4 w-4 text-primary" aria-hidden />
                <span>
                  {isRTL ? "الحد الأدنى لخصم الباقة: كورسان" : "Bundle discounts start at 2+ courses"}
                </span>
              </div>
            </div>

            {/* Steps — horizontal, scan-friendly */}
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={i} className="relative flex gap-3 rounded-lg border border-border/60 bg-card/80 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{isRTL ? s.titleAr : s.titleEn}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{isRTL ? s.descAr : s.descEn}</p>
                  </div>
                </li>
              ))}
            </ol>
          </header>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{isRTL ? "جاري التحميل…" : "Loading…"}</p>
            </div>
          )}

          {noTiers && !loading && (
            <div className="my-16 rounded-lg border border-dashed border-border/70 bg-muted/30 px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">
                {isRTL ? "خصومات الباقات غير مفعّلة بعد" : "Bundle discounts are not set up yet"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
                {isRTL
                  ? "عُد لاحقاً أو تواصل مع الدعم إذا كان يفترض أن تظهر هذه الصفحة."
                  : "Please check back later or contact support if bundles should be available."}
              </p>
            </div>
          )}

          {!loading && !noTiers && (
            <div className="mt-8 lg:mt-10">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-6 lg:space-y-8">
                  {/* Mobile / tablet: tier rules before picking courses */}
                  <div className="lg:hidden">
                    <BundleTierLadder tiers={tiers} selectedCount={selectedIds.length} variant="compact" />
                  </div>

                  {selectedIds.length === 0 && (
                    <div
                      className="flex gap-3 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3 sm:items-center"
                      role="status"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-sm font-semibold text-primary">
                        !
                      </div>
                      <div className="min-w-0 text-sm">
                        <p className="font-medium text-foreground">
                          {isRTL ? "ابدأ باختيار الكورسات" : "Start by selecting courses"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {isRTL
                            ? "انقر على بطاقة الكورس لتضمينها. عند اختيار كورسين أو أكثر تظهر الأسعار النهائية في الشريط السفلي."
                            : "Tap a course card to include it. With 2+ courses, your bundle total appears in the bar at the bottom."}
                        </p>
                      </div>
                    </div>
                  )}

                  <section aria-labelledby="bundle-courses-heading">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border/50 pb-3">
                      <div>
                        <h2 id="bundle-courses-heading" className="text-base font-semibold text-foreground">
                          {isRTL ? "الكورسات المتاحة" : "Available courses"}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {isRTL
                            ? "الكورسات التي سبق شراؤها تظهر معطّلة."
                            : "Courses you already own are shown as disabled."}
                        </p>
                      </div>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {courses.length} {isRTL ? "كورس" : "courses"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {courses.map((c: any) => {
                        const en = getEnrollment(c.id);
                        const disabled = !!en;
                        return (
                          <SelectableBundleCourseCard
                            key={c.id}
                            course={c}
                            selected={selectedIds.includes(c.id)}
                            disabled={disabled}
                            disabledReason={disabled ? (isRTL ? "تم الشراء مسبقاً" : "Already purchased") : undefined}
                            onToggle={() => toggle(c.id)}
                          />
                        );
                      })}
                    </div>
                  </section>
                </div>

                {/* Desktop: sticky discount reference */}
                <aside className="hidden lg:sticky lg:top-[calc(var(--navbar-h)+1rem)] lg:self-start lg:block">
                  <BundleTierLadder tiers={tiers} selectedCount={selectedIds.length} variant="sidebar" />
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>

      <BundleBottomBar
        selectedCourses={bundleInputs}
        tiers={tiers}
        courseLabels={selectedCoursesData.map((c: any) => ({
          id: c.id,
          title: c.title,
          title_ar: c.title_ar,
        }))}
        onClear={() => setSelectedIds([])}
        onCheckout={handleBundleCheckout}
      />

      <BundleCheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} courses={checkoutCourses} tiers={tiers} />

      <Footer />
    </div>
  );
};

export default Bundles;
