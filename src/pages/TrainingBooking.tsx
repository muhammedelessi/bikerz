import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/common/SEOHead';
import TrainingBookingFlow from '@/components/landing/TrainingBookingFlow';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import type { TrainerCourseRow } from '@/lib/trainingBookingUtils';
import { parseTrainingSessions } from '@/lib/trainingSessionCurriculum';

const TrainingBooking: React.FC = () => {
  const { trainingId, trainerCourseId } = useParams<{ trainingId: string; trainerCourseId: string }>();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  const returnPath = trainingId ? `/trainings/${trainingId}` : '/trainings';
  const bookingPath =
    trainingId && trainerCourseId ? `/trainings/${trainingId}/book/${trainerCourseId}` : returnPath;

  const {
    data: training,
    isLoading: trainingLoading,
    isError: trainingError,
  } = useQuery({
    queryKey: ['training-booking-meta', trainingId],
    enabled: !!trainingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('id, name_ar, name_en, status, type, sessions, default_sessions_count, default_session_duration_hours')
        .eq('id', trainingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: selectedCourse,
    isLoading: courseLoading,
    isError: courseError,
  } = useQuery({
    queryKey: ['training-booking-course', trainerCourseId, trainingId],
    enabled: !!trainingId && !!trainerCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_courses')
        .select('*, trainers(*)')
        .eq('id', trainerCourseId!)
        .maybeSingle();
      if (error) throw error;
      return data as TrainerCourseRow | null;
    },
  });

  const courseMatchesTraining =
    !!selectedCourse &&
    !!trainingId &&
    !!training &&
    selectedCourse.training_id === trainingId &&
    training.status === 'active';

  const invalidCourse =
    !courseLoading &&
    !trainingLoading &&
    !!selectedCourse &&
    !!training &&
    (selectedCourse.training_id !== trainingId || training.status !== 'active');

  const notFoundTraining = !trainingLoading && !trainingError && (!training || training.status !== 'active');
  const notFoundCourse =
    !courseLoading && !trainingLoading && !courseError && !trainingError && (!selectedCourse || invalidCourse);
  const trainingType = training && 'type' in training ? (training as { type: string }).type : undefined;
  const theoryNoBooking =
    !trainingLoading && !trainingError && !!training && training.status === 'active' && trainingType === 'theory';

  const trainingTitle = training ? (isRTL ? training.name_ar : training.name_en) : '';

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const pageReady =
    courseMatchesTraining && training && selectedCourse && trainingType === 'practical';

  const curriculum = useMemo(
    () => parseTrainingSessions((training as ({ sessions?: unknown } | null))?.sessions),
    [training],
  );

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead
        title={pageReady ? `${isRTL ? 'حجز' : 'Book'} — ${trainingTitle}` : isRTL ? 'حجز تدريب' : 'Book training'}
        description={isRTL ? 'اختر موعد الجلسة وأكمل الحجز والدفع.' : 'Pick your session time and complete booking & payment.'}
        canonical={trainingId && trainerCourseId ? `/trainings/${trainingId}/book/${trainerCourseId}` : '/trainings'}
      />
      <Navbar />
      <div className="pt-[var(--navbar-h)]">
        <div className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/[0.07] via-background to-background">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -20%, hsl(var(--primary) / 0.25), transparent)`,
            }}
          />
          <main className="section-container relative pb-20 max-w-6xl mx-auto">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" className="gap-2 -ms-2 shrink-0 rounded-full" onClick={() => navigate(returnPath)}>
                <BackIcon className="w-4 h-4" />
                {isRTL ? 'العودة للتدريب' : 'Back to training'}
              </Button>
            </div>

            {(trainingLoading || courseLoading) && (
              <div className="space-y-4">
                <Skeleton className="h-10 w-2/3 max-w-md rounded-xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </div>
            )}

            {(trainingError || courseError) && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-12 text-center text-sm text-destructive">
                  {isRTL ? 'تعذر تحميل بيانات الحجز.' : 'Could not load booking data.'}
                </CardContent>
              </Card>
            )}

            {!trainingLoading && !courseLoading && theoryNoBooking && (
              <Card className="max-w-lg mx-auto text-center shadow-sm border-purple-500/20">
                <CardContent className="py-12 space-y-4">
                  <CalendarDays className="h-12 w-12 mx-auto text-purple-600 opacity-70" />
                  <p className="font-medium text-foreground">
                    {isRTL
                      ? 'هذا البرنامج نظري ولا يقبل حجز جلسات عملية. تصفح التدريب العملي من قائمة التدريبات.'
                      : 'This is a theory-only program and cannot be used for practical session booking. Browse practical programs from the trainings list.'}
                  </p>
                  <Button asChild>
                    <Link to="/trainings">{isRTL ? 'تصفح التدريبات' : 'Browse trainings'}</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {!trainingLoading && !courseLoading && (notFoundTraining || notFoundCourse) && !theoryNoBooking && (
              <Card className="max-w-lg mx-auto text-center shadow-sm">
                <CardContent className="py-12 space-y-4">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground opacity-60" />
                  <p className="font-medium text-foreground">
                    {isRTL ? 'الرابط غير صالح أو التدريب غير متاح.' : 'This booking link is invalid or the training is unavailable.'}
                  </p>
                  <Button asChild>
                    <Link to="/trainings">{isRTL ? 'تصفح التدريبات' : 'Browse trainings'}</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {pageReady && (
              <div className="min-w-0 space-y-2 max-w-3xl">
                <p className="text-sm font-medium text-primary">{isRTL ? 'حجز موعد' : 'Book a session'}</p>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">{trainingTitle}</h1>
                <p className="text-muted-foreground text-sm sm:text-base pb-4">
                  {isRTL ? 'اختر التاريخ والوقت، ثم أكمل بياناتك والدفع بأمان.' : 'Choose your date and time, then enter your details and pay securely.'}
                </p>
                <TrainingBookingFlow
                  training={{
                    id: training.id,
                    name_ar: training.name_ar,
                    name_en: training.name_en,
                    default_sessions_count: (training as { default_sessions_count?: number | null }).default_sessions_count ?? null,
                    default_session_duration_hours: (training as { default_session_duration_hours?: number | null }).default_session_duration_hours ?? null,
                  }}
                  selectedCourse={selectedCourse}
                  curriculumSessions={curriculum}
                  loginReturnPath={bookingPath}
                  onCancel={() => navigate(returnPath)}
                />
              </div>
            )}
          </main>
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default TrainingBooking;
