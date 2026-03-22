import React from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import CourseCard from "@/components/course/CourseCard";

const FeaturedCoursesSection: React.FC = () => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["featured-courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id, title, title_ar, description, description_ar,
          thumbnail_url, difficulty_level, price, discount_percentage,
          discount_expires_at, base_rating, base_review_count,
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

  if (!isLoading && courses.length === 0) return null;

  return (
    <section ref={ref} className="relative py-10 sm:py-16 lg:py-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/40 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.08),transparent)]" />

      <div className="section-container relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 sm:mb-14"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-5"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {isRTL ? "الأكثر طلباً" : "Most Popular"}
            </span>
          </motion.div>

          <h2 className="section-title text-foreground mb-3 sm:mb-4">
            {isRTL ? "دوراتنا التدريبية" : "Our Training Courses"}
          </h2>
          <p className="section-subtitle max-w-xl mx-auto">
            {isRTL
              ? "اختر الدورة المناسبة لمستواك وابدأ رحلتك اليوم"
              : "Choose the course that fits your level and start your riding journey today"}
          </p>
        </motion.div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
              ))
            : courses.map((course: any, index: number) => (
                <CourseCard key={course.id} course={course} index={index} inView={inView} />
              ))}
        </div>

        {/* View all button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center mt-10 sm:mt-14"
        >
          <Link to="/courses">
            <Button variant="outline" size="lg" className="group border-primary/30 hover:border-primary/60 hover:bg-primary/5">
              {isRTL ? "عرض جميع الدورات" : "View All Courses"}
              <Arrow className="w-4 h-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedCoursesSection;
