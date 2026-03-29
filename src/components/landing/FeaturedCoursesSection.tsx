import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/course/CourseCard";
import { fetchEnrollmentsWithLiveProgress } from "@/lib/enrollmentProgress";
import { useTranslation } from "react-i18next";

const FeaturedCoursesSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1, fallbackInView: true });
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const handlePlayVideo = useCallback((id: string) => setActiveVideoId(prev => prev === id ? null : id), []);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;
    let isDown = false;
    let startX = 0;
    let scrollLeftPos = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - slider.offsetLeft;
      scrollLeftPos = slider.scrollLeft;
    };
    const onMouseLeave = () => { isDown = false; };
    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      slider.scrollLeft = scrollLeftPos - (x - startX) * 1.5;
    };

    slider.addEventListener('mousedown', onMouseDown);
    slider.addEventListener('mouseleave', onMouseLeave);
    slider.addEventListener('mouseup', onMouseUp);
    slider.addEventListener('mousemove', onMouseMove);
    return () => {
      slider.removeEventListener('mousedown', onMouseDown);
      slider.removeEventListener('mouseleave', onMouseLeave);
      slider.removeEventListener('mouseup', onMouseUp);
      slider.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["featured-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, discount_percentage,
          discount_expires_at, base_rating, base_review_count,
          preview_video_url, preview_video_thumbnail,
          chapters (
            id, is_published,
            lessons ( id, duration_minutes, is_published )
          )
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: true })
        .limit(4);

      if (error) throw error;

      return (data || []).map((course: any) => {
        let lessonCount = 0;
        let totalMinutes = 0;
        (course.chapters || []).forEach((ch: any) => {
          if (ch.is_published) {
            (ch.lessons || []).forEach((l: any) => {
              if (l.is_published) {
                lessonCount++;
                totalMinutes += l.duration_minutes || 0;
              }
            });
          }
        });
        return { ...course, lessonCount, totalMinutes };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['user-enrollments-featured', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await fetchEnrollmentsWithLiveProgress(user.id);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const getEnrollment = (courseId: string) =>
    enrollments.find((e: any) => e.course_id === courseId);

  if (!isLoading && courses.length === 0) return null;

  return (
    <section ref={ref} className="relative py-4 sm:py-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/40 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="section-container relative z-10">
        {/* Header: title left, view all right */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between mb-6 sm:mb-8"
        >
          <div>
            <div className="w-10 h-1 rounded-full bg-primary mb-3" />
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight">
              {isRTL ? "دوراتنا الأكثر مبيعاً" : "Our Best-Selling Courses"}
            </h2>
          </div>
          <Link
            to="/courses"
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            {isRTL ? "عرض الكل" : "View All"}
            <Arrow className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Horizontal swipeable slider */}
        <div
          ref={sliderRef}
          className="featured-slider flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`
            .featured-slider::-webkit-scrollbar { display: none; }
          `}</style>
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-[calc(100%-40px)] sm:w-[calc(50%-40px)]"
                >
                  <Skeleton className="aspect-[4/3] rounded-2xl" />
                </div>
              ))
            : courses.map((course: any, index: number) => (
                <div
                  key={course.id}
                  className="snap-start shrink-0 w-[calc(100%-40px)] sm:w-[calc(50%-40px)]"
                >
                  <CourseCard
                    course={course}
                    index={index}
                    inView={inView}
                    enrollment={getEnrollment(course.id)}
                    activeVideoId={activeVideoId}
                    onPlayVideo={handlePlayVideo}
                  />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCoursesSection;
