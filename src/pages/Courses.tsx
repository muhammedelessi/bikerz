import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Play, Clock, BookOpen, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import heroImage from '@/assets/hero-rider.jpg';

interface Course {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  thumbnail_url: string | null;
  duration_hours: number | null;
  total_lessons: number | null;
  difficulty_level: string;
  price: number;
  is_published: boolean;
}

const Courses: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Course[];
    },
  });

  const getDifficultyLabel = (level: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      beginner: { en: 'Beginner', ar: 'مبتدئ' },
      intermediate: { en: 'Intermediate', ar: 'متوسط' },
      advanced: { en: 'Advanced', ar: 'متقدم' },
    };
    return isRTL ? labels[level]?.ar || level : labels[level]?.en || level;
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return isRTL ? '0س' : '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-20 sm:pt-24 lg:pt-28">
        {/* Header */}
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8 sm:mb-10 lg:mb-12"
          >
            <h1 className="section-title text-foreground mb-3 sm:mb-4">
              {t('nav.courses')}
            </h1>
            <p className="section-subtitle">
              {isRTL 
                ? 'اختر دورتك وابدأ رحلتك نحو إتقان ركوب الدراجات النارية'
                : 'Choose your course and begin your journey to motorcycle mastery'}
            </p>
          </motion.div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && courses.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? 'لا توجد دورات متاحة حالياً' : 'No courses available'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {isRTL 
                  ? 'لم يتم نشر أي دورات بعد. يرجى العودة لاحقاً.'
                  : 'No courses have been published yet. Please check back later.'}
              </p>
            </div>
          )}

          {/* Courses Grid - Single column on mobile */}
          {!isLoading && courses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              {courses.map((course, index) => {
                const title = isRTL && course.title_ar ? course.title_ar : course.title;
                const description = isRTL && course.description_ar ? course.description_ar : course.description;
                
                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Link to={`/courses/${course.id}`}>
                      <div className="group card-premium overflow-hidden transition-all duration-500 hover:border-primary/40">
                        {/* Image */}
                        <div className="relative h-40 sm:h-48 overflow-hidden">
                          <img
                            src={course.thumbnail_url || heroImage}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                          <div className="absolute top-3 sm:top-4 end-3 sm:end-4">
                            <span className="px-2.5 sm:px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground text-xs font-medium">
                              {getDifficultyLabel(course.difficulty_level)}
                            </span>
                          </div>
                          <div className="absolute bottom-3 sm:bottom-4 start-3 sm:start-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground ms-0.5" />
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-6">
                          <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
                            {title}
                          </h3>
                          <p className="text-muted-foreground text-sm mb-3 sm:mb-4 line-clamp-2">
                            {description}
                          </p>

                          {/* Meta */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4" />
                                <span>{course.total_lessons || 0} {isRTL ? 'درس' : 'lessons'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>{formatDuration(course.duration_hours)}</span>
                              </div>
                            </div>
                            <Chevron className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Courses;
