import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LanguageToggle from '@/components/common/LanguageToggle';
import {
  BookOpen,
  Play,
  Clock,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Home,
  GraduationCap,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  User,
} from 'lucide-react';
import heroImage from '@/assets/hero-rider.jpg';
import instructorImage from '@/assets/instructor.jpg';
import bikerzLogo from '@/assets/bikerz-logo.png';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut, isAdmin, isInstructor } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Sample enrolled courses
  const enrolledCourses = [
    {
      id: '1',
      title: isRTL ? 'أساسيات ركوب الدراجات النارية' : 'Motorcycle Riding Fundamentals',
      progress: 65,
      image: heroImage,
      nextLesson: isRTL ? 'التحكم في الفرامل' : 'Brake Control',
    },
    {
      id: '2',
      title: isRTL ? 'التحكم والتوازن المتقدم' : 'Advanced Control & Balance',
      progress: 20,
      image: instructorImage,
      nextLesson: isRTL ? 'التوازن في السرعات المنخفضة' : 'Low-Speed Balance',
    },
  ];

  const navItems = [
    { icon: Home, label: t('nav.home'), to: '/' },
    { icon: BookOpen, label: t('nav.courses'), to: '/courses' },
    { icon: GraduationCap, label: t('dashboard.myCourses'), to: '/dashboard', active: true },
    { icon: Users, label: isRTL ? 'المدربون' : 'Mentors', to: '/mentors' },
    { icon: User, label: isRTL ? 'الملف الشخصي' : 'Profile', to: '/profile' },
    ...(isAdmin ? [{ icon: Settings, label: isRTL ? 'لوحة الإدارة' : 'Admin Panel', to: '/admin' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-50 w-[280px] max-w-[85vw] bg-card border-e border-border transform transition-transform duration-300 ease-out lg:translate-x-0 ${
          sidebarOpen 
            ? 'translate-x-0' 
            : isRTL 
              ? 'translate-x-full' 
              : '-translate-x-full'
        } ${isRTL ? 'right-0' : 'left-0'}`}
      >
        <div className="flex flex-col h-full safe-area-inset">
          {/* Logo */}
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between">
            <Link to="/" className="flex items-center">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-10 sm:h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 sm:space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3 rounded-lg transition-all duration-300 touch-target ${
                  item.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-3 sm:p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center flex-shrink-0">
                <span className="text-secondary-foreground font-bold">
                  {profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {profile?.full_name || (isRTL ? 'مستخدم' : 'User')}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-destructive touch-target"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 me-2" />
              {isRTL ? 'تسجيل الخروج' : 'Logout'}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ms-[280px] min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || (isRTL ? 'مستخدم' : 'User')}!
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  {isRTL ? 'استمر في التعلم' : 'Keep up the great work'}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 safe-area-bottom">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: BookOpen, value: '2', label: isRTL ? 'دورات مسجلة' : 'Enrolled Courses' },
              { icon: Clock, value: '12h', label: isRTL ? 'وقت التعلم' : 'Learning Time' },
              { icon: Trophy, value: '45%', label: isRTL ? 'التقدم الكلي' : 'Overall Progress' },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="card-premium p-4 sm:p-6"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Continue Learning */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
              {t('dashboard.continueLearning')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {enrolledCourses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                >
                  <Link to={`/courses/${course.id}/learn`}>
                    <div className="group card-premium p-3 sm:p-4 flex gap-3 sm:gap-4 transition-all duration-300 hover:border-primary/40 active:scale-[0.99]">
                      {/* Thumbnail */}
                      <div className="relative w-24 h-20 sm:w-32 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={course.image}
                          alt={course.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                            {course.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {isRTL ? 'التالي: ' : 'Next: '}{course.nextLesson}
                          </p>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1 mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{t('dashboard.progress')}</span>
                            <span className="text-primary font-medium">{course.progress}%</span>
                          </div>
                          <div className="progress-track">
                            <div
                              className="progress-fill"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <Chevron className="w-5 h-5 text-muted-foreground self-center opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
              {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Link to="/courses">
                <div className="card-premium p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-primary/40 active:scale-[0.99] transition-all touch-target">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-sm sm:text-base text-foreground">
                    {isRTL ? 'تصفح الدورات' : 'Browse Courses'}
                  </span>
                </div>
              </Link>
              <Link to="/mentors">
                <div className="card-premium p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:border-primary/40 active:scale-[0.99] transition-all touch-target">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="font-medium text-sm sm:text-base text-foreground">
                    {isRTL ? 'ابحث عن مدرب' : 'Find a Mentor'}
                  </span>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
