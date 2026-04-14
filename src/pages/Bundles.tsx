import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Gift, CheckSquare, Tag, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/common/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchEnrollmentsWithLiveProgress, type EnrollmentWithProgress } from '@/lib/enrollmentProgress';
import { useBundleTiers } from '@/hooks/useBundleTiers';
import { loadBundleSelectionIds, saveBundleSelectionIds } from '@/lib/bundleSelectionStorage';
import { navigateToSignup } from '@/lib/authReturnUrl';
import { SelectableBundleCourseCard } from '@/components/bundles/SelectableBundleCourseCard';
import { BundleBottomBar } from '@/components/bundles/BundleBottomBar';
import BundleCheckoutModal from '@/components/checkout/BundleCheckoutModal';
import type { CheckoutCourse } from '@/types/payment';
import type { BundleCourseInput } from '@/types/bundle';

const Bundles: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: tiers = [], isLoading: tiersLoading } = useBundleTiers();

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['bundles-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(
          'id, title, title_ar, thumbnail_url, preview_video_thumbnail, price, discount_percentage, discount_expires_at, vat_percentage, is_published',
        )
        .eq('is_published', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['user-enrollments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return (await fetchEnrollmentsWithLiveProgress(user.id)) as EnrollmentWithProgress[];
    },
    enabled: !!user,
  });

  const getEnrollment = (courseId: string) => enrollments.find((e) => e.course_id === courseId);

  useEffect(() => {
    const fromUrl = searchParams.get('selected');
    const fromLs = loadBundleSelectionIds();
    const parsed = fromUrl
      ? fromUrl
          .split(',')
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
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead
        title={isRTL ? 'باقات الكورسات' : 'Course bundles'}
        description={isRTL ? 'اصنع باقتك ووفّر أكثر' : 'Build your bundle and save'}
        canonical="/bundles"
      />
      <Navbar />
      <main className="pt-[calc(var(--navbar-h)+1.5rem)] section-container pb-[calc(env(safe-area-inset-bottom)+4rem)] space-y-8">
        <div className="max-w-7xl mx-auto space-y-8">
        <section className="rounded-3xl border border-border/50 bg-gradient-to-b from-muted/30 to-transparent px-4 sm:px-6 py-6 sm:py-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-2">
            <Gift className="w-7 h-7 text-primary" />
            {isRTL ? 'اصنع باقتك الخاصة' : 'Build your bundle'}
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isRTL ? 'وفّر أكثر مع كل كورس تضيفه' : 'Save more with every course you add'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mt-6">
            {[
            {
              step: '1',
              icon: <CheckSquare className="w-5 h-5" />,
              titleAr: 'اختر كورسين أو أكثر',
              titleEn: 'Select 2+ courses',
              descAr: 'انقر على الكورسات التي تريدها',
              descEn: 'Tap the courses you want',
            },
            {
              step: '2',
              icon: <Tag className="w-5 h-5" />,
              titleAr: 'احصل على خصم تلقائي',
              titleEn: 'Get automatic discount',
              descAr: 'الخصم يزيد كلما أضفت أكثر',
              descEn: 'More courses = bigger discount',
            },
            {
              step: '3',
              icon: <ShoppingBag className="w-5 h-5" />,
              titleAr: 'اشترِ وابدأ التعلم',
              titleEn: 'Buy & start learning',
              descAr: 'جميع الكورسات تُفعّل فوراً',
              descEn: 'All courses unlocked instantly',
            },
            ].map((s) => (
              <div
                key={s.step}
                className="flex flex-col items-center text-center p-3.5 rounded-2xl bg-background/70 border border-border/50 gap-2 min-h-[122px] transition-all duration-300 hover:border-primary/30 hover:shadow-sm"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">{s.icon}</div>
                <p className="font-bold text-xs sm:text-sm">{isRTL ? s.titleAr : s.titleEn}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{isRTL ? s.descAr : s.descEn}</p>
              </div>
            ))}
          </div>
        </section>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {noTiers && !loading && (
          <p className="text-center text-muted-foreground py-12 rounded-2xl border border-dashed border-border">
            {isRTL ? 'لم يتم إعداد خصومات الباقات بعد' : 'Bundle discounts not configured yet'}
          </p>
        )}

        {!loading && !noTiers && (
          <>
            {selectedIds.length === 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20 mb-6">
                <span className="text-2xl shrink-0">👆</span>
                <div>
                  <p className="font-semibold text-sm">{isRTL ? 'كيف تشتري باقة؟' : 'How to buy a bundle?'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? 'انقر على أي كورس لإضافته، اختر كورسين أو أكثر وستظهر لك أسعار الباقة في الأسفل'
                      : 'Tap any course to add it, select 2+ courses and the bundle price will appear at the bottom'}
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-4">
            <div className="w-full max-w-5xl mx-auto">
              <p className="text-sm font-semibold text-foreground mb-2 text-center">
                {isRTL ? 'مستويات الخصم' : 'Discount tiers'}
              </p>
              <div className="flex gap-3 overflow-x-auto md:overflow-visible md:flex-wrap pb-2 -mx-2 px-2 w-full justify-start md:justify-center">
              {activeTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    'flex-shrink-0 rounded-2xl border-2 p-3 min-w-[120px] transition-all',
                    selectedIds.length >= tier.min_courses
                      ? 'border-primary bg-primary/10'
                      : 'border-border/50 bg-muted/20 opacity-70',
                  )}
                >
                  <p
                    className={cn(
                      'text-2xl font-black tabular-nums',
                      selectedIds.length >= tier.min_courses ? 'text-primary' : 'text-muted-foreground',
                    )}
                  >
                    {Number(tier.discount_percentage)}%
                  </p>
                  <p className="text-xs font-medium mt-0.5">
                    {isRTL ? tier.label_ar || tier.label_en : tier.label_en || tier.label_ar}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {tier.min_courses}+ {isRTL ? 'كورسات' : 'courses'}
                  </p>
                  {selectedIds.length >= tier.min_courses && (
                    <div className="flex items-center gap-1 mt-1.5 text-emerald-600 text-[10px]">
                      <Check className="w-3 h-3" />
                      {isRTL ? 'مفعّل ✓' : 'Active ✓'}
                    </div>
                  )}
                </div>
              ))}
            </div>
            </div>
            <div className="min-w-0 max-w-5xl mx-auto w-full">
              <div className="mb-3 sm:mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {isRTL ? 'الكورسات المتاحة في الباقة' : 'Courses available for bundle'}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {courses.length} {isRTL ? 'كورس' : 'courses'}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {courses.map((c: any) => {
                  const en = getEnrollment(c.id);
                  const disabled = !!en;
                  return (
                    <SelectableBundleCourseCard
                      key={c.id}
                      course={c}
                      selected={selectedIds.includes(c.id)}
                      disabled={disabled}
                      disabledReason={disabled ? (isRTL ? 'مسجّل بالفعل' : 'Already enrolled') : undefined}
                      onToggle={() => toggle(c.id)}
                    />
                  );
                })}
              </div>
            </div>
            </div>
          </>
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

      <BundleCheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        courses={checkoutCourses}
        tiers={tiers}
      />

      <Footer />
    </div>
  );
};

export default Bundles;
