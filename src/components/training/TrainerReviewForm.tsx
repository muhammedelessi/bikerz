import React, { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type ExistingReview = {
  id: string;
  rating: number;
  comment: string | null;
} | null;

type Props = {
  trainerId: string;
  trainingId?: string | null;
  existingReview?: ExistingReview;
  onSuccess?: () => void;
  submitLabel?: string;
};

const MAX_COMMENT = 500;

const TrainerReviewForm: React.FC<Props> = ({
  trainerId,
  trainingId = null,
  existingReview = null,
  onSuccess,
  submitLabel,
}) => {
  const { user, profile } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitText = useMemo(
    () => submitLabel || (existingReview ? (isRTL ? 'حفظ التعديل' : 'Save changes') : isRTL ? 'إرسال التقييم' : 'Submit review'),
    [existingReview, isRTL, submitLabel],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!rating) {
      setError(isRTL ? 'يرجى اختيار تقييم من 1 إلى 5' : 'Please select a rating from 1 to 5');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const studentName =
        profile?.full_name?.trim() ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        (isRTL ? 'متدرب' : 'Student');

      if (existingReview?.id) {
        const { error: updateError } = await supabase
          .from('trainer_reviews')
          .update({
            rating,
            comment: comment.trim().slice(0, MAX_COMMENT),
            student_name: studentName,
            training_id: trainingId,
          } as any)
          .eq('id', existingReview.id);
        if (updateError) throw updateError;
      } else {
        const { data: duplicate } = await (supabase as any)
          .from('trainer_reviews')
          .select('id')
          .eq('trainer_id', trainerId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (duplicate?.id) {
          setError(isRTL ? 'لقد قمت بتقييم هذا المدرب مسبقًا' : 'You already reviewed this trainer');
          return;
        }

        const { error: insertError } = await supabase.from('trainer_reviews').insert({
          trainer_id: trainerId,
          user_id: user.id,
          student_name: studentName,
          rating,
          comment: comment.trim().slice(0, MAX_COMMENT),
          training_id: trainingId,
          created_at: new Date().toISOString(),
        } as any);
        if (insertError) throw insertError;
      }

      toast({
        title: isRTL ? 'تم حفظ التقييم' : 'Review saved',
        description: isRTL ? 'شكرًا لمشاركتك تجربتك' : 'Thank you for sharing your experience',
      });
      onSuccess?.();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'تعذر حفظ التقييم' : 'Could not save review',
        description: err?.message || (isRTL ? 'حاول مرة أخرى' : 'Please try again'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-start">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${star} stars`}
          >
            <Star
              className={`h-7 w-7 ${star <= rating ? 'text-yellow-500 fill-yellow-400' : 'text-muted-foreground/50'}`}
            />
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
          placeholder={isRTL ? 'تعليقك هنا...' : 'Your comment...'}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          {comment.length}/{MAX_COMMENT}
        </p>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting || !user}>
        {submitText}
      </Button>
    </form>
  );
};

export default TrainerReviewForm;
