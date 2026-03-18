import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  Search,
  Reply,
  Trash2,
  User,
  BookOpen,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

interface Discussion {
  id: string;
  lesson_id: string;
  user_id: string;
  question: string;
  question_ar: string | null;
  is_approved: boolean;
  is_featured: boolean;
  admin_reply: string | null;
  admin_reply_ar: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Lesson {
  id: string;
  title: string;
  title_ar: string | null;
  chapter: {
    id: string;
    title: string;
    title_ar: string | null;
    course: {
      id: string;
      title: string;
      title_ar: string | null;
    };
  };
}

interface Profile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const AdminLessonDiscussions: React.FC = () => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'featured'>('pending');
  const [replyDialog, setReplyDialog] = useState<Discussion | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyTextAr, setReplyTextAr] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Fetch all discussions
  const { data: discussions = [], isLoading } = useQuery({
    queryKey: ['admin-discussions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lesson_discussions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Discussion[];
    },
  });

  // Fetch lessons with chapter and course info
  const lessonIds = [...new Set(discussions.map(d => d.lesson_id))];
  const { data: lessons = [] } = useQuery({
    queryKey: ['admin-discussion-lessons', lessonIds],
    queryFn: async () => {
      if (lessonIds.length === 0) return [];

      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, title, title_ar, chapter_id')
        .in('id', lessonIds);

      if (lessonsError) throw lessonsError;

      const chapterIds = [...new Set(lessonsData.map(l => l.chapter_id))];
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('id, title, title_ar, course_id')
        .in('id', chapterIds);

      if (chaptersError) throw chaptersError;

      const courseIds = [...new Set(chaptersData.map(c => c.course_id))];
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title, title_ar')
        .in('id', courseIds);

      if (coursesError) throw coursesError;

      return lessonsData.map(lesson => {
        const chapter = chaptersData.find(c => c.id === lesson.chapter_id);
        const course = coursesData.find(c => c.id === chapter?.course_id);
        return {
          id: lesson.id,
          title: lesson.title,
          title_ar: lesson.title_ar,
          chapter: {
            id: chapter?.id || '',
            title: chapter?.title || '',
            title_ar: chapter?.title_ar || null,
            course: {
              id: course?.id || '',
              title: course?.title || '',
              title_ar: course?.title_ar || null,
            },
          },
        };
      }) as Lesson[];
    },
    enabled: lessonIds.length > 0,
  });

  // Fetch profiles
  const userIds = [...new Set(discussions.map(d => d.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ['admin-discussion-profiles', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      if (error) throw error;
      return data as Profile[];
    },
    enabled: userIds.length > 0,
  });

  // Get unique courses for filter
  const courses = [...new Map(lessons.map(l => [l.chapter.course.id, l.chapter.course])).values()] as Array<{ id: string; title: string; title_ar: string | null }>;

  const getLesson = (lessonId: string) => lessons.find(l => l.id === lessonId);
  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  // Approve discussion mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase
        .from('lesson_discussions')
        .update({ is_approved: approve })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-discussions'] });
      toast.success(
        approve
          ? isRTL ? 'تمت الموافقة على السؤال' : 'Question approved'
          : isRTL ? 'تم رفض السؤال' : 'Question rejected'
      );
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({
      id,
      reply,
      replyAr,
      featured,
    }: {
      id: string;
      reply: string;
      replyAr: string;
      featured: boolean;
    }) => {
      const { error } = await supabase
        .from('lesson_discussions')
        .update({
          admin_reply: reply || null,
          admin_reply_ar: replyAr || null,
          is_featured: featured,
          is_approved: true,
          replied_by: user?.id,
          replied_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discussions'] });
      setReplyDialog(null);
      setReplyText('');
      setReplyTextAr('');
      setIsFeatured(false);
      toast.success(isRTL ? 'تم إرسال الرد بنجاح' : 'Reply sent successfully');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lesson_discussions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discussions'] });
      toast.success(isRTL ? 'تم حذف السؤال' : 'Question deleted');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Toggle featured mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      const { error } = await supabase
        .from('lesson_discussions')
        .update({ is_featured: featured })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { featured }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-discussions'] });
      toast.success(
        featured
          ? isRTL ? 'تم تمييز السؤال' : 'Question featured'
          : isRTL ? 'تم إزالة التمييز' : 'Feature removed'
      );
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const openReplyDialog = (discussion: Discussion) => {
    setReplyDialog(discussion);
    setReplyText(discussion.admin_reply || '');
    setReplyTextAr(discussion.admin_reply_ar || '');
    setIsFeatured(discussion.is_featured);
  };

  const handleReply = () => {
    if (!replyDialog) return;
    replyMutation.mutate({
      id: replyDialog.id,
      reply: replyText,
      replyAr: replyTextAr,
      featured: isFeatured,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter discussions
  const filteredDiscussions = discussions.filter(d => {
    // Tab filter
    if (activeTab === 'pending' && d.is_approved) return false;
    if (activeTab === 'approved' && (!d.is_approved || d.is_featured)) return false;
    if (activeTab === 'featured' && !d.is_featured) return false;

    // Course filter
    if (selectedCourse !== 'all') {
      const lesson = getLesson(d.lesson_id);
      if (lesson?.chapter.course.id !== selectedCourse) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const profile = getProfile(d.user_id);
      const lesson = getLesson(d.lesson_id);
      return (
        d.question.toLowerCase().includes(query) ||
        (d.question_ar?.toLowerCase().includes(query) ?? false) ||
        (profile?.full_name?.toLowerCase().includes(query) ?? false) ||
        (lesson?.title.toLowerCase().includes(query) ?? false)
      );
    }

    return true;
  });

  const pendingCount = discussions.filter(d => !d.is_approved).length;
  const approvedCount = discussions.filter(d => d.is_approved && !d.is_featured).length;
  const featuredCount = discussions.filter(d => d.is_featured).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <MessageSquare className="w-7 h-7 text-primary" />
              {isRTL ? 'إدارة النقاشات' : 'Lesson Discussions'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRTL ? 'مراجعة أسئلة الطلاب والرد عليها' : 'Review and respond to student questions'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 mx-auto mb-2">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">{isRTL ? 'قيد المراجعة' : 'Pending'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/10 mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-500">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">{isRTL ? 'موافق عليها' : 'Approved'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mx-auto mb-2">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary">{featuredCount}</p>
              <p className="text-sm text-muted-foreground">{isRTL ? 'مميزة' : 'Featured'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isRTL ? 'بحث في الأسئلة...' : 'Search questions...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 me-2" />
              <SelectValue placeholder={isRTL ? 'كل الدورات' : 'All Courses'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? 'كل الدورات' : 'All Courses'}</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {isRTL && course.title_ar ? course.title_ar : course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              {isRTL ? 'قيد المراجعة' : 'Pending'}
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ms-1">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {isRTL ? 'موافق عليها' : 'Approved'}
            </TabsTrigger>
            <TabsTrigger value="featured" className="gap-2">
              <Star className="w-4 h-4" />
              {isRTL ? 'مميزة' : 'Featured'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredDiscussions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {isRTL ? 'لا توجد أسئلة' : 'No questions found'}
                  </h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'pending'
                      ? isRTL ? 'لا توجد أسئلة تحتاج مراجعة' : 'No questions pending review'
                      : isRTL ? 'لا توجد أسئلة في هذا القسم' : 'No questions in this section'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDiscussions.map((discussion) => {
                  const profile = getProfile(discussion.user_id);
                  const lesson = getLesson(discussion.lesson_id);

                  return (
                    <Card key={discussion.id} className={discussion.is_featured ? 'border-primary/30 bg-primary/5' : ''}>
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src={profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {profile?.full_name?.charAt(0) || <User className="w-4 h-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground">
                                {profile?.full_name || (isRTL ? 'مستخدم' : 'User')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(discussion.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {discussion.is_featured && (
                              <Badge variant="default" className="bg-primary">
                                <Star className="w-3 h-3 me-1" />
                                {isRTL ? 'مميز' : 'Featured'}
                              </Badge>
                            )}
                            {!discussion.is_approved && (
                              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">
                                <Clock className="w-3 h-3 me-1" />
                                {isRTL ? 'قيد المراجعة' : 'Pending'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Lesson Info */}
                        {lesson && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 p-2 rounded-lg bg-muted/30">
                            <BookOpen className="w-4 h-4" />
                            <span>
                              {isRTL && lesson.chapter.course.title_ar
                                ? lesson.chapter.course.title_ar
                                : lesson.chapter.course.title}
                              {' → '}
                              {isRTL && lesson.chapter.title_ar
                                ? lesson.chapter.title_ar
                                : lesson.chapter.title}
                              {' → '}
                              {isRTL && lesson.title_ar ? lesson.title_ar : lesson.title}
                            </span>
                          </div>
                        )}

                        {/* Question */}
                        <div className="mb-4">
                          <p className="text-foreground leading-relaxed">
                            {discussion.question}
                          </p>
                          {discussion.question_ar && discussion.question_ar !== discussion.question && (
                            <p className="text-muted-foreground mt-2 text-sm" dir="rtl">
                              {discussion.question_ar}
                            </p>
                          )}
                        </div>

                        {/* Admin Reply */}
                        {discussion.admin_reply && (
                          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                            <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                              <Reply className="w-3 h-3" />
                              {isRTL ? 'الرد' : 'Reply'}
                            </p>
                            <p className="text-sm text-foreground">{discussion.admin_reply}</p>
                            {discussion.admin_reply_ar && discussion.admin_reply_ar !== discussion.admin_reply && (
                              <p className="text-sm text-muted-foreground mt-2" dir="rtl">
                                {discussion.admin_reply_ar}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {!discussion.is_approved && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate({ id: discussion.id, approve: true })}
                                disabled={approveMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4 me-1" />
                                {isRTL ? 'موافقة' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => approveMutation.mutate({ id: discussion.id, approve: false })}
                                disabled={approveMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 me-1" />
                                {isRTL ? 'رفض' : 'Reject'}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReplyDialog(discussion)}
                          >
                            <Reply className="w-4 h-4 me-1" />
                            {discussion.admin_reply 
                              ? isRTL ? 'تعديل الرد' : 'Edit Reply'
                              : isRTL ? 'رد' : 'Reply'
                            }
                          </Button>
                          {discussion.is_approved && (
                            <Button
                              size="sm"
                              variant={discussion.is_featured ? 'default' : 'outline'}
                              onClick={() => toggleFeaturedMutation.mutate({ 
                                id: discussion.id, 
                                featured: !discussion.is_featured 
                              })}
                              disabled={toggleFeaturedMutation.isPending}
                            >
                              <Star className={`w-4 h-4 me-1 ${discussion.is_featured ? 'fill-current' : ''}`} />
                              {discussion.is_featured 
                                ? isRTL ? 'إزالة التمييز' : 'Unfeature'
                                : isRTL ? 'تمييز' : 'Feature'
                              }
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(isRTL ? 'هل أنت متأكد من حذف هذا السؤال؟' : 'Are you sure you want to delete this question?')) {
                                deleteMutation.mutate(discussion.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Reply Dialog */}
        <Dialog open={!!replyDialog} onOpenChange={(open) => !open && setReplyDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {replyDialog?.admin_reply 
                  ? isRTL ? 'تعديل الرد' : 'Edit Reply'
                  : isRTL ? 'إضافة رد' : 'Add Reply'
                }
              </DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? 'أضف رداً على سؤال الطالب. سيظهر الرد أسفل السؤال.'
                  : 'Add a reply to the student question. It will appear below the question.'
                }
              </DialogDescription>
            </DialogHeader>

            {replyDialog && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border mb-4">
                <p className="text-sm text-foreground">{replyDialog.question}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label>{isRTL ? 'الرد (إنجليزي)' : 'Reply (English)'}</Label>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={isRTL ? 'اكتب الرد بالإنجليزية...' : 'Type your reply in English...'}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
              <div>
                <Label>{isRTL ? 'الرد (عربي)' : 'Reply (Arabic)'}</Label>
                <Textarea
                  value={replyTextAr}
                  onChange={(e) => setReplyTextAr(e.target.value)}
                  placeholder={isRTL ? 'اكتب الرد بالعربية...' : 'Type your reply in Arabic...'}
                  className="mt-1.5"
                  dir="rtl"
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" />
                  <Label htmlFor="featured" className="text-sm cursor-pointer">
                    {isRTL ? 'تمييز هذا السؤال' : 'Feature this question'}
                  </Label>
                </div>
                <Switch
                  id="featured"
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReplyDialog(null)}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button onClick={handleReply} disabled={replyMutation.isPending}>
                <Reply className="w-4 h-4 me-2" />
                {isRTL ? 'إرسال الرد' : 'Send Reply'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminLessonDiscussions;
