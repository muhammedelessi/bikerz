import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import StarRating from "./StarRating";
import { MessageSquare, Send, User, ChevronDown, ChevronUp, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface CourseReviewsProps {
  courseId: string;
  isEnrolled: boolean;
}

const INITIAL_SHOW = 3;

const CourseReviews: React.FC<CourseReviewsProps> = ({ courseId, isEnrolled }) => {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["course-reviews", courseId, isRTL],
    queryFn: async () => {
      const { data: reviewsData, error } = await supabase
        .from("course_reviews")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const realReviewUserIds = (reviewsData || []).filter((r) => !r.is_fake && r.user_id).map((r) => r.user_id!);

      let profilesMap: Record<string, { name: string; avatar: string | null }> = {};
      if (realReviewUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url")
          .in("user_id", realReviewUserIds);
        if (profiles) {
          profiles.forEach((p) => {
            profilesMap[p.user_id] = {
              name: p.full_name && p.full_name.trim() ? p.full_name.trim() : "",
              avatar: p.avatar_url || null,
            };
          });
        }
      }

      return (reviewsData || []).map((r, idx) => {
        let displayName: string;
        let avatarUrl: string | null = null;
        if (r.is_fake) {
          displayName = r.fake_name || (isRTL ? "متدرب" : "Rider");
        } else if (r.user_id && profilesMap[r.user_id]?.name) {
          displayName = profilesMap[r.user_id].name;
          avatarUrl = profilesMap[r.user_id].avatar;
        } else {
          const shortId = r.user_id ? r.user_id.slice(0, 4).toUpperCase() : String(idx + 1);
          displayName = isRTL ? `متدرب #${shortId}` : `Rider #${shortId}`;
        }
        return { ...r, displayName, avatarUrl };
      });
    },
  });

  const { data: courseBase } = useQuery({
    queryKey: ["course-base-rating", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("base_review_count, base_rating")
        .eq("id", courseId)
        .single();
      return {
        baseCount: (data as any)?.base_review_count || 0,
        baseRating: Number((data as any)?.base_rating) || 0,
      };
    },
  });

  const baseCount = courseBase?.baseCount || 0;
  const baseRating = courseBase?.baseRating || 0;
  const realAvg = reviews.length > 0 ? reviews.reduce((sum, r) => sum + Number(r.rating), 0) / reviews.length : 0;
  const totalCount = reviews.length + baseCount;
  const avgRating = totalCount > 0 ? (realAvg * reviews.length + baseRating * baseCount) / totalCount : 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(Number(r.rating)) === star).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => Math.round(Number(r.rating)) === star).length / reviews.length) * 100
        : 0,
  }));

  const userHasReview = user && reviews.some((r) => r.user_id === user.id && !r.is_fake);
  const visibleReviews = showAll ? reviews : reviews.slice(0, INITIAL_SHOW);
  const hasMore = reviews.length > INITIAL_SHOW;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("course_reviews").insert({
        course_id: courseId,
        user_id: user.id,
        rating: newRating,
        comment: newComment.trim() || null,
        is_fake: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
      setNewComment("");
      setNewRating(5);
      setShowForm(false);
      toast.success(isRTL ? "تم إرسال تقييمك بنجاح!" : "Review submitted successfully!");
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error(isRTL ? "لقد قمت بتقييم هذه الدورة مسبقاً" : "You have already reviewed this course");
      } else {
        toast.error(isRTL ? "فشل إرسال التقييم" : "Failed to submit review");
      }
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return isRTL ? "ممتاز" : "Excellent";
    if (rating >= 4.0) return isRTL ? "جيد جداً" : "Very Good";
    if (rating >= 3.0) return isRTL ? "جيد" : "Good";
    return isRTL ? "مقبول" : "Fair";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">
              {isRTL ? "التقييمات والمراجعات" : "Ratings & Reviews"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {totalCount} {isRTL ? "تقييم" : totalCount === 1 ? "review" : "reviews"}
            </p>
          </div>
          {isEnrolled && !userHasReview && user && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
              <MessageSquare className="w-4 h-4 me-1.5" />
              {isRTL ? "أضف تقييم" : "Write Review"}
            </Button>
          )}
        </div>

        {/* Rating Summary */}
        {totalCount > 0 && (
          <div className="card-premium p-5 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              {/* Left — big score */}
              <div className="flex flex-col items-center justify-center text-center sm:min-w-[140px] sm:border-e border-border/40 sm:pe-8">
                <span className="text-6xl font-black text-foreground leading-none">{avgRating.toFixed(1)}</span>
                <div className="my-2">
                  <StarRating rating={avgRating} size="md" />
                </div>
                <span className="text-sm font-semibold text-primary">{getRatingLabel(avgRating)}</span>
                <span className="text-xs text-muted-foreground mt-1">
                  {isRTL ? `من ${totalCount} تقييم` : `${totalCount} ratings`}
                </span>
              </div>

              {/* Right — breakdown bars */}
              <div className="flex-1 space-y-2.5">
                {ratingBreakdown.map(({ star, count, percentage }) => (
                  <div key={star} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-10 flex-shrink-0 justify-end">
                      <span className="text-xs font-bold text-foreground">{star}</span>
                      <span className="text-yellow-400 text-xs">★</span>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-yellow-400"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${percentage}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: (5 - star) * 0.08 }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 flex-shrink-0">{count}</span>
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
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="card-premium p-4 sm:p-6 mb-6 border border-primary/20">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  {isRTL ? "أضف تقييمك" : "Write Your Review"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{isRTL ? "التقييم" : "Rating"}</label>
                    <StarRating rating={newRating} onRatingChange={setNewRating} interactive size="lg" showValue />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      {isRTL ? "تعليقك (اختياري)" : "Your comment (optional)"}
                    </label>
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={
                        isRTL ? "شاركنا تجربتك مع هذه الدورة..." : "Share your experience with this course..."
                      }
                      className="min-h-[100px] bg-muted/50"
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-end">{newComment.length}/1000</p>
                  </div>
                  <div className="flex items-center gap-3 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                      {isRTL ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      size="sm"
                      className="btn-cta"
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      <Send className="w-4 h-4 me-1.5" />
                      {submitMutation.isPending
                        ? isRTL
                          ? "جاري الإرسال..."
                          : "Submitting..."
                        : isRTL
                          ? "إرسال التقييم"
                          : "Submit Review"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reviews List */}
        {reviews.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence>
              {visibleReviews.map((review: any, index: number) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className="card-premium p-4 sm:p-5 hover:border-primary/20 transition-colors duration-200"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    {review.avatarUrl ? (
                      <img
                        src={review.avatarUrl}
                        alt={review.displayName}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {review.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="text-sm font-semibold text-foreground">{review.displayName}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={Number(review.rating)} size="sm" />
                            <span className="text-xs font-medium text-primary">{Number(review.rating).toFixed(1)}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2 border-t border-border/30 pt-2">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Show More / Less */}
            {hasMore && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-dashed hover:border-primary/40 hover:text-primary transition-all"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      {isRTL ? "عرض أقل" : "Show Less"}
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
              </motion.div>
            )}
          </div>
        ) : (
          <div className="card-premium p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium mb-1">{isRTL ? "لا يوجد تقييمات بعد" : "No reviews yet"}</p>
            <p className="text-muted-foreground text-sm">
              {isRTL ? "كن أول من يقيّم هذه الدورة" : "Be the first to review this course"}
            </p>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default CourseReviews;
