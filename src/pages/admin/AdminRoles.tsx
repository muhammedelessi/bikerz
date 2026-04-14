import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCog,
  Plus,
  Trash2,
  Crown,
  GraduationCap,
  Users,
  Headphones,
  DollarSign,
  Eye,
} from 'lucide-react';

type AppRole = 'super_admin' | 'developer' | 'academy_admin' | 'instructor' | 'moderator' | 'finance' | 'support' | 'student';

const roleConfig: Record<AppRole, { icon: React.ElementType; color: string; labelEn: string; labelAr: string; descEn: string; descAr: string }> = {
  super_admin: {
    icon: Crown,
    color: 'text-red-500 bg-red-500/10',
    labelEn: 'Super Admin',
    labelAr: 'المشرف الأعلى',
    descEn: 'Full system access',
    descAr: 'صلاحيات كاملة',
  },
  developer: {
    icon: Shield,
    color: 'text-orange-500 bg-orange-500/10',
    labelEn: 'Developer',
    labelAr: 'مطور',
    descEn: 'Developer-only maintenance access',
    descAr: 'صلاحيات صيانة خاصة بالمطور',
  },
  academy_admin: {
    icon: ShieldCheck,
    color: 'text-purple-500 bg-purple-500/10',
    labelEn: 'Academy Admin',
    labelAr: 'مشرف الأكاديمية',
    descEn: 'Manage all content and users',
    descAr: 'إدارة المحتوى والمستخدمين',
  },
  instructor: {
    icon: GraduationCap,
    color: 'text-blue-500 bg-blue-500/10',
    labelEn: 'Instructor',
    labelAr: 'مدرب',
    descEn: 'Create and manage courses',
    descAr: 'إنشاء وإدارة الدورات',
  },
  moderator: {
    icon: Eye,
    color: 'text-green-500 bg-green-500/10',
    labelEn: 'Moderator',
    labelAr: 'مشرف محتوى',
    descEn: 'Moderate content and users',
    descAr: 'مراقبة المحتوى والمستخدمين',
  },
  finance: {
    icon: DollarSign,
    color: 'text-yellow-500 bg-yellow-500/10',
    labelEn: 'Finance',
    labelAr: 'المالية',
    descEn: 'Manage payments and revenue',
    descAr: 'إدارة المدفوعات والإيرادات',
  },
  support: {
    icon: Headphones,
    color: 'text-cyan-500 bg-cyan-500/10',
    labelEn: 'Support',
    labelAr: 'الدعم',
    descEn: 'Handle user support tickets',
    descAr: 'معالجة تذاكر الدعم',
  },
  student: {
    icon: Users,
    color: 'text-gray-500 bg-gray-500/10',
    labelEn: 'Student',
    labelAr: 'طالب',
    descEn: 'Access enrolled courses',
    descAr: 'الوصول للدورات المسجلة',
  },
};

const AdminRoles = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logAction } = useAuditLog();
  const [searchQuery, setSearchQuery] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  // Fetch all users with their roles
  const { data: usersWithRoles, isLoading } = useQuery({
    queryKey: ['admin-users-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      return profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.user_id).map(r => r.role as AppRole) || [],
      }));
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) {
        if (error.message.includes('duplicate')) {
          throw new Error('User already has this role');
        }
        throw error;
      }
      
      // Log the action
      await logAction({
        action: 'role_assigned',
        entityType: 'role',
        entityId: userId,
        newData: { userId, role },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-roles'] });
      setAssignDialogOpen(false);
      setSelectedUserId(null);
      setSelectedRole('');
      toast({
        title: isRTL ? 'تم التعيين' : 'Role Assigned',
        description: isRTL ? 'تم تعيين الدور بنجاح' : 'Role assigned successfully',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: error.message,
      });
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
      
      // Log the action
      await logAction({
        action: 'role_removed',
        entityType: 'role',
        entityId: userId,
        oldData: { userId, role },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-roles'] });
      toast({
        title: isRTL ? 'تم الإزالة' : 'Role Removed',
        description: isRTL ? 'تم إزالة الدور بنجاح' : 'Role removed successfully',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إزالة الدور' : 'Failed to remove role',
      });
    },
  });

  const filteredUsers = usersWithRoles?.filter((user) => {
    return user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Count roles
  const roleCounts = usersWithRoles?.reduce((acc, user) => {
    user.roles.forEach((role: AppRole) => {
      acc[role] = (acc[role] || 0) + 1;
    });
    return acc;
  }, {} as Record<AppRole, number>) || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'الأدوار والصلاحيات' : 'Roles & Permissions'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'إدارة أدوار المستخدمين وصلاحياتهم' : 'Manage user roles and permissions'}
            </p>
          </div>
        </div>

        {/* Role Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {(Object.keys(roleConfig) as AppRole[]).map((role) => {
            const config = roleConfig[role];
            const Icon = config.icon;
            return (
              <Card key={role} className="text-center">
                <CardContent className="p-3">
                  <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium truncate">
                    {isRTL ? config.labelAr : config.labelEn}
                  </p>
                  <p className="text-2xl font-bold">{roleCounts[role] || 0}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? 'البحث عن مستخدم...' : 'Search users...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'المستخدمين والأدوار' : 'Users & Roles'}</CardTitle>
            <CardDescription>
              {isRTL ? 'تعيين وإدارة أدوار المستخدمين' : 'Assign and manage user roles'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{isRTL ? 'الأدوار الحالية' : 'Current Roles'}</TableHead>
                    <TableHead className="text-end">{isRTL ? 'الإجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback>
                              {user.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{user.phone || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">
                              {isRTL ? 'لا توجد أدوار' : 'No roles'}
                            </span>
                          ) : (
                            user.roles.map((role: AppRole) => {
                              const config = roleConfig[role];
                              const Icon = config.icon;
                              return (
                                <Badge 
                                  key={role} 
                                  variant="outline" 
                                  className={`${config.color} border-0 flex items-center gap-1`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {isRTL ? config.labelAr : config.labelEn}
                                  <button
                                    onClick={() => removeRoleMutation.mutate({ userId: user.user_id, role })}
                                    className="ms-1 hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </Badge>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUserId(user.user_id);
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Plus className="w-4 h-4 me-1" />
                          {isRTL ? 'إضافة دور' : 'Add Role'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Assign Role Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? 'تعيين دور جديد' : 'Assign New Role'}</DialogTitle>
              <DialogDescription>
                {isRTL ? 'اختر الدور الذي تريد تعيينه للمستخدم' : 'Select the role you want to assign to this user'}
              </DialogDescription>
            </DialogHeader>
            
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue placeholder={isRTL ? 'اختر دور' : 'Select role'} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleConfig) as AppRole[]).map((role) => {
                  const config = roleConfig[role];
                  const Icon = config.icon;
                  return (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{isRTL ? config.labelAr : config.labelEn}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={() => {
                  if (selectedUserId && selectedRole) {
                    assignRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
                  }
                }}
                disabled={!selectedRole || assignRoleMutation.isPending}
              >
                {isRTL ? 'تعيين' : 'Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRoles;
