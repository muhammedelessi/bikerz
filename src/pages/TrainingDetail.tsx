import React, { useEffect, useMemo, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SEOHead from "@/components/common/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrainerCourseRow } from "@/lib/trainingBookingUtils";
import { translateTrainerCourseLocation } from "@/lib/trainerCourseLocation";
import TrainerShowcaseCard from "@/components/landing/TrainerShowcaseCard";
import { useTrainingPlatformPricing } from "@/hooks/useTrainingPlatformPricing";
import { applyTrainingPlatformMarkupSar } from "@/lib/trainingPlatformMarkup";
import TrainingCurriculumAccordion from "@/components/training/TrainingCurriculumAccordion";
import { parseTrainingSessions } from "@/lib/trainingSessionCurriculum";

type TrainerSupply = { name_ar: string; name_en: string };

function parseTrainerSupplies(raw: unknown): TrainerSupply[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        name_ar: String(o.name_ar ?? "").trim(),
        name_en: String(o.name_en ?? "").trim(),
      };
    })
    .filter((x) => x.name_ar && x.name_en);
}

const levelConfig: Record<string, { color: string; label: { en: string; ar: string } }> = {
  beginner: {
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    label: { en: "Beginner", ar: "مبتدئ" },
  },
  intermediate: {
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    label: { en: "Intermediate", ar: "متوسط" },
  },
  advanced: {
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    label: { en: "Advanced", ar: "متقدم" },
  },
};

const TrainingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isRTL, language } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const redirectedBookQuery = useRef(false);

  useEffect(() => {
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [isRTL, language]);

  const {
    data: training,
    isLoading: trainingLoading,
    isError: trainingError,
  } = useQuery({
    queryKey: ["training-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainings")
        .select("*")
        .eq("id", id!)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: trainerCourses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["training-detail-courses", id],
    enabled: !!id && !!training,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainer_courses")
        .select("*, trainers(*)")
        .eq("training_id", id!);
      if (error) throw error;
      return (data || []) as TrainerCourseRow[];
    },
  });

  const { data: pricing } = useTrainingPlatformPricing();
  const platformMarkupPct = pricing?.markupPercent ?? 0;
  const platformVatPct = pricing?.vatPercent ?? 15;

  const { data: reviewStats } = useQuery({
    queryKey: ["public-trainer-review-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("trainer_reviews").select("trainer_id, rating");
      const stats: Record<string, { avg: number; count: number }> = {};
      const grouped: Record<string, number[]> = {};
      data?.forEach((r) => {
        if (!grouped[r.trainer_id]) grouped[r.trainer_id] = [];
        grouped[r.trainer_id].push(r.rating);
      });
      Object.entries(grouped).forEach(([tid, ratings]) => {
        stats[tid] = {
          avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
          count: ratings.length,
        };
      });
      return stats;
    },
  });

  useEffect(() => {
    redirectedBookQuery.current = false;
  }, [id, searchParams]);

  useEffect(() => {
    const bid = searchParams.get("bookTrainerCourse");
    if (!bid || !id || coursesLoading || redirectedBookQuery.current) return;

    redirectedBookQuery.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("bookTrainerCourse");
    setSearchParams(next, { replace: true });

    const tc = trainerCourses.find((x) => x.id === bid);
    if (tc) {
      navigate(`/trainings/${id}/book/${bid}`, { replace: true });
    }
  }, [coursesLoading, trainerCourses, searchParams, setSearchParams, id, navigate]);

  const level = training ? levelConfig[training.level] || levelConfig.beginner : levelConfig.beginner;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const supplies = parseTrainerSupplies(training?.trainer_supplies);

  const curriculumSessions = useMemo(
    () => parseTrainingSessions((training as ({ sessions?: unknown } | null))?.sessions),
    [training],
  );

  const trainingTitle = training ? (isRTL ? training.name_ar : training.name_en) : "";
  const seoDescription = useMemo(() => {
    if (!training) return "";
    const d = isRTL ? training.description_ar : training.description_en;
    return d.length > 160 ? `${d.slice(0, 157)}…` : d;
  }, [training, isRTL]);

  const notFound = !trainingLoading && !trainingError && !training;

  const bookingHref = (courseId: string) => `/trainings/${id}/book/${courseId}`;
  const loginBookingReturn = (courseId: string) => encodeURIComponent(bookingHref(courseId));

  return (
    <div className="min-h-screen bg-background transition-all duration-300" dir={isRTL ? "rtl" : "ltr"}>
      <SEOHead
        title={trainingTitle || (isRTL ? "تفاصيل التدريب" : "Training details")}
        description={
          seoDescription ||
          (training?.type === "theory"
            ? isRTL
              ? "برنامج تدريب نظري — منفصل عن التدريب العملي."
              : "Theory training program — separate from practical sessions."
            : isRTL
              ? "تدريب عملي مع بايكرز — كل برنامج عملي له معرّف خاص."
              : "Practical training at BIKERZ Academy — each practical program has its own ID.")
        }
        canonical={id ? `/trainings/${id}` : "/trainings"}
      />
      <Navbar />
      <div className="pt-[var(--navbar-h)]">
        <main className="section-container pb-16">
          <div className="mb-8">
            <Button variant="ghost" size="sm" className="gap-2 -ms-2" asChild>
              <Link to="/trainings">
                <BackIcon className="w-4 h-4" />
                {isRTL ? "العودة للتدريبات" : "Back to trainings"}
              </Link>
            </Button>
          </div>

          {trainingLoading && (
            <div className="space-y-8">
              <Skeleton className="h-48 w-full max-w-3xl mx-auto rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          )}

          {trainingError && (
            <p className="text-center text-muted-foreground py-16">
              {isRTL ? "تعذر تحميل التدريب." : "Could not load this training."}
            </p>
          )}

          {notFound && (
            <Card className="max-w-lg mx-auto text-center">
              <CardHeader>
                <CardTitle>{isRTL ? "التدريب غير موجود" : "Training not found"}</CardTitle>
                <CardDescription>
                  {isRTL ? "قد يكون الرابط غير صحيح أو التدريب غير متاح." : "The link may be invalid or this training is unavailable."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/trainings">{isRTL ? "عرض كل التدريبات" : "View all trainings"}</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {training && (
            <>
              <Card className="max-w-3xl mx-auto mb-12 overflow-hidden border-border/60 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary text-primary-foreground shadow-md shrink-0">
                        {training.type === "theory" ? <GraduationCap className="w-7 h-7" /> : <Wrench className="w-7 h-7" />}
                      </div>
                      <div className="text-start min-w-0">
                        <CardTitle className="text-2xl sm:text-3xl font-black leading-tight">{trainingTitle}</CardTitle>
                        <CardDescription className="text-base mt-2 text-muted-foreground leading-relaxed">
                          {isRTL ? training.description_ar : training.description_en}
                        </CardDescription>
                      </div>
                    </div>
                    <div className={cn("flex flex-wrap gap-2", isRTL ? "sm:justify-end" : "sm:justify-end")}>
                      <Badge variant="secondary">
                        {training.type === "theory" ? (isRTL ? "نظري" : "Theory") : (isRTL ? "عملي" : "Practical")}
                      </Badge>
                      <Badge variant="outline" className={level.color}>
                        {isRTL ? level.label.ar : level.label.en}
                      </Badge>
                    </div>
                  </div>
                  {supplies.length > 0 ? (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Wrench className="h-4 w-4 text-primary" />
                        {isRTL ? "ما يوفره المدرب" : "Trainer Supplies"}
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {supplies.map((item, idx) => (
                          <li key={`${item.name_en}-${idx}`} className="flex items-center gap-2">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{isRTL ? item.name_ar : item.name_en}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardHeader>
              </Card>

              {curriculumSessions.length > 0 ? (
                <TrainingCurriculumAccordion
                  sessions={curriculumSessions}
                  isRTL={isRTL}
                  className="max-w-3xl mx-auto mb-12"
                />
              ) : null}

              {training.type === "theory" ? (
                <section className="rounded-2xl border border-border/70 bg-muted/20 p-6 sm:p-8 text-center">
                  <GraduationCap className="mx-auto mb-4 h-12 w-12 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    {isRTL ? "برنامج نظري" : "Theory program"}
                  </h2>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto mb-6">
                    {isRTL
                      ? "هذا البرنامج نظري ومنفصل عن التدريب العملي. لحجز جلسة مع مدرب، تصفح قسم التدريب العملي من صفحة التدريبات."
                      : "This is a theory-only program, separate from practical training. To book a session with a trainer, browse the practical section on the trainings page."}
                  </p>
                  <Button asChild variant="default">
                    <Link to="/trainings">{isRTL ? "العودة إلى التدريبات" : "Back to trainings"}</Link>
                  </Button>
                </section>
              ) : (
                <section>
                  <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {isRTL ? "المدربون المتاحون" : "Available trainers"}
                    </h2>
                    <p
                      className="text-xs text-muted-foreground font-mono break-all max-w-full sm:max-w-[min(100%,28rem)] sm:text-end"
                      title={training.id}
                    >
                      {isRTL ? "معرّف البرنامج العملي:" : "Practical program ID:"}{" "}
                      <span className="text-foreground/80">{training.id}</span>
                    </p>
                  </div>

                  {coursesLoading && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-2xl" />
                      ))}
                    </div>
                  )}

                  {!coursesLoading && trainerCourses.length === 0 && (
                    <p className="text-muted-foreground text-center py-12">
                      {isRTL ? "لا يوجد مدربون لهذا التدريب حالياً." : "No trainers are available for this training yet."}
                    </p>
                  )}

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {!coursesLoading &&
                      trainerCourses.map((tc) => {
                        const tr = tc.trainers;
                        if (!tr) return null;
                        const stats = reviewStats?.[tr.id];
                        const hours = Number(tc.duration_hours);
                        const sess = Math.max(1, Number(tc.sessions_count ?? 1));
                        const loc = translateTrainerCourseLocation(tc.location, isRTL) || tc.location;
                        const BookIcon = isRTL ? ChevronLeft : ChevronRight;
                        const sessionLabel = isRTL
                          ? `${sess} ${sess === 1 ? "جلسة" : "جلسات"} · ${hours} ${hours === 1 ? "س/جلسة" : "ساعات/جلسة"}`
                          : `${sess} ${sess === 1 ? "session" : "sessions"} · ${hours} ${hours === 1 ? "hr/sess" : "hrs/sess"}`;
                        return (
                          <TrainerShowcaseCard
                            key={tc.id}
                            trainer={{ name_ar: tr.name_ar, name_en: tr.name_en, photo_url: tr.photo_url }}
                            isRTL={isRTL}
                            reviewStats={stats && stats.count > 0 ? stats : null}
                            headline={loc}
                            metaRows={[
                              {
                                id: "dur",
                                icon: "clock",
                                text: sessionLabel,
                              },
                            ]}
                            priceSar={applyTrainingPlatformMarkupSar(Number(tc.price), platformMarkupPct)}
                            trainingVatPercent={platformVatPct}
                            footer={
                              !user ? (
                                <Button className="w-full font-semibold" asChild>
                                  <Link to={`/login?returnTo=${loginBookingReturn(tc.id)}`}>
                                    {isRTL ? "سجّل الدخول للحجز" : "Sign in to book"}
                                  </Link>
                                </Button>
                              ) : (
                                <Button className="w-full font-semibold gap-2" asChild>
                                  <Link to={bookingHref(tc.id)}>
                                    {isRTL ? "احجز مع هذا المدرب" : "Book this Trainer"}
                                    <BookIcon className="h-4 w-4 opacity-90" />
                                  </Link>
                                </Button>
                              )
                            }
                          />
                        );
                      })}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TrainingDetail;
