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
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>('student');

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

      // Fetch enrollment counts
      const { data: enrollments, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('user_id');

      if (enrollError) throw enrollError;

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
      toast.success(isRTL ? 'تم إضافة الدور بنجاح' : 'Role added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || (isRTL ? 'فشل في إضافة الدور' : 'Failed to add role'));
    },
  });

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.user_id.includes(searchQuery);
    
    const matchesRole = roleFilter === 'all' || 
      user.roles.some(r => r.role === roleFilter);
    
    return matchesSearch && matchesRole;
  });

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

    const roleLabels: Record<string, { en: string; ar: string }> = {
      super_admin: { en: 'Super Admin', ar: 'مشرف عام' },
      academy_admin: { en: 'Academy Admin', ar: 'مشرف أكاديمية' },
      instructor: { en: 'Instructor', ar: 'مدرب' },
      moderator: { en: 'Moderator', ar: 'مشرف' },
      finance: { en: 'Finance', ar: 'مالية' },
      support: { en: 'Support', ar: 'دعم' },
      student: { en: 'Student', ar: 'طالب' },
    };

    return (
      <Badge className={roleStyles[role] || 'bg-gray-500/10 text-gray-500'}>
        {isRTL ? roleLabels[role]?.ar : roleLabels[role]?.en || role}
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
          {isRTL ? 'إدارة المستخدمين' : 'User Management'}
        </h1>
        <p className="text-muted-foreground">
          {isRTL ? 'عرض وإدارة جميع المستخدمين' : 'View and manage all users'}
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
              <p className="text-sm text-muted-foreground">{isRTL ? 'إجمالي المستخدمين' : 'Total Users'}</p>
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
              <p className="text-sm text-muted-foreground">{isRTL ? 'الطلاب' : 'Students'}</p>
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
              <p className="text-sm text-muted-foreground">{isRTL ? 'المشرفون' : 'Admins'}</p>
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
              <p className="text-sm text-muted-foreground">{isRTL ? 'المدربون' : 'Instructors'}</p>
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
                placeholder={isRTL ? 'البحث عن مستخدم...' : 'Search users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 me-2" />
                <SelectValue placeholder={isRTL ? 'الدور' : 'Role'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="student">{isRTL ? 'طالب' : 'Student'}</SelectItem>
                <SelectItem value="instructor">{isRTL ? 'مدرب' : 'Instructor'}</SelectItem>
                <SelectItem value="super_admin">{isRTL ? 'مشرف عام' : 'Super Admin'}</SelectItem>
                <SelectItem value="academy_admin">{isRTL ? 'مشرف أكاديمية' : 'Academy Admin'}</SelectItem>
              </SelectContent>
            </Select>
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
                {isRTL ? 'لا يوجد مستخدمين' : 'No users found'}
              </h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                  <TableHead>{isRTL ? 'الأدوار' : 'Roles'}</TableHead>
                  <TableHead>{isRTL ? 'التسجيلات' : 'Enrollments'}</TableHead>
                  <TableHead>{isRTL ? 'تاريخ الانضمام' : 'Joined'}</TableHead>
                  <TableHead className="text-end">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
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
                            {user.full_name || (isRTL ? 'بدون اسم' : 'No name')}
                          </p>
                          <p className="text-sm text-muted-foreground">{user.phone || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((r, i) => (
                            <span key={i}>{getRoleBadge(r.role)}</span>
                          ))
                        ) : (
                          <Badge variant="outline">{isRTL ? 'بدون دور' : 'No role'}</Badge>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                          <DropdownMenuLabel>{isRTL ? 'الإجراءات' : 'Actions'}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openUserDetail(user)}>
                            <Eye className="w-4 h-4 me-2" />
                            {isRTL ? 'عرض التفاصيل' : 'View Details'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRoleDialog(user)}>
                            <Shield className="w-4 h-4 me-2" />
                            {isRTL ? 'إدارة الأدوار' : 'Manage Roles'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="w-4 h-4 me-2" />
                            {isRTL ? 'إرسال بريد' : 'Send Email'}
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <MessageSquare className="w-4 h-4 me-2" />
                            {isRTL ? 'إضافة ملاحظة' : 'Add Note'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <UserX className="w-4 h-4 me-2" />
                            {isRTL ? 'تعليق الحساب' : 'Suspend User'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <DialogTitle>{isRTL ? 'تفاصيل المستخدم' : 'User Details'}</DialogTitle>
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
                  <h3 className="text-xl font-semibold">{selectedUser.full_name || 'No name'}</h3>
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
                  {isRTL ? 'المعلومات الشخصية' : 'Personal Information'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={isRTL ? 'الاسم الكامل' : 'Full Name'} value={selectedUser.full_name} />
                  <InfoItem label={isRTL ? 'الكنية' : 'Nickname'} value={selectedUser.rider_nickname} />
                  <InfoItem label={isRTL ? 'رقم الهاتف' : 'Phone'} value={selectedUser.phone} />
                  <InfoItem label={isRTL ? 'الهاتف موثق' : 'Phone Verified'} value={selectedUser.phone_verified ? (isRTL ? 'نعم ✓' : 'Yes ✓') : (isRTL ? 'لا ✗' : 'No ✗')} />
                  <InfoItem label={isRTL ? 'البريد الإلكتروني' : 'Email'} value={selectedUser.email || null} />
                  <InfoItem label={isRTL ? 'الملف مكتمل' : 'Profile Complete'} value={selectedUser.profile_complete ? (isRTL ? 'نعم ✓' : 'Yes ✓') : (isRTL ? 'لا ✗' : 'No ✗')} />
                </div>
              </div>

              {/* Location */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  {isRTL ? 'العنوان' : 'Location'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={isRTL ? 'البلد' : 'Country'} value={selectedUser.country} />
                  <InfoItem label={isRTL ? 'المدينة' : 'City'} value={selectedUser.city} />
                  <InfoItem label={isRTL ? 'الرمز البريدي' : 'Postal Code'} value={selectedUser.postal_code} />
                </div>
              </div>

              {/* Bike Information */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  {isRTL ? 'معلومات الدراجة' : 'Bike Information'}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label={isRTL ? 'ماركة الدراجة' : 'Bike Brand'} value={selectedUser.bike_brand} />
                  <InfoItem label={isRTL ? 'موديل الدراجة' : 'Bike Model'} value={selectedUser.bike_model} />
                  <InfoItem label={isRTL ? 'حجم المحرك' : 'Engine Size'} value={selectedUser.engine_size_cc ? `${selectedUser.engine_size_cc} cc` : null} />
                  <InfoItem label={isRTL ? 'مستوى الخبرة' : 'Experience Level'} value={selectedUser.experience_level} />
                  <InfoItem label={isRTL ? 'سنوات القيادة' : 'Riding Years'} value={selectedUser.riding_experience_years?.toString() || null} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{isRTL ? 'التسجيلات' : 'Enrollments'}</p>
                  <p className="text-2xl font-bold">{selectedUser.enrollmentCount}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">{isRTL ? 'تاريخ الانضمام' : 'Joined'}</p>
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
            <DialogTitle>{isRTL ? 'إدارة الأدوار' : 'Manage Roles'}</DialogTitle>
            <DialogDescription>
              {isRTL ? 'إضافة أو إزالة أدوار المستخدم' : 'Add or remove user roles'}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>{isRTL ? 'الأدوار الحالية' : 'Current Roles'}</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUser.roles.length > 0 ? (
                    selectedUser.roles.map((r, i) => (
                      <span key={i}>{getRoleBadge(r.role)}</span>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">{isRTL ? 'لا توجد أدوار' : 'No roles'}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? 'إضافة دور جديد' : 'Add New Role'}</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">{isRTL ? 'طالب' : 'Student'}</SelectItem>
                    <SelectItem value="instructor">{isRTL ? 'مدرب' : 'Instructor'}</SelectItem>
                    <SelectItem value="moderator">{isRTL ? 'مشرف' : 'Moderator'}</SelectItem>
                    <SelectItem value="support">{isRTL ? 'دعم' : 'Support'}</SelectItem>
                    <SelectItem value="finance">{isRTL ? 'مالية' : 'Finance'}</SelectItem>
                    <SelectItem value="academy_admin">{isRTL ? 'مشرف أكاديمية' : 'Academy Admin'}</SelectItem>
                    <SelectItem value="super_admin">{isRTL ? 'مشرف عام' : 'Super Admin'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={() => selectedUser && addRoleMutation.mutate({ userId: selectedUser.user_id, role: newRole })}
              disabled={addRoleMutation.isPending}
            >
              {addRoleMutation.isPending ? (isRTL ? 'جاري الإضافة...' : 'Adding...') : (isRTL ? 'إضافة الدور' : 'Add Role')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
};

export default AdminUsers;
