import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Gift } from 'lucide-react';
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
import { BundleTierLadder } from '@/components/bundles/BundleTierLadder';
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
      <main className="pt-[var(--navbar-h)] section-container pb-32">
        <div className="mb-8 text-center sm:text-start space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center justify-center sm:justify-start gap-2">
            <Gift className="w-7 h-7 text-primary" />
            {isRTL ? 'اصنع باقتك الخاصة' : 'Build your bundle'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto sm:mx-0">
            {isRTL ? 'وفّر أكثر مع كل كورس تضيفه' : 'Save more with every course you add'}
          </p>
        </div>

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
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">
              {activeTiers.map((tier) => (
                <div
                  key={tier.id}
                  className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border-2 min-w-[88px] text-center transition-colors ${
                    selectedIds.length >= tier.min_courses
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <span className="text-lg font-black">{Number(tier.discount_percentage)}%</span>
                  <span className="text-[10px]">
                    {tier.min_courses}+ {isRTL ? 'كورسات' : 'courses'}
                  </span>
                </div>
              ))}
            </div>
            <aside className="hidden lg:block w-64 shrink-0">
              <BundleTierLadder tiers={activeTiers} selectedCount={selectedIds.length} />
            </aside>
            <div className="flex-1 min-w-0">
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
        )}
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
