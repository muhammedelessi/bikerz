import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import LocalizedLink from "@/components/common/LocalizedLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { BookOpen, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/common/SEOHead";
import CourseCard from "@/components/course/CourseCard";
import { fetchEnrollmentsWithLiveProgress, type EnrollmentWithProgress } from "@/lib/enrollmentProgress";
import PromoPopup from "@/components/common/PromoPopup";
import { Button } from "@/components/ui/button";

const CourseCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-border/60 bg-card/85 backdrop-blur-sm overflow-hidden">
    <div className="relative aspect-video overflow-hidden w-full bg-muted/50">
      <div className="absolute inset-0 p-2">
        <div className="relative w-full h-full rounded-xl bg-muted/60 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent dark:via-white/5 animate-shimmer"
            aria-hidden
          />
        </div>
      </div>
    </div>

    <div className="p-4 sm:p-5 flex flex-col gap-3">
      <div className="h-7 sm:h-8 w-[92%] max-w-xl bg-muted/60 rounded-lg animate-pulse" />
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-6 w-[4.5rem] bg-muted/50 rounded-full animate-pulse" />
        <div className="h-6 w-24 bg-muted/50 rounded-full animate-pulse" />
        <div className="h-6 w-20 bg-muted/40 rounded-full animate-pulse" />
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <div className="h-8 w-28 bg-muted/60 rounded-lg animate-pulse" />
          <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-muted/40 rounded-lg shrink-0 animate-pulse" />
      </div>
      <div className="h-11 w-full bg-primary/15 rounded-lg animate-pulse" />
    </div>
  </div>
);

const Courses: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["courses-with-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(
          `
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, is_published,
          discount_percentage, discount_expires_at, vat_percentage,
          preview_video_thumbnail,
          base_rating, base_review_count,
          preview_video_url, preview_video_thumbnail,
          chapters (
            id, is_published,
            lessons ( id, duration_minutes, is_published, is_free )
          )
        `,
        )
        .eq("is_published", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data || []).map((course: any) => {
        let lessonCount = 0;
        let totalMinutes = 0;
        let freeLessonCount = 0;
        (course.chapters || []).forEach((chapter: any) => {
          if (chapter.is_published) {
            (chapter.lessons || []).forEach((lesson: any) => {
              if (lesson.is_published) {
                lessonCount++;
                totalMinutes += lesson.duration_minutes || 0;
                if (lesson.is_free) freeLessonCount++;
              }
            });
          }
        });
        return { ...course, lessonCount, totalMinutes, freeLessonCount };
      });
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

  const handlePlayVideo = useCallback((id: string) => setActiveVideoId((prev) => (prev === id ? null : id)), []);

  return (
    <>
      <PromoPopup trigger="scroll" />
      <div className="min-h-screen bg-background">
        <SEOHead
          title="Motorcycle Riding Courses"
          description="Browse our expert-led motorcycle riding courses. From beginner basics to advanced techniques, find the perfect course to boost your riding skills."
          canonical="/courses"
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Courses", url: "/courses" },
          ]}
        />
        <Navbar />

        <main className="pt-[var(--navbar-h)]">
          <section className="section-container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-12"
            >
              <h1 className="section-title text-foreground mb-3 sm:mb-4">{t("courses.title")}</h1>
              <p className="section-subtitle">{t("courses.subtitle")}</p>
            </motion.div>

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CourseCardSkeleton key={i} />
                ))}
              </div>
            )}

            {!isLoading && courses.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{t("courses.noCourses")}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">{t("courses.noCoursesDescription")}</p>
              </div>
            )}

            {!isLoading && courses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
                {courses.map((course: any, index: number) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    index={index}
                    enrollment={getEnrollment(course.id)}
                    activeVideoId={activeVideoId}
                    onPlayVideo={handlePlayVideo}
                    imageLoading={index < 3 ? "eager" : "lazy"}
                    imageFetchPriority={index === 0 ? "high" : "auto"}
                  />
                ))}
              </div>
            )}

            {!isLoading && courses.length > 0 && (
              <div className="mt-16 space-y-4">
                <div className="text-center sm:text-start space-y-1">
                  <h2 className="text-xl font-bold flex items-center justify-center sm:justify-start gap-2">
                    <Gift className="w-6 h-6 text-primary" />
                    {isRTL ? "اصنع باقتك الخاصة" : "Build your bundle"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "وفّر أموالك عند شراء أكثر من كورس في صفحة الباقات"
                      : "Save money when buying multiple courses from the bundles page"}
                  </p>
                </div>
                <div className="flex justify-center sm:justify-start">
                  <Button asChild size="lg" className="px-8">
                    <LocalizedLink to="/bundles">{isRTL ? "اصنع باقتك ووفر أموالك" : "Build your bundle and save"}</LocalizedLink>
                  </Button>
                </div>
              </div>
            )}
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Courses;
