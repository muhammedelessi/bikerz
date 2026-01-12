import React, { useState } from 'react';
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
} from 'lucide-react';
import heroImage from '@/assets/hero-rider.jpg';
import instructorImage from '@/assets/instructor.jpg';
import bikerzLogo from '@/assets/bikerz-logo.png';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, signOut, isAdmin, isMentor } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

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
    ...(isAdmin ? [{ icon: Settings, label: isRTL ? 'لوحة الإدارة' : 'Admin Panel', to: '/admin' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-card border-e border-border transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  item.active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center">
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
              className="w-full justify-start text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 me-2" />
              {isRTL ? 'تسجيل الخروج' : 'Logout'}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ms-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t('dashboard.welcome')}, {profile?.full_name?.split(' ')[0] || (isRTL ? 'مستخدم' : 'User')}!
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isRTL ? 'استمر في التعلم' : 'Keep up the great work'}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className="card-premium p-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Continue Learning */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">
              {t('dashboard.continueLearning')}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {enrolledCourses.map((course, index) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                >
                  <Link to={`/courses/${course.id}/learn`}>
                    <div className="group card-premium p-4 flex gap-4 transition-all duration-300 hover:border-primary/40">
                      {/* Thumbnail */}
                      <div className="relative w-32 h-24 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={course.image}
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-primary-foreground" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {isRTL ? 'التالي: ' : 'Next: '}{course.nextLesson}
                        </p>

                        {/* Progress */}
                        <div className="space-y-1">
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

                      <Chevron className="w-5 h-5 text-muted-foreground self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">
              {isRTL ? 'إجراءات سريعة' : 'Quick Actions'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link to="/courses">
                <div className="card-premium p-4 flex items-center gap-4 hover:border-primary/40 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">
                    {isRTL ? 'تصفح الدورات' : 'Browse Courses'}
                  </span>
                </div>
              </Link>
              <Link to="/mentors">
                <div className="card-premium p-4 flex items-center gap-4 hover:border-primary/40 transition-all">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <span className="font-medium text-foreground">
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
