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
import LogoutConfirmDialog from '@/components/common/LogoutConfirmDialog';
import NotificationsDropdown from '@/components/admin/NotificationsDropdown';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  CreditCard,
  MousePointerClick,
  BarChart3,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronRight,
  ChevronLeft,
  FileText,
  MessageSquare,
  MessagesSquare,
  HelpCircle,
  Tag,
  Megaphone,
  Bike,
  Dumbbell,
  UserCheck,
  GraduationCap as GraduationCapIcon,
  StarIcon,
  Trophy,
  Gamepad2,
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.webp';
import logoLight from '@/assets/logo-light.png';
import { useTheme } from '@/components/ThemeProvider';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  href: string;
  badge?: number;
}

 const navItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: 'dashboard', href: '/admin' },
  { icon: BookOpen, labelKey: 'courses', href: '/admin/courses' },
  { icon: Users, labelKey: 'users', href: '/admin/users' },
  { icon: CreditCard, labelKey: 'payments', href: '/admin/payments' },
  { icon: MousePointerClick, labelKey: 'checkoutVisits', href: '/admin/checkout-visits' },
  { icon: Dumbbell, labelKey: 'trainings', href: '/admin/trainings' },
  { icon: UserCheck, labelKey: 'trainers', href: '/admin/trainers' },
  { icon: Bike, labelKey: 'bikeCatalog', href: '/admin/bike-catalog' },
  { icon: StarIcon, labelKey: 'ranks', href: '/admin/ranks' },
  { icon: Tag, labelKey: 'coupons', href: '/admin/coupons' },
  { icon: BarChart3, labelKey: 'analytics', href: '/admin/analytics' },
  { icon: FileText, labelKey: 'content', href: '/admin/content' },
  { icon: Megaphone, labelKey: 'ads', href: '/admin/ads' },
  { icon: Bike, labelKey: 'community', href: '/admin/community' },
  { icon: Trophy, labelKey: 'champions', href: '/admin/champions' },
  { icon: Gamepad2, labelKey: 'surveys', href: '/admin/surveys' },
  { icon: MessagesSquare, labelKey: 'discussions', href: '/admin/discussions' },
  { icon: MessageSquare, labelKey: 'support', href: '/admin/support' },
  { icon: Shield, labelKey: 'roles', href: '/admin/roles' },
  { icon: Settings, labelKey: 'settings', href: '/admin/settings' },
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const themeLogo = theme === 'light' ? logoDark : logoLight;
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
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — LTR: dock left; RTL: dock right (same pattern as learner Dashboard) */}
      <aside
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`fixed lg:sticky top-0 h-screen z-50 flex flex-col bg-card border-e border-border transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full'
        } lg:translate-x-0 ${isRTL ? 'right-0' : 'left-0'} ${sidebarCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {!sidebarCollapsed && (
            <Link to="/admin" className="flex items-center gap-2">
              <img
                src={themeLogo}
                alt="BIKERZ"
                width={80}
                height={32}
                className="h-6 sm:h-7 lg:h-8 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
            </Link>
          )}
          {sidebarCollapsed && (
            <Link to="/admin" className="mx-auto">
              <img
                src={themeLogo}
                alt="BIKERZ"
                width={80}
                height={24}
                className="h-6 w-auto object-contain"
                loading="eager"
                decoding="async"
              />
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

        {/* Navigation — RTL: icon on the right, label left of it; cluster toward inner edge (justify-end) */}
        <ScrollArea dir={isRTL ? 'rtl' : 'ltr'} className="flex-1 py-4">
          <nav className="space-y-1 px-3" dir={isRTL ? 'rtl' : 'ltr'}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActiveRoute(item.href);
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${sidebarCollapsed ? 'justify-center' : isRTL ? 'justify-end' : 'justify-start'}`}
                  title={sidebarCollapsed ? t(`admin.menu.${item.labelKey}`) : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
                  {!sidebarCollapsed && (
                    <span className="min-w-0 font-medium">
                      {t(`admin.menu.${item.labelKey}`)}
                    </span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="ms-auto shrink-0 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle — logical end of sidebar strip */}
        <div className="hidden lg:flex justify-end border-t border-border p-2">
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <h1 className="text-lg font-semibold text-foreground hidden sm:block">
              {t('admin.dashboard.title')}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageToggle />
            
            <NotificationsDropdown />

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
                <LogoutConfirmDialog onConfirm={handleSignOut}>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <LogOut className="w-4 h-4 me-2" />
                    {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                  </DropdownMenuItem>
                </LogoutConfirmDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
