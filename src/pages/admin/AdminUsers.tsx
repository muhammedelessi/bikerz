import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Search,
  MoreVertical,
  Eye,
  UserX,
  UserCheck,
  Mail,
  Shield,
  GraduationCap,
  Users,
  Filter,
  MessageSquare,
  Download,
  KeyRound,
  Gift,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  bike_brand: string | null;
  bike_model: string | null;
  engine_size_cc: number | null;
  experience_level: string | null;
  riding_experience_years: number | null;
  rider_nickname: string | null;
  profile_complete: boolean;
  created_at: string;
}

interface UserRole {
  role: string;
}

interface UserWithDetails extends Profile {
  roles: UserRole[];
  enrollmentCount: number;
  email?: string;
}

// Small helper for the detail dialog
const InfoItem = ({ label, value }: { label: string; value: string | null }) => (
  <div className="p-3 rounded-lg bg-muted/50">
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm font-medium text-foreground">{value || '—'}</p>
  </div>
);

const AdminUsers: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [enrollmentFilter, setEnrollmentFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>('student');
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserWithDetails | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isFreeCourseDialogOpen, setIsFreeCourseDialogOpen] = useState(false);
  const [freeCourseUser, setFreeCourseUser] = useState<UserWithDetails | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [isGrantingCourse, setIsGrantingCourse] = useState(false);

  // Fetch all published courses for the free course dialog
  const { data: allCourses = [] } = useQuery({
    queryKey: ['admin-all-courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .eq('is_published', true)
        .order('title');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users with roles
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch enrollment counts – paginate to bypass the 1000-row default limit
      const enrollments: { user_id: string }[] = [];
      let enrollPage = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data: batch, error: enrollError } = await supabase
          .from('course_enrollments')
          .select('user_id')
          .range(enrollPage * PAGE_SIZE, (enrollPage + 1) * PAGE_SIZE - 1);
        if (enrollError) throw enrollError;
        if (!batch || batch.length === 0) break;
        enrollments.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        enrollPage++;
      }

      // Fetch emails from auth via secure function
      const { data: emailRows } = await supabase.rpc('get_all_user_emails');

      const emailMap = new Map<string, string>();
      (emailRows || []).forEach((row: any) => {
        if (row.email) {
          emailMap.set(row.user_id, row.email);
        }
      });

      // Combine data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const userRoles = (roles || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => ({ role: r.role }));
        
        const enrollmentCount = (enrollments || [])
          .filter(e => e.user_id === profile.user_id).length;

        return {
          ...profile,
          roles: userRoles,
          enrollmentCount,
          email: emailMap.get(profile.user_id) || undefined,
        };
      });

      return usersWithDetails;
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId,
        role: role as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsRoleDialogOpen(false);
      toast.success(t('admin.users.roleAddedSuccess'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('admin.users.roleAddFailed'));
    },
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (user.full_name?.toLowerCase().includes(q)) ||
      (user.email?.toLowerCase().includes(q)) ||
      (user.phone?.toLowerCase().includes(q)) ||
      user.user_id.includes(searchQuery);
    
    const matchesRole = roleFilter === 'all' || 
      user.roles.some(r => r.role === roleFilter);

    const matchesEnrollment = enrollmentFilter === 'all' ||
      (enrollmentFilter === 'enrolled' && user.enrollmentCount > 0) ||
      (enrollmentFilter === 'not_enrolled' && user.enrollmentCount === 0);
    
    return matchesSearch && matchesRole && matchesEnrollment;
  });

  const exportToCSV = () => {
    const headers = [
      isRTL ? 'الاسم' : 'Name',
      isRTL ? 'البريد' : 'Email',
      isRTL ? 'الهاتف' : 'Phone',
      isRTL ? 'المدينة' : 'City',
      isRTL ? 'الدولة' : 'Country',
      isRTL ? 'الأدوار' : 'Roles',
      isRTL ? 'الدورات المسجلة' : 'Enrollments',
      isRTL ? 'تاريخ الانضمام' : 'Joined',
    ];
    const rows = filteredUsers.map(u => [
      u.full_name || '',
      u.email || '',
      u.phone || '',
      u.city || '',
      u.country || '',
      u.roles.map(r => r.role).join(', '),
      u.enrollmentCount,
      format(new Date(u.created_at), 'dd/MM/yyyy'),
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully');
  };

  const getRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      super_admin: 'bg-red-500/10 text-red-500',
      academy_admin: 'bg-purple-500/10 text-purple-500',
      instructor: 'bg-blue-500/10 text-blue-500',
      moderator: 'bg-amber-500/10 text-amber-500',
      finance: 'bg-green-500/10 text-green-500',
      support: 'bg-cyan-500/10 text-cyan-500',
      student: 'bg-gray-500/10 text-gray-500',
    };

    const roleLabels: Record<string, string> = {
      super_admin: t('admin.users.roles_labels.super_admin'),
      academy_admin: t('admin.users.roles_labels.academy_admin'),
      instructor: t('admin.users.roles_labels.instructor'),
      moderator: t('admin.users.roles_labels.moderator'),
      finance: t('admin.users.roles_labels.finance'),
      support: t('admin.users.roles_labels.support'),
      student: t('admin.users.roles_labels.student'),
    };


    return (
      <Badge className={roleStyles[role] || 'bg-gray-500/10 text-gray-500'}>
        {roleLabels[role] || role}
      </Badge>
    );
  };

  const openUserDetail = (user: UserWithDetails) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const openRoleDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setNewRole('student');
    setIsRoleDialogOpen(true);
  };

  return (
    <AdminLayout>
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('admin.users.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('admin.users.subtitle')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.users.totalUsers')}</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <GraduationCap className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.users.students')}</p>
              <p className="text-2xl font-bold">
                {users.filter(u => u.roles.some(r => r.role === 'student')).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.users.admins')}</p>
              <p className="text-2xl font-bold">
                {users.filter(u => u.roles.some(r => ['super_admin', 'academy_admin'].includes(r.role))).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('admin.users.instructors')}</p>
              <p className="text-2xl font-bold">
                {users.filter(u => u.roles.some(r => r.role === 'instructor')).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 me-2" />
                <SelectValue placeholder={t('admin.users.role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.users.all')}</SelectItem>
                <SelectItem value="student">{t('admin.users.roles_labels.student')}</SelectItem>
                <SelectItem value="instructor">{t('admin.users.roles_labels.instructor')}</SelectItem>
                <SelectItem value="super_admin">{t('admin.users.roles_labels.super_admin')}</SelectItem>
                <SelectItem value="academy_admin">{t('admin.users.roles_labels.academy_admin')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={enrollmentFilter} onValueChange={setEnrollmentFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <GraduationCap className="w-4 h-4 me-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'حالة الاشتراك' : 'Enrollment Status'}</SelectItem>
                <SelectItem value="enrolled">{isRTL ? 'مشتركين بدورات' : 'Enrolled'}</SelectItem>
                <SelectItem value="not_enrolled">{isRTL ? 'غير مشتركين' : 'Not Enrolled'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="w-4 h-4" />
              {isRTL ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t('admin.users.noUsersFound')}
              </h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.users.user')}</TableHead>
                  <TableHead>{t('admin.users.email')}</TableHead>
                  <TableHead>{t('admin.users.location')}</TableHead>
                  <TableHead>{t('admin.users.roles')}</TableHead>
                  <TableHead>{t('admin.users.enrollments')}</TableHead>
                  <TableHead>{t('admin.users.joined')}</TableHead>
                  <TableHead className="text-end">{t('admin.users.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || ''} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">
                            {user.full_name || t('admin.users.noName')}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.phone || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">{user.email || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground">{[user.city, user.country].filter(Boolean).join(', ') || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((r, i) => (
                            <span key={i}>{getRoleBadge(r.role)}</span>
                          ))
                        ) : (
                          <Badge variant="outline">{t('admin.users.noRole')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.enrollmentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-1">
                        {user.phone && (
                          <a
                            href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={isRTL ? 'تواصل عبر واتساب' : 'Contact on WhatsApp'}
                          >
                            <Button variant="ghost" size="icon" className="text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10">
                              <svg viewBox="0 0 32 32" className="w-5 h-5" fill="currentColor">
                                <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.132 6.744 3.058 9.378L1.058 31.14l5.962-1.966c2.518 1.656 5.518 2.622 8.734 2.622h.008c8.822 0 15.996-7.18 15.996-16.008C31.758 7.176 24.826 0 16.004 0zm9.466 22.616c-.396 1.116-2.328 2.076-3.21 2.21-.882.132-2.004.188-3.234-.204a29.48 29.48 0 01-2.928-1.082c-5.152-2.228-8.516-7.45-8.776-7.798-.258-.348-2.112-2.812-2.112-5.364 0-2.554 1.336-3.808 1.812-4.33.476-.52 1.04-.65 1.386-.65.346 0 .694.004 1 .018.32.014.75-.122 1.172.894.432 1.04 1.466 3.578 1.594 3.836.128.26.214.562.042.906-.172.346-.258.562-.516.866-.258.304-.542.678-.774.91-.258.26-.528.542-.228 1.062.302.52 1.338 2.21 2.874 3.58 1.974 1.76 3.638 2.306 4.158 2.566.52.258.826.216 1.128-.13.304-.346 1.3-1.518 1.646-2.04.346-.52.694-.432 1.172-.258.476.172 3.022 1.424 3.542 1.684.52.258.866.39.994.606.128.214.128 1.244-.268 2.36z" />
                              </svg>
                            </Button>
                          </a>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                            <DropdownMenuLabel>{t('admin.users.actions')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openUserDetail(user)}>
                              <Eye className="w-4 h-4 me-2" />
                              {t('admin.users.viewDetails')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                              <Shield className="w-4 h-4 me-2" />
                              {t('admin.users.manageRoles')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPasswordUser(user);
                                setNewPassword('');
                                setIsPasswordDialogOpen(true);
                              }}
                            >
                              <KeyRound className="w-4 h-4 me-2" />
                              {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="w-4 h-4 me-2" />
                              {t('admin.users.sendEmail')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageSquare className="w-4 h-4 me-2" />
                              {t('admin.users.addNote')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setFreeCourseUser(user);
                                setSelectedCourseId('');
                                setIsFreeCourseDialogOpen(true);
                              }}
                            >
                              <Gift className="w-4 h-4 me-2" />
                              {isRTL ? 'منح دورة مجانية' : 'Grant Free Course'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <UserX className="w-4 h-4 me-2" />
                              {t('admin.users.suspendUser')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.users.userDetails')}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {selectedUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedUser.full_name || t('admin.users.noName')}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email || 'No email'}</p>
                  <div className="flex gap-1 mt-2">
                    {selectedUser.roles.map((r, i) => (
                      <span key={i}>{getRoleBadge(r.role)}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {t('admin.users.personalInformation')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={t('admin.users.fullName')} value={selectedUser.full_name} />
                  <InfoItem label={t('admin.users.nickname')} value={selectedUser.rider_nickname} />
                  <InfoItem label={t('admin.users.phone')} value={selectedUser.phone} />
                  <InfoItem label={t('admin.users.phoneVerified')} value={selectedUser.phone_verified ? (t('common.yes') + ' \u2713') : (t('common.no') + ' \u2717')} />
                  <InfoItem label={t('admin.users.email')} value={selectedUser.email || null} />
                  <InfoItem label={t('admin.users.profileComplete')} value={selectedUser.profile_complete ? (t('common.yes') + ' \u2713') : (t('common.no') + ' \u2717')} />
                </div>
              </div>

              {/* Location */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  {t('admin.users.location')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={t('admin.users.country')} value={selectedUser.country} />
                  <InfoItem label={t('admin.users.city')} value={selectedUser.city} />
                  <InfoItem label={t('admin.users.postalCode')} value={selectedUser.postal_code} />
                </div>
              </div>

              {/* Bike Information */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {t('admin.users.bikeInformation')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={t('admin.users.bikeBrand')} value={selectedUser.bike_brand} />
                  <InfoItem label={t('admin.users.bikeModel')} value={selectedUser.bike_model} />
                  <InfoItem label={t('admin.users.engineSize')} value={selectedUser.engine_size_cc ? `${selectedUser.engine_size_cc} cc` : null} />
                  <InfoItem label={t('admin.users.experienceLevel')} value={selectedUser.experience_level} />
                  <InfoItem label={t('admin.users.ridingYears')} value={selectedUser.riding_experience_years?.toString() || null} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('admin.users.enrollments')}</p>
                  <p className="text-2xl font-bold">{selectedUser.enrollmentCount}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{t('admin.users.joined')}</p>
                  <p className="text-lg font-semibold">
                    {format(new Date(selectedUser.created_at), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.manageRoles')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.addRoleDescription')}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>{t('admin.users.currentRoles')}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((r, i) => (
                      <span key={i}>{getRoleBadge(r.role)}</span>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">{t('admin.users.noRole')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('admin.users.addNewRole')}</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{t('admin.users.roles_labels.student')}</SelectItem>
                    <SelectItem value="instructor">{t('admin.users.roles_labels.instructor')}</SelectItem>
                    <SelectItem value="moderator">{t('admin.users.roles_labels.moderator')}</SelectItem>
                    <SelectItem value="support">{t('admin.users.roles_labels.support')}</SelectItem>
                    <SelectItem value="finance">{t('admin.users.roles_labels.finance')}</SelectItem>
                    <SelectItem value="academy_admin">{t('admin.users.roles_labels.academy_admin')}</SelectItem>
                    <SelectItem value="super_admin">{t('admin.users.roles_labels.super_admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              {t('admin.users.cancel')}
            </Button>
            <Button 
              onClick={() => selectedUser && addRoleMutation.mutate({ userId: selectedUser.user_id, role: newRole })}
              disabled={addRoleMutation.isPending}
            >
              {addRoleMutation.isPending ? t('admin.users.adding') : t('admin.users.addRole')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'تغيير كلمة المرور' : 'Change Password'}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `تغيير كلمة المرور للمستخدم: ${passwordUser?.full_name || passwordUser?.email || ''}`
                : `Change password for: ${passwordUser?.full_name || passwordUser?.email || ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isRTL ? 'أدخل كلمة المرور الجديدة (6 أحرف على الأقل)' : 'Enter new password (min 6 characters)'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              disabled={isChangingPassword || newPassword.length < 6}
              onClick={async () => {
                if (!passwordUser) return;
                setIsChangingPassword(true);
                try {
                  const { data, error } = await supabase.functions.invoke('admin-update-password', {
                    body: { user_id: passwordUser.user_id, new_password: newPassword },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast.success(isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
                  setIsPasswordDialogOpen(false);
                } catch (err: any) {
                  toast.error(err.message || (isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password'));
                } finally {
                  setIsChangingPassword(false);
                }
              }}
            >
              {isChangingPassword
                ? (isRTL ? 'جاري التغيير...' : 'Changing...')
                : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
};

export default AdminUsers;
