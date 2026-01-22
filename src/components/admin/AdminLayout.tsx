import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import LanguageToggle from '@/components/common/LanguageToggle';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  CreditCard,
  BarChart3,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Bell,
  FileText,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import bikerzLogo from '@/assets/bikerz-logo.png';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  href: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelEn: 'Dashboard', labelAr: 'لوحة التحكم', href: '/admin' },
  { icon: BookOpen, labelEn: 'Courses', labelAr: 'الدورات', href: '/admin/courses' },
  { icon: Users, labelEn: 'Users', labelAr: 'المستخدمين', href: '/admin/users' },
  { icon: GraduationCap, labelEn: 'Instructors', labelAr: 'المدربين', href: '/admin/instructors' },
  { icon: CreditCard, labelEn: 'Payments', labelAr: 'المدفوعات', href: '/admin/payments' },
  { icon: BarChart3, labelEn: 'Analytics', labelAr: 'التحليلات', href: '/admin/analytics' },
  { icon: FileText, labelEn: 'Content', labelAr: 'المحتوى', href: '/admin/content' },
  { icon: MessageSquare, labelEn: 'Support', labelAr: 'الدعم', href: '/admin/support' },
  { icon: Shield, labelEn: 'Roles & Permissions', labelAr: 'الأدوار والصلاحيات', href: '/admin/roles' },
  { icon: Settings, labelEn: 'Settings', labelAr: 'الإعدادات', href: '/admin/settings' },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const CollapseIcon = isRTL ? ChevronRight : ChevronLeft;
  const ExpandIcon = isRTL ? ChevronLeft : ChevronRight;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActiveRoute = (href: string) => {
    if (href === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(href);
  };

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
        className={`fixed lg:sticky top-0 h-screen z-50 bg-card border-e border-border flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
        } lg:translate-x-0 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!sidebarCollapsed && (
            <Link to="/admin" className="flex items-center gap-2">
              <img src={bikerzLogo} alt="BIKERZ" className="h-10" />
            </Link>
          )}
          {sidebarCollapsed && (
            <Link to="/admin" className="mx-auto">
              <img src={bikerzLogo} alt="BIKERZ" className="h-8" />
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${sidebarCollapsed ? 'justify-center' : ''}`}
                  title={sidebarCollapsed ? (isRTL ? item.labelAr : item.labelEn) : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium">
                      {isRTL ? item.labelAr : item.labelEn}
                    </span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="ms-auto bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle */}
        <div className="hidden lg:flex justify-end p-2 border-t border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8"
          >
            {sidebarCollapsed ? <ExpandIcon className="w-4 h-4" /> : <CollapseIcon className="w-4 h-4" />}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <h1 className="text-lg font-semibold text-foreground hidden sm:block">
              {isRTL ? 'لوحة تحكم المشرف' : 'Admin Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageToggle />
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -end-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">
                    {user?.email?.split('@')[0] || 'Admin'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'} className="w-56">
                <DropdownMenuLabel>
                  {isRTL ? 'حسابي' : 'My Account'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/settings">
                    <Settings className="w-4 h-4 me-2" />
                    {isRTL ? 'الإعدادات' : 'Settings'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <HelpCircle className="w-4 h-4 me-2" />
                    {isRTL ? 'عرض الموقع' : 'View Site'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4 me-2" />
                  {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
