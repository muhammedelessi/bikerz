import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StarRating from '@/components/course/StarRating';
import { MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

const INITIAL_SHOW = 4;

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  student_name: string;
  created_at: string;
  training_id: string | null;
};

type Props = {
  trainerId: string;
};

const TrainerProfileReviews: React.FC<Props> = ({ trainerId }) => {
  const { isRTL } = useLanguage();
  const [showAll, setShowAll] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['trainer-profile-reviews', trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_reviews')
        .select('*')
        .eq('trainer_id', trainerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ReviewRow[];
    },
  });

  const avgRating = useMemo(
    () => (reviews.length ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length : 0),
    [reviews],
  );

  const ratingBreakdown = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: reviews.filter((r) => Math.round(Number(r.rating)) === star).length,
        percentage: reviews.length ? (reviews.filter((r) => Math.round(Number(r.rating)) === star).length / reviews.length) * 100 : 0,
      })),
    [reviews],
  );

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return isRTL ? 'ممتاز' : 'Excellent';
    if (rating >= 4.0) return isRTL ? 'جيد جداً' : 'Very Good';
    if (rating >= 3.0) return isRTL ? 'جيد' : 'Good';
    return isRTL ? 'مقبول' : 'Fair';
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const visibleReviews = showAll ? reviews : reviews.slice(0, INITIAL_SHOW);
  const hasMore = reviews.length > INITIAL_SHOW;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <section className="text-start">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="mb-6 sm:mb-8">
          <h2 className="text-base font-bold flex items-center gap-2 mb-2">
            <span className="w-1 h-5 bg-primary rounded-full shrink-0" />
            {isRTL ? 'التقييمات والمراجعات' : 'Ratings & Reviews'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {reviews.length} {isRTL ? 'تقييم' : reviews.length === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {reviews.length > 0 && (
          <div className="card-premium p-5 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              <div className="flex flex-col items-center justify-center text-center sm:min-w-[140px] sm:border-e border-border/40 sm:pe-8">
                <span className="text-6xl font-black text-foreground leading-none">{avgRating.toFixed(1)}</span>
                <div className="my-2">
                  <StarRating rating={avgRating} size="md" />
                </div>
                <span className="text-sm font-semibold text-primary">{getRatingLabel(avgRating)}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {isRTL ? `من ${reviews.length} تقييم` : `${reviews.length} ratings`}
                </span>
              </div>
              <div className="flex-1 space-y-2.5">
                {ratingBreakdown.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-10 shrink-0 justify-end">
                      <span className="text-xs font-bold text-foreground">{star}</span>
                      <span className="text-yellow-400 text-xs">★</span>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-yellow-400"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${percentage}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.55, delay: (5 - star) * 0.06 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reviews.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {visibleReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.04 }}
                  className="card-premium p-4 sm:p-5 hover:border-primary/20 transition-colors duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(review.student_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{review.student_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={Number(review.rating)} size="sm" />
                            <span className="text-xs font-medium text-primary">{Number(review.rating).toFixed(1)}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDate(review.created_at)}</span>
                      </div>
                      {review.comment ? (
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2 border-t border-border/30 pt-2">
                          {review.comment}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {hasMore && (
              <Button
                variant="outline"
                className="w-full gap-2 border-dashed hover:border-primary/40 hover:text-primary transition-all"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {isRTL ? 'عرض أقل' : 'Show less'}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {isRTL
                      ? `عرض ${reviews.length - INITIAL_SHOW} تقييم إضافي`
                      : `Show ${reviews.length - INITIAL_SHOW} more reviews`}
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="card-premium p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">{isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</p>
            <p className="text-muted-foreground text-sm">
              {isRTL ? 'ستظهر آراء المتدربين هنا' : 'Learner feedback will appear here'}
            </p>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default TrainerProfileReviews;
