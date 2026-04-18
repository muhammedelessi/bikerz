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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Clock, GraduationCap, Users, Wrench } from "lucide-react";
import type { TrainerCourseRow } from "@/lib/trainingBookingUtils";
import { translateTrainerCourseLocation } from "@/lib/trainerCourseLocation";
import { COUNTRIES } from "@/data/countryCityData";
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
  const platformVatPct = pricing?.vatPercent ?? 0;

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
  const { data: students = [] } = useQuery({
    queryKey: ["training-students-public", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("training_bookings")
        .select("id, full_name, created_at, status, trainers(name_ar, name_en, photo_url)")
        .eq("training_id", id!)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });
      return data || [];
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
              <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden mb-8">
                {training.background_image ? (
                  <img
                    src={training.background_image}
                    alt={trainingTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Wrench className="w-20 h-20 text-primary/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-6">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary">
                      {training.type === "theory" ? (isRTL ? "نظري" : "Theory") : (isRTL ? "عملي" : "Practical")}
                    </Badge>
                    <Badge variant="outline" className={level.color}>
                      {isRTL ? level.label.ar : level.label.en}
                    </Badge>
                    {(curriculumSessions.length > 0 || Number(training.default_sessions_count) > 0) && (
                      <Badge variant="outline" className="bg-background/50">
                        <Clock className="w-3 h-3 me-1" />
                        {curriculumSessions.length || training.default_sessions_count} {isRTL ? "جلسات" : "sessions"}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">
                    {trainingTitle}
                  </h1>
                </div>
              </div>

              {(isRTL ? training.description_ar : training.description_en) && (
                <p className="text-muted-foreground leading-relaxed mb-8 text-sm sm:text-base max-w-3xl">
                  {isRTL ? training.description_ar : training.description_en}
                </p>
              )}

              <section className="space-y-8">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {isRTL ? "المعلومات" : "Information"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
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

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold">
                          {isRTL ? "تفاصيل الجلسات" : "Session Details"}
                        </h3>
                        <Badge variant="secondary">{curriculumSessions.length}</Badge>
                      </div>
                      {curriculumSessions.length > 0 ? (
                        <TrainingCurriculumAccordion
                          sessions={curriculumSessions}
                          isRTL={isRTL}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? "لا توجد تفاصيل جلسات متاحة حالياً." : "No session details available yet."}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

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
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                        {isRTL ? "المدربون المتاحون" : "Available trainers"}
                      </h2>
                      <Badge variant="secondary">{trainerCourses.length}</Badge>
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
                          const sess = curriculumSessions.length > 0
                            ? curriculumSessions.length
                            : Math.max(1, Number(tc.sessions_count ?? 1));
                          const hours = curriculumSessions.length > 0
                            ? Math.round((curriculumSessions.reduce((sum, s) => sum + s.duration_hours, 0) / curriculumSessions.length) * 100) / 100
                            : Number(tc.duration_hours);
                          const locRaw = translateTrainerCourseLocation(tc.location, isRTL) || String(tc.location ?? "").trim();
                          const countryEntry = COUNTRIES.find((c) => c.code === tr.country || c.en === tr.country);
                          const cityEntry = countryEntry?.cities.find((c) => c.en === tr.city);
                          const trainerCityLine = [
                            cityEntry ? (isRTL ? cityEntry.ar : cityEntry.en) : tr.city,
                            countryEntry ? (isRTL ? countryEntry.ar : countryEntry.en) : tr.country,
                          ]
                            .filter(Boolean)
                            .join(isRTL ? "، " : ", ");
                          const headline = locRaw || trainerCityLine || null;
                          const bioPreview = String((isRTL ? tr.bio_ar : tr.bio_en) ?? "").trim() || null;
                          const yoe = Number(tr.years_of_experience);
                          const metaRows: { id: string; icon: "clock" | "gauge" | "map" | "users"; text: string }[] = [];
                          if (Number.isFinite(yoe) && yoe > 0) {
                            metaRows.push({
                              id: "exp",
                              icon: "clock",
                              text: isRTL
                                ? `${yoe} ${yoe === 1 ? "سنة خبرة" : "سنوات خبرة"}`
                                : `${yoe} ${yoe === 1 ? "year" : "years"} experience`,
                            });
                          }
                          metaRows.push({
                            id: "dur",
                            icon: "gauge",
                            text: isRTL
                              ? `${sess} ${sess === 1 ? "جلسة" : "جلسات"} · ${hours} ${hours === 1 ? "س/جلسة" : "ساعات/جلسة"}`
                              : `${sess} ${sess === 1 ? "session" : "sessions"} · ${hours} ${hours === 1 ? "hr/sess" : "hrs/sess"}`,
                          });
                          const BookIcon = isRTL ? ChevronLeft : ChevronRight;
                          return (
                            <TrainerShowcaseCard
                              key={tc.id}
                              trainer={{ name_ar: tr.name_ar, name_en: tr.name_en, photo_url: tr.photo_url }}
                              isRTL={isRTL}
                              reviewStats={stats && stats.count > 0 ? stats : null}
                              headline={headline}
                              subHeadline={(tc as { location_detail?: string }).location_detail || null}
                              bioPreview={bioPreview}
                              profileHref={`/trainers/${tr.id}`}
                              metaRows={metaRows}
                              priceSar={applyTrainingPlatformMarkupSar(Number(tc.price), platformMarkupPct)}
                              trainingVatPercent={platformVatPct}
                              className="h-full border-border/60 shadow-sm hover:border-primary/40 hover:shadow-lg transition-shadow"
                              footer={
                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                  <Button variant="outline" size="sm" className="w-full sm:flex-1 font-semibold" asChild>
                                    <Link to={`/trainers/${tr.id}`}>{isRTL ? "عرض الملف" : "View Profile"}</Link>
                                  </Button>
                                  {!user ? (
                                    <Button className="w-full sm:flex-1 font-semibold" asChild>
                                      <Link to={`/login?returnTo=${loginBookingReturn(tc.id)}`}>
                                        {isRTL ? "سجّل الدخول للحجز" : "Sign in to book"}
                                      </Link>
                                    </Button>
                                  ) : (
                                    <Button className="w-full sm:flex-1 font-semibold gap-2" asChild>
                                      <Link to={bookingHref(tc.id)}>
                                        {isRTL ? "احجز مع هذا المدرب" : "Book this Trainer"}
                                        <BookIcon className="h-4 w-4 opacity-90" />
                                      </Link>
                                    </Button>
                                  )}
                                </div>
                              }
                            />
                          );
                        })}
                    </div>
                  </section>
                )}

                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                      {isRTL ? "الطلاب المنضمون" : "Enrolled Students"}
                    </h2>
                    <Badge variant="secondary">{students.length}</Badge>
                  </div>
                  {students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <Users className="w-12 h-12 text-muted-foreground/30" />
                      <p className="text-muted-foreground">
                        {isRTL ? "لا يوجد طلاب منضمون بعد" : "No students enrolled yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isRTL ? "كن أول من ينضم لهذا التدريب!" : "Be the first to join this training!"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {students.map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/60"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                              {s.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {isRTL
                                ? `انضم مع: ${s.trainers?.name_ar || "—"}`
                                : `Joined with: ${s.trainers?.name_en || "—"}`}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(s.created_at), isRTL ? "d MMM" : "MMM d", {
                              locale: isRTL ? ar : undefined,
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </section>
            </>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TrainingDetail;
