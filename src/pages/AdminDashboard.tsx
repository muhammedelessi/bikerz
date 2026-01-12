import React, { useState } from 'react';
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
  FileText,
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

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

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
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-card border-e border-border transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-primary-foreground font-black text-lg">R</span>
              </div>
              <div>
                <span className="text-lg font-bold text-foreground block">
                  {isRTL ? 'رايدر أكاديمي' : 'Rider Academy'}
                </span>
                <span className="text-xs text-primary">{t('admin.title')}</span>
              </div>
            </Link>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <Link to="/">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4 me-2" />
                {isRTL ? 'تسجيل الخروج' : 'Logout'}
              </Button>
            </Link>
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
              <h1 className="text-xl font-bold text-foreground capitalize">
                {navItems.find(n => n.id === activeTab)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <Button variant="cta" size="sm">
                <Plus className="w-4 h-4" />
                {t('admin.create')}
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="card-premium p-6"
                  >
                    <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                      <span className="text-xs text-green-500 font-medium">{stat.change}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Recent Users */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-foreground">
                    {isRTL ? 'المستخدمين الجدد' : 'Recent Users'}
                  </h2>
                  <Button variant="ghost" size="sm">
                    {isRTL ? 'عرض الكل' : 'View All'}
                    <Chevron className="w-4 h-4" />
                  </Button>
                </div>
                <div className="card-premium overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                          {isRTL ? 'الاسم' : 'Name'}
                        </th>
                        <th className="text-start p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">
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
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-xs font-bold text-secondary-foreground">
                                {user.name.charAt(0)}
                              </div>
                              <span className="font-medium text-foreground">{user.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground hidden sm:table-cell">{user.email}</td>
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
                            <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'courses' && (
            <div className="space-y-6">
              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={isRTL ? 'البحث في الدورات...' : 'Search courses...'}
                    className="ps-10"
                  />
                </div>
                <Button variant="cta">
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'إنشاء دورة' : 'Create Course'}
                </Button>
              </div>

              {/* Courses Table */}
              <div className="card-premium overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-start p-4 text-sm font-medium text-muted-foreground">
                        {isRTL ? 'الدورة' : 'Course'}
                      </th>
                      <th className="text-start p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">
                        {isRTL ? 'الطلاب' : 'Students'}
                      </th>
                      <th className="text-start p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">
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
                        <td className="p-4 text-muted-foreground hidden md:table-cell">{course.students}</td>
                        <td className="p-4 text-muted-foreground hidden sm:table-cell">{course.lessons}</td>
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
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="View">
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-muted transition-colors" title="Edit">
                              <Edit className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-destructive/10 transition-colors" title="Delete">
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
          )}

          {activeTab === 'users' && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? 'إدارة المستخدمين' : 'User Management'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL ? 'إدارة المستخدمين والأدوار والصلاحيات' : 'Manage users, roles, and permissions'}
              </p>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? 'التحليلات' : 'Analytics'}
              </h3>
              <p className="text-muted-foreground">
                {isRTL ? 'عرض الإحصائيات والتقارير التفصيلية' : 'View detailed statistics and reports'}
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">
                {isRTL ? 'الإعدادات' : 'Settings'}
              </h3>
              <p className="text-muted-foreground">
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
