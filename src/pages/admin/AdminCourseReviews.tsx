import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StarRating from '@/components/course/StarRating';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Plus, Star, Trash2, Users, User } from 'lucide-react';
import { toast } from 'sonner';

const AdminCourseReviews: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const [showAddFake, setShowAddFake] = useState(false);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [fakeName, setFakeName] = useState('');
  const [fakeRating, setFakeRating] = useState(5);
  const [fakeComment, setFakeComment] = useState('');
  const [fakeDate, setFakeDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch course
  const { data: course } = useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, title_ar, base_review_count, base_rating')
        .eq('id', courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-course-reviews', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('course_reviews')
        .select('*')
        .eq('course_id', courseId!)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profile names for real reviews
      const realUserIds = (data || []).filter(r => !r.is_fake && r.user_id).map(r => r.user_id!);
      let profilesMap: Record<string, string> = {};
      if (realUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', realUserIds);
        if (profiles) {
          profiles.forEach(p => { profilesMap[p.user_id] = p.full_name || 'User'; });
        }
      }

      return (data || []).map(r => ({
        ...r,
        displayName: r.is_fake ? r.fake_name : (r.user_id ? profilesMap[r.user_id] || 'User' : 'User'),
      }));
    },
    enabled: !!courseId,
  });

  // Stats
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
    : 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(Number(r.rating)) === star).length,
  }));

  const realCount = reviews.filter(r => !r.is_fake).length;
  const fakeCount = reviews.filter(r => r.is_fake).length;

  // Add fake review
  const addFakeMutation = useMutation({
    mutationFn: async () => {
      if (!fakeName.trim()) throw new Error('Name required');
      const { error } = await supabase
        .from('course_reviews')
        .insert({
          course_id: courseId!,
          user_id: null,
          rating: fakeRating,
          comment: fakeComment.trim() || null,
          is_fake: true,
          fake_name: fakeName.trim(),
          created_at: new Date(fakeDate).toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-reviews', courseId] });
      setShowAddFake(false);
      setFakeName('');
      setFakeRating(5);
      setFakeComment('');
      setFakeDate(new Date().toISOString().split('T')[0]);
      toast.success('Fake review added');
    },
    onError: () => toast.error('Failed to add review'),
  });

  // Delete review
  const deleteMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('course_reviews')
        .delete()
        .eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-course-reviews', courseId] });
      setDeleteReviewId(null);
      toast.success('Review deleted');
    },
    onError: () => toast.error('Failed to delete review'),
  });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const courseTitle = isRTL && course?.title_ar ? course.title_ar : course?.title;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/courses">
              <Button variant="ghost" size="icon">
                <BackIcon className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {isRTL ? 'التقييمات والمراجعات' : 'Reviews & Ratings'}
              </h1>
              {courseTitle && (
                <p className="text-sm text-muted-foreground">{courseTitle}</p>
              )}
            </div>
          </div>
          <Button onClick={() => setShowAddFake(true)}>
            <Plus className="w-4 h-4 me-1.5" />
            {isRTL ? 'إضافة تقييم وهمي' : 'Add Fake Review'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <span className="text-3xl font-black text-foreground">{avgRating.toFixed(1)}</span>
                <div className="flex justify-center mt-1">
                  <StarRating rating={avgRating} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'متوسط التقييم' : 'Average Rating'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <span className="text-3xl font-black text-foreground">{reviews.length}</span>
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'إجمالي التقييمات' : 'Total Reviews'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <span className="text-3xl font-black text-foreground">{realCount}</span>
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'تقييمات حقيقية' : 'Real Reviews'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <span className="text-3xl font-black text-foreground">{fakeCount}</span>
              <p className="text-xs text-muted-foreground mt-1">{isRTL ? 'تقييمات وهمية' : 'Fake Reviews'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Rating Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'توزيع التقييمات' : 'Rating Breakdown'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ratingBreakdown.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-8">{star}★</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                      style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8 text-end">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Base Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              ⭐ {isRTL ? 'التقييم الأساسي' : 'Base Rating'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? 'هذه الأرقام تُضاف إلى التقييمات الحقيقية عند عرضها في صفحة الدورة'
                : 'These numbers are added to real reviews when displayed on the course page'}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{isRTL ? 'عدد التقييمات الأساسي' : 'Base Review Count'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={(course as any)?.base_review_count || 0}
                  onChange={async (e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    await supabase.from('courses').update({ base_review_count: val }).eq('id', courseId);
                    queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
                  }}
                  placeholder="e.g. 34"
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'مثال: 34 تقييم أساسي + 5 حقيقي = يظهر 39' : 'e.g. 34 base + 5 real = shows 39'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? 'متوسط التقييم الأساسي' : 'Base Average Rating'}</Label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={(course as any)?.base_rating || 0}
                  onChange={async (e) => {
                    const val = Math.min(5, Math.max(0, parseFloat(e.target.value) || 0));
                    await supabase.from('courses').update({ base_rating: val }).eq('id', courseId);
                    queryClient.invalidateQueries({ queryKey: ['admin-course', courseId] });
                  }}
                  placeholder="e.g. 4.8"
                />
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'التقييم من 0 إلى 5 نجوم' : 'Rating from 0 to 5 stars'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isRTL ? 'جميع التقييمات' : 'All Reviews'}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">{isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRTL ? 'الاسم' : 'Name'}</TableHead>
                      <TableHead>{isRTL ? 'التقييم' : 'Rating'}</TableHead>
                      <TableHead>{isRTL ? 'التعليق' : 'Comment'}</TableHead>
                      <TableHead>{isRTL ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((review: any) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                              <User className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-medium">{review.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StarRating rating={Number(review.rating)} size="sm" />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                            {review.comment || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                        </TableCell>
                        <TableCell>
                          {review.is_fake ? (
                            <Badge variant="destructive" className="text-xs">{isRTL ? 'وهمي' : 'Fake'}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{isRTL ? 'حقيقي' : 'Real'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteReviewId(review.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Fake Review Dialog */}
      <Dialog open={showAddFake} onOpenChange={setShowAddFake}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'إضافة تقييم وهمي' : 'Add Fake Review'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'الاسم' : 'Name'}</Label>
              <Input
                value={fakeName}
                onChange={(e) => setFakeName(e.target.value)}
                placeholder="Enter display name"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'التقييم' : 'Rating'}</Label>
              <StarRating
                rating={fakeRating}
                onRatingChange={setFakeRating}
                interactive
                size="lg"
                showValue
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'التعليق' : 'Comment'}</Label>
              <Textarea
                value={fakeComment}
                onChange={(e) => setFakeComment(e.target.value)}
                placeholder="Enter review comment"
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'التاريخ' : 'Date'}</Label>
              <Input
                type="date"
                value={fakeDate}
                onChange={(e) => setFakeDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddFake(false)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
            <Button
              onClick={() => addFakeMutation.mutate()}
              disabled={addFakeMutation.isPending || !fakeName.trim()}
            >
              {addFakeMutation.isPending ? (isRTL ? 'جاري الإضافة...' : 'Adding...') : (isRTL ? 'إضافة التقييم' : 'Add Review')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteReviewId} onOpenChange={() => setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? 'حذف التقييم؟' : 'Delete Review?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف التقييم نهائياً.' : 'This action cannot be undone. The review will be permanently deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteReviewId && deleteMutation.mutate(deleteReviewId)}
            >
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminCourseReviews;
