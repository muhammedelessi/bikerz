import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import LanguageToggle from '@/components/common/LanguageToggle';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Search,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import bikerzLogo from '@/assets/bikerz-logo.png';

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
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

  const navItems = [
    { id: 'overview', icon: LayoutDashboard, label: isRTL ? 'نظرة عامة' : 'Overview' },
    { id: 'users', icon: Users, label: t('admin.users') },
    { id: 'courses', icon: BookOpen, label: t('admin.courses') },
    { id: 'analytics', icon: BarChart3, label: t('admin.analytics') },
    { id: 'settings', icon: Settings, label: t('admin.settings') },
  ];

  // Sample data
  const stats = [
    { label: isRTL ? 'إجمالي المستخدمين' : 'Total Users', value: '15,234', change: '+12%' },
    { label: isRTL ? 'المتعلمين النشطين' : 'Active Learners', value: '1,547', change: '+8%' },
    { label: isRTL ? 'الدورات' : 'Courses', value: '12', change: '+2' },
    { label: isRTL ? 'معدل الإكمال' : 'Completion Rate', value: '67%', change: '+5%' },
  ];

  const recentUsers = [
    { name: 'Ahmed Al-Rashid', email: 'ahmed@example.com', status: 'active', joined: '2 days ago' },
    { name: 'Fatima Hassan', email: 'fatima@example.com', status: 'active', joined: '3 days ago' },
    { name: 'Mohammed Ali', email: 'mohammed@example.com', status: 'pending', joined: '5 days ago' },
    { name: 'Sara Ahmed', email: 'sara@example.com', status: 'active', joined: '1 week ago' },
  ];

  const courses = [
    { id: '1', title: 'Motorcycle Fundamentals', students: 523, lessons: 12, status: 'published' },
    { id: '2', title: 'Advanced Control', students: 312, lessons: 15, status: 'published' },
    { id: '3', title: 'Road & Traffic Skills', students: 189, lessons: 18, status: 'draft' },
    { id: '4', title: 'Advanced Techniques', students: 0, lessons: 20, status: 'draft' },
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
            <Link to="/" className="flex items-center gap-2">
              <img
                src={bikerzLogo}
                alt="BIKERZ"
                className="h-8 sm:h-10 w-auto object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
              <span className="text-xs text-primary">{t('admin.title')}</span>
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
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-lg transition-all duration-300 touch-target ${
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground active:bg-muted/70'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-3 sm:p-4 border-t border-border">
            <Link to="/">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive touch-target">
                <LogOut className="w-4 h-4 me-2" />
                {isRTL ? 'تسجيل الخروج' : 'Logout'}
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ms-[280px] min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
          <div className="flex items-center justify-between p-3 sm:p-4 gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors touch-target flex-shrink-0"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-foreground capitalize truncate">
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <LanguageToggle />
              <Button variant="cta" size="sm" className="hidden sm:flex">
                <Plus className="w-4 h-4" />
                <span className="hidden md:inline">{t('admin.create')}</span>
              </Button>
              <Button variant="cta" size="icon" className="sm:hidden touch-target">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 sm:p-6 safe-area-bottom">
          {activeTab === 'overview' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="card-premium p-4 sm:p-6"
                  >
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">{stat.label}</p>
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">{stat.value}</p>
                      <span className="text-xs text-green-500 font-medium flex-shrink-0">{stat.change}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Recent Users */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-foreground">
                    {isRTL ? 'المستخدمين الجدد' : 'Recent Users'}
                  </h2>
                  <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                    {isRTL ? 'عرض الكل' : 'View All'}
                    <Chevron className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Desktop Table */}
                <div className="card-premium overflow-hidden hidden md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                            {isRTL ? 'الاسم' : 'Name'}
                          </th>
                          <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                            {isRTL ? 'البريد' : 'Email'}
                          </th>
                          <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                            {isRTL ? 'الحالة' : 'Status'}
                          </th>
                          <th className="text-end p-4 text-sm font-medium text-muted-foreground">
                            {isRTL ? 'الإجراءات' : 'Actions'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentUsers.map((user, index) => (
                          <tr key={index} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-xs font-bold text-secondary-foreground flex-shrink-0">
                                  {user.name.charAt(0)}
                                </div>
                                <span className="font-medium text-foreground">{user.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">{user.email}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                user.status === 'active' 
                                  ? 'bg-green-500/10 text-green-500' 
                                  : 'bg-yellow-500/10 text-yellow-500'
                              }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="p-4 text-end">
                              <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {recentUsers.map((user, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="card-premium p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-sm font-bold text-secondary-foreground flex-shrink-0">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                        <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target flex-shrink-0">
                          <MoreVertical className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === 'active' 
                            ? 'bg-green-500/10 text-green-500' 
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {user.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.joined}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={isRTL ? 'البحث في الدورات...' : 'Search courses...'}
                    className="ps-10"
                  />
                </div>
                <Button variant="cta" className="w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'إنشاء دورة' : 'Create Course'}
                </Button>
              </div>

              {/* Desktop Table */}
              <div className="card-premium overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الدورة' : 'Course'}
                        </th>
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الطلاب' : 'Students'}
                        </th>
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الدروس' : 'Lessons'}
                        </th>
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الحالة' : 'Status'}
                        </th>
                        <th className="text-end p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الإجراءات' : 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="p-4">
                            <span className="font-medium text-foreground">{course.title}</span>
                          </td>
                          <td className="p-4 text-muted-foreground">{course.students}</td>
                          <td className="p-4 text-muted-foreground">{course.lessons}</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              course.status === 'published' 
                                ? 'bg-green-500/10 text-green-500' 
                                : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {course.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-1">
                              <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target" title="View">
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </button>
                              <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target" title="Edit">
                                <Edit className="w-4 h-4 text-muted-foreground" />
                              </button>
                              <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors touch-target" title="Delete">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {courses.map((course, index) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="card-premium p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{course.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{course.students} {isRTL ? 'طالب' : 'students'}</span>
                          <span>•</span>
                          <span>{course.lessons} {isRTL ? 'درس' : 'lessons'}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                        course.status === 'published' 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {course.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-1 pt-3 border-t border-border/50">
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target" title="View">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors touch-target" title="Edit">
                        <Edit className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors touch-target" title="Delete">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="text-center py-12 px-4">
              <Users className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                {isRTL ? 'إدارة المستخدمين' : 'User Management'}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {isRTL ? 'إدارة المستخدمين والأدوار والصلاحيات' : 'Manage users, roles, and permissions'}
              </p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="text-center py-12 px-4">
              <BarChart3 className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                {isRTL ? 'التحليلات' : 'Analytics'}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {isRTL ? 'عرض الإحصائيات والتقارير التفصيلية' : 'View detailed statistics and reports'}
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="text-center py-12 px-4">
              <Settings className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                {isRTL ? 'الإعدادات' : 'Settings'}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {isRTL ? 'تخصيص إعدادات المنصة' : 'Customize platform settings'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
