import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  MoreHorizontal,
  Star,
  Users,
  DollarSign,
  TrendingUp,
  UserPlus,
  Eye,
  Edit,
  Ban,
} from 'lucide-react';

const AdminInstructors = () => {
  const { isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: instructors, isLoading } = useQuery({
    queryKey: ['admin-instructors'],
    queryFn: async () => {
      const { data: mentors, error } = await supabase
        .from('mentors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = mentors?.map(m => m.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);
      
      return mentors?.map(mentor => ({
        ...mentor,
        profile: profiles?.find(p => p.user_id === mentor.user_id) || null,
      }));
    },
  });

  const filteredInstructors = instructors?.filter((instructor) => {
    const name = instructor.profile?.full_name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const stats = [
    {
      titleEn: 'Total Instructors',
      titleAr: 'إجمالي المدربين',
      value: instructors?.length || 0,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      titleEn: 'Active Instructors',
      titleAr: 'المدربين النشطين',
      value: instructors?.filter(i => i.is_available)?.length || 0,
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      titleEn: 'Avg. Rating',
      titleAr: 'متوسط التقييم',
      value: instructors?.length 
        ? (instructors.reduce((sum, i) => sum + (Number(i.rating) || 0), 0) / instructors.length).toFixed(1)
        : '0.0',
      icon: Star,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      titleEn: 'Total Students',
      titleAr: 'إجمالي الطلاب',
      value: instructors?.reduce((sum, i) => sum + (i.total_students || 0), 0) || 0,
      icon: DollarSign,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? 'إدارة المدربين' : 'Instructor Management'}
            </h1>
            <p className="text-muted-foreground">
              {isRTL ? 'إدارة المدربين وتتبع أدائهم' : 'Manage instructors and track their performance'}
            </p>
          </div>
          <Button>
            <UserPlus className="w-4 h-4 me-2" />
            {isRTL ? 'إضافة مدرب' : 'Add Instructor'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {isRTL ? stat.titleAr : stat.titleEn}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
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
                placeholder={isRTL ? 'البحث عن مدرب...' : 'Search instructors...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Instructors Table */}
        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'قائمة المدربين' : 'Instructors List'}</CardTitle>
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
                    <TableHead>{isRTL ? 'المدرب' : 'Instructor'}</TableHead>
                    <TableHead>{isRTL ? 'نوع الدراجة' : 'Bike Type'}</TableHead>
                    <TableHead>{isRTL ? 'الخبرة' : 'Experience'}</TableHead>
                    <TableHead>{isRTL ? 'التقييم' : 'Rating'}</TableHead>
                    <TableHead>{isRTL ? 'الطلاب' : 'Students'}</TableHead>
                    <TableHead>{isRTL ? 'نسبة الأرباح' : 'Revenue Share'}</TableHead>
                    <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInstructors?.map((instructor) => {
                    return (
                      <TableRow key={instructor.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={instructor.profile?.avatar_url || ''} />
                              <AvatarFallback>
                                {instructor.profile?.full_name?.charAt(0) || 'I'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{instructor.profile?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{instructor.motorbike_brand}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{instructor.motorbike_type}</TableCell>
                        <TableCell>
                          {instructor.experience_years} {isRTL ? 'سنة' : 'years'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span>{Number(instructor.rating || 0).toFixed(1)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{instructor.total_students || 0}</TableCell>
                        <TableCell>{instructor.revenue_share_percentage}%</TableCell>
                        <TableCell>
                          <Badge variant={instructor.is_available ? 'default' : 'secondary'}>
                            {instructor.is_available 
                              ? (isRTL ? 'متاح' : 'Available')
                              : (isRTL ? 'غير متاح' : 'Unavailable')
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                              <DropdownMenuItem>
                                <Eye className="w-4 h-4 me-2" />
                                {isRTL ? 'عرض الملف' : 'View Profile'}
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="w-4 h-4 me-2" />
                                {isRTL ? 'تعديل' : 'Edit'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                <Ban className="w-4 h-4 me-2" />
                                {isRTL ? 'إيقاف' : 'Suspend'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminInstructors;
