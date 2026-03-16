import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import StarRating from './StarRating';
import { MessageSquare, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CourseReviewsProps {
  courseId: string;
  isEnrolled: boolean;
}

interface Review {
  id: string;
  course_id: string;
  user_id: string | null;
  rating: number;
  comment: string | null;
  is_fake: boolean;
  fake_name: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

const CourseReviews: React.FC<CourseReviewsProps> = ({ courseId, isEnrolled }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['course-reviews', courseId],
    queryFn: async () => {
      // Fetch reviews
      const { data: reviewsData, error } = await supabase
        .from('course_reviews')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For real reviews, fetch profile names
      const realReviewUserIds = (reviewsData || [])
        .filter(r => !r.is_fake && r.user_id)
        .map(r => r.user_id!);

      let profilesMap: Record<string, string> = {};
      if (realReviewUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', realReviewUserIds);
        
        if (profiles) {
          profiles.forEach(p => {
            profilesMap[p.user_id] = p.full_name || (isRTL ? 'مستخدم' : 'User');
          });
        }
      }

      return (reviewsData || []).map(r => ({
        ...r,
        displayName: r.is_fake
          ? r.fake_name
          : (r.user_id ? profilesMap[r.user_id] || (isRTL ? 'مستخدم' : 'User') : (isRTL ? 'مستخدم' : 'User')),
      }));
    },
  });

  // Check if user already reviewed
  const userHasReview = user && reviews.some(r => r.user_id === user.id && !r.is_fake);

  // Fetch base rating from course
  const { data: courseBase } = useQuery({
    queryKey: ['course-base-rating', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('base_review_count, base_rating')
        .eq('id', courseId)
        .single();
      return {
        baseCount: (data as any)?.base_review_count || 0,
        baseRating: Number((data as any)?.base_rating) || 0,
      };
    },
  });

  const baseCount = courseBase?.baseCount || 0;
  const baseRating = courseBase?.baseRating || 0;

  // Calculate stats (combined with base)
  const realAvg = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length
    : 0;
  const totalCount = reviews.length + baseCount;
  const avgRating = totalCount > 0
    ? ((realAvg * reviews.length) + (baseRating * baseCount)) / totalCount
    : 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => Math.round(Number(r.rating)) === star).length,
    percentage: reviews.length > 0
      ? (reviews.filter(r => Math.round(Number(r.rating)) === star).length / reviews.length) * 100
      : 0,
  }));

  // Submit review
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('course_reviews')
        .insert({
          course_id: courseId,
          user_id: user.id,
          rating: newRating,
          comment: newComment.trim() || null,
          is_fake: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reviews', courseId] });
      setNewComment('');
      setNewRating(5);
      setShowForm(false);
      toast.success(isRTL ? 'تم إرسال تقييمك بنجاح!' : 'Review submitted successfully!');
    },
    onError: (err: any) => {
      if (err.message?.includes('duplicate')) {
        toast.error(isRTL ? 'لقد قمت بتقييم هذه الدورة مسبقاً' : 'You have already reviewed this course');
      } else {
        toast.error(isRTL ? 'فشل إرسال التقييم' : 'Failed to submit review');
      }
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <section className="section-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">
              {isRTL ? 'التقييمات والمراجعات' : 'Ratings & Reviews'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {reviews.length} {isRTL ? 'تقييم' : reviews.length === 1 ? 'review' : 'reviews'}
            </p>
          </div>
          {isEnrolled && !userHasReview && user && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
            >
              <MessageSquare className="w-4 h-4 me-1.5" />
              {isRTL ? 'أضف تقييم' : 'Write Review'}
            </Button>
          )}
        </div>

        {/* Rating Summary */}
        {reviews.length > 0 && (
          <div className="card-premium p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
              {/* Average */}
              <div className="flex flex-col items-center justify-center text-center min-w-[120px]">
                <span className="text-4xl sm:text-5xl font-black text-foreground">{avgRating.toFixed(1)}</span>
                <StarRating rating={avgRating} size="md" />
                <span className="text-xs text-muted-foreground mt-1">
                  {reviews.length} {isRTL ? 'تقييم' : 'reviews'}
                </span>
              </div>

              {/* Breakdown */}
              <div className="flex-1 space-y-2">
                {ratingBreakdown.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-6 text-end">{star}★</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Review Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card-premium p-4 sm:p-6 mb-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  {isRTL ? 'أضف تقييمك' : 'Write Your Review'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {isRTL ? 'التقييم' : 'Rating'}
                    </label>
                    <StarRating
                      rating={newRating}
                      onRatingChange={setNewRating}
                      interactive
                      size="lg"
                      showValue
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {isRTL ? 'تعليقك (اختياري)' : 'Your comment (optional)'}
                    </label>
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={isRTL ? 'شاركنا تجربتك مع هذه الدورة...' : 'Share your experience with this course...'}
                      className="min-h-[100px] bg-muted/50"
                      maxLength={1000}
                    />
                  </div>
                  <div className="flex items-center gap-3 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                      {isRTL ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button
                      size="sm"
                      className="btn-cta"
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      <Send className="w-4 h-4 me-1.5" />
                      {submitMutation.isPending
                        ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
                        : (isRTL ? 'إرسال التقييم' : 'Submit Review')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviews List */}
        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review: any, index: number) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card-premium p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {review.displayName}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    <StarRating rating={Number(review.rating)} size="sm" />
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card-premium p-8 sm:p-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {isRTL ? 'لا توجد تقييمات بعد. كن أول من يقيّم!' : 'No reviews yet. Be the first to review!'}
            </p>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default CourseReviews;
