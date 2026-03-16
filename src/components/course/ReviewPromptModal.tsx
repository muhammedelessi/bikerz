import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StarRating from './StarRating';
import { Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewPromptModalProps {
  courseId: string;
  progressPercentage: number;
  isEnrolled: boolean;
}

const MILESTONES = [25, 50, 75, 100];

const ReviewPromptModal: React.FC<ReviewPromptModalProps> = ({
  courseId,
  progressPercentage,
  isEnrolled,
}) => {
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasReview, setHasReview] = useState<boolean | null>(null);

  const storageKey = `review_prompt_${courseId}_${user?.id}`;

  // Check if user already has a review
  useEffect(() => {
    if (!user || !courseId) return;
    supabase
      .from('course_reviews')
      .select('id')
      .eq('course_id', courseId)
      .eq('user_id', user.id)
      .eq('is_fake', false)
      .maybeSingle()
      .then(({ data }) => {
        setHasReview(!!data);
      });
  }, [user, courseId]);

  // Check milestone triggers
  useEffect(() => {
    if (!isEnrolled || !user || hasReview === null || hasReview) return;

    const dismissed: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');

    // Find the highest milestone reached
    const reached = MILESTONES.filter(m => progressPercentage >= m);
    if (reached.length === 0) return;

    const highestMilestone = reached[reached.length - 1];

    // Check if this milestone was already dismissed
    if (dismissed.includes(String(highestMilestone))) return;

    // Check if any lower milestone was dismissed (skip if so, only show for new milestones)
    // We want: show once per milestone, if dismissed don't show again for THAT milestone
    // Find the first un-dismissed milestone that user has reached
    const firstUnshown = reached.find(m => !dismissed.includes(String(m)));
    if (!firstUnshown) return;

    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, [progressPercentage, isEnrolled, user, hasReview, storageKey]);

  const handleDismiss = () => {
    setOpen(false);
    // Mark current milestone as dismissed
    const dismissed: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const reached = MILESTONES.filter(m => progressPercentage >= m);
    const currentMilestone = reached[reached.length - 1];
    if (currentMilestone && !dismissed.includes(String(currentMilestone))) {
      dismissed.push(String(currentMilestone));
      localStorage.setItem(storageKey, JSON.stringify(dismissed));
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('course_reviews').insert({
        course_id: courseId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
        is_fake: false,
      });
      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') {
          toast.error(isRTL ? 'لقد قمت بتقييم هذه الدورة مسبقاً' : 'You have already reviewed this course');
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
        setHasReview(true);
        setTimeout(() => setOpen(false), 2500);
      }
    } catch {
      toast.error(isRTL ? 'فشل إرسال التقييم' : 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isEnrolled || !user || hasReview) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="thanks"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-6 gap-3 text-center"
            >
              <CheckCircle2 className="w-14 h-14 text-green-500" />
              <h3 className="text-lg font-bold text-foreground">
                {isRTL ? 'شكراً لتقييمك! 🎉' : 'Thank you for your review! 🎉'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'تقييمك يساعدنا على تحسين تجربة التعلم' : 'Your feedback helps us improve the learning experience'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <DialogHeader>
                <DialogTitle className="text-center">
                  {isRTL ? 'كيف تقيّم هذه الدورة؟ ⭐' : 'How do you rate this course? ⭐'}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {isRTL
                    ? `لقد أكملت ${progressPercentage}% من الدورة! شاركنا رأيك`
                    : `You've completed ${progressPercentage}% of the course! Share your thoughts`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex justify-center">
                  <StarRating
                    rating={rating}
                    onRatingChange={setRating}
                    interactive
                    size="lg"
                    showValue
                  />
                </div>

                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={isRTL ? 'أضف تعليقاً (اختياري)...' : 'Add a comment (optional)...'}
                  className="min-h-[80px] bg-muted/50"
                  maxLength={1000}
                />

                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={handleDismiss}>
                    {isRTL ? 'لاحقاً' : 'Later'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    <Send className="w-4 h-4 me-1.5" />
                    {submitting
                      ? (isRTL ? 'جاري الإرسال...' : 'Submitting...')
                      : (isRTL ? 'إرسال التقييم' : 'Submit Review')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewPromptModal;
