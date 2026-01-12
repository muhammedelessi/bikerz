import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Play, Clock, BookOpen, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';
import instructorImage from '@/assets/instructor.jpg';
import heroImage from '@/assets/hero-rider.jpg';

const Courses: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Sample course data - will come from database later
  const courses = [
    {
      id: '1',
      title: isRTL ? 'أساسيات ركوب الدراجات النارية' : 'Motorcycle Riding Fundamentals',
      description: isRTL 
        ? 'تعلم أساسيات ركوب الدراجات النارية بأمان وثقة'
        : 'Learn the fundamentals of motorcycle riding with safety and confidence',
      image: heroImage,
      lessons: 12,
      duration: '4h 30m',
      level: isRTL ? 'مبتدئ' : 'Beginner',
    },
    {
      id: '2',
      title: isRTL ? 'التحكم والتوازن المتقدم' : 'Advanced Control & Balance',
      description: isRTL
        ? 'أتقن التحكم في الوقود والفرامل والتوازن في السرعات المنخفضة'
        : 'Master throttle control, braking, and low-speed balance',
      image: instructorImage,
      lessons: 15,
      duration: '6h 15m',
      level: isRTL ? 'متوسط' : 'Intermediate',
    },
    {
      id: '3',
      title: isRTL ? 'مهارات الطريق والمرور' : 'Road & Traffic Skills',
      description: isRTL
        ? 'تنقل في حركة المرور وتعامل مع التقاطعات بثقة'
        : 'Navigate traffic and handle intersections with confidence',
      image: heroImage,
      lessons: 18,
      duration: '7h 45m',
      level: isRTL ? 'متوسط' : 'Intermediate',
    },
    {
      id: '4',
      title: isRTL ? 'تقنيات القيادة المتقدمة' : 'Advanced Riding Techniques',
      description: isRTL
        ? 'انعطف كالمحترفين وتعامل مع الطوارئ'
        : 'Corner like a pro and handle emergency situations',
      image: instructorImage,
      lessons: 20,
      duration: '9h 00m',
      level: isRTL ? 'متقدم' : 'Advanced',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-24">
        {/* Header */}
        <section className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h1 className="section-title text-foreground mb-4">
              {t('nav.courses')}
            </h1>
            <p className="section-subtitle">
              {isRTL 
                ? 'اختر دورتك وابدأ رحلتك نحو إتقان ركوب الدراجات النارية'
                : 'Choose your course and begin your journey to motorcycle mastery'}
            </p>
          </motion.div>

          {/* Courses Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link to={`/courses/${course.id}`}>
                  <div className="group card-premium overflow-hidden transition-all duration-500 hover:border-primary/40">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={course.image}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                      <div className="absolute top-4 end-4">
                        <span className="px-3 py-1 rounded-full bg-secondary/80 backdrop-blur-sm text-secondary-foreground text-xs font-medium">
                          {course.level}
                        </span>
                      </div>
                      <div className="absolute bottom-4 start-4">
                        <div className="w-12 h-12 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform shadow-glow">
                          <Play className="w-5 h-5 text-primary-foreground ms-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {course.description}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" />
                            <span>{course.lessons} {isRTL ? 'درس' : 'lessons'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            <span>{course.duration}</span>
                          </div>
                        </div>
                        <Chevron className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Courses;
