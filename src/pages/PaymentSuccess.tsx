import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Sparkles, Rocket, ArrowRight, ArrowLeft, CheckCircle2, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import bikerLogo from '@/assets/bikerz-logo.png';

type VerifyStatus = 'verifying' | 'succeeded' | 'failed' | 'processing';

const PaymentSuccess: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tapId = searchParams.get('tap_id');

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('verifying');
  const [confettiFired, setConfettiFired] = useState(false);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  // Fetch course info
  const { data: course } = useQuery({
    queryKey: ['course-success', courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from('courses')
        .select('title, title_ar, total_lessons, duration_hours')
        .eq('id', courseId!)
        .single();
      return data;
    },
    enabled: !!courseId,
  });

  // Verify payment
  useEffect(() => {
    if (!tapId || !user) return;

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('tap-verify-charge', {
          body: { charge_id: tapId },
        });
        if (error) throw error;

        if (data?.status === 'succeeded') {
          setVerifyStatus('succeeded');
          queryClient.invalidateQueries({ queryKey: ['enrollment', courseId, user.id] });
        } else if (data?.status === 'failed') {
          setVerifyStatus('failed');
        } else {
          setVerifyStatus('processing');
          queryClient.invalidateQueries({ queryKey: ['enrollment', courseId, user.id] });
        }
      } catch {
        setVerifyStatus('failed');
      }
    };

    verify();
  }, [tapId, user, courseId]);

  // Fire confetti on success
  useEffect(() => {
    if (verifyStatus !== 'succeeded' || confettiFired) return;
    setConfettiFired(true);

    const fire = () => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
      });
    };
    fire();
    setTimeout(fire, 400);
    setTimeout(fire, 900);
  }, [verifyStatus, confettiFired]);

  const courseTitle = isRTL && course?.title_ar ? course.title_ar : course?.title;

  // Failed state
  if (verifyStatus === 'failed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg text-center space-y-6"
        >
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center">
            <span className="text-4xl">❌</span>
          </div>
          <h1 className="text-2xl font-black text-foreground">
            {isRTL ? 'فشل الدفع' : 'Payment Failed'}
          </h1>
          <p className="text-muted-foreground">
            {isRTL
              ? 'لم نتمكن من إتمام عملية الدفع. يرجى المحاولة مرة أخرى.'
              : 'We could not complete your payment. Please try again.'}
          </p>
          <Button
            onClick={() => navigate(`/courses/${courseId}`)}
            variant="cta"
            className="h-12 px-8 rounded-2xl"
          >
            {isRTL ? 'العودة للدورة' : 'Back to Course'}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Verifying / Processing state
  if (verifyStatus === 'verifying' || verifyStatus === 'processing') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-6"
        >
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? 'جاري التحقق من الدفع...' : 'Verifying your payment...'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'يرجى الانتظار لحظة' : 'Please wait a moment'}
          </p>
        </motion.div>
      </div>
    );
  }

  // Success state — the main congratulations page
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative z-10 w-full max-w-lg mx-auto"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <img src={bikerLogo} alt="Bikerz" className="h-10 object-contain" />
        </motion.div>

        {/* Main card */}
        <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-7">
            {/* Trophy */}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
              className="mx-auto w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Trophy className="w-12 h-12 text-primary" />
            </motion.div>

            {/* Congrats heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="text-3xl sm:text-4xl font-black text-foreground">
                {isRTL ? '🎉 مبروك!' : '🎉 Congratulations!'}
              </h1>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-muted-foreground">
                  {isRTL ? 'تم تسجيلك بنجاح في الدورة' : 'You have successfully enrolled'}
                </p>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
            </motion.div>

            {/* Course card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-muted/50 rounded-2xl p-5 border border-border space-y-3"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {isRTL ? 'الدورة' : 'Your Course'}
              </p>
              <p className="text-xl font-bold text-foreground leading-tight">
                {courseTitle || '...'}
              </p>

              {/* Quick stats */}
              <div className="flex items-center justify-center gap-6 pt-2">
                {course?.total_lessons && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span>{course.total_lessons} {isRTL ? 'درس' : 'lessons'}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>{isRTL ? 'دفع مؤكد' : 'Payment confirmed'}</span>
                </div>
              </div>
            </motion.div>

            {/* What's next */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/50"
            >
              <p className="font-semibold text-foreground mb-1">
                {isRTL ? '🚀 ما التالي؟' : '🚀 What\'s next?'}
              </p>
              <p>
                {isRTL
                  ? 'اضغط على الزر أدناه للبدء في أول درس لك. رحلتك في عالم الدراجات تبدأ الآن!'
                  : 'Click the button below to jump into your first lesson. Your motorcycle journey starts now!'}
              </p>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
            >
              <Button
                onClick={() => navigate(`/courses/${courseId}/learn?welcome=1`)}
                variant="cta"
                className="w-full h-14 text-base font-bold rounded-2xl gap-2"
              >
                <Rocket className="w-5 h-5" />
                {isRTL ? 'ابدأ التعلم الآن' : 'Start Learning Now'}
                <ArrowIcon className="w-5 h-5" />
              </Button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-xs text-muted-foreground"
            >
              {isRTL ? 'رحلتك في عالم الدراجات تبدأ الآن 🏍️' : 'Welcome to the Bikerz family 🏍️'}
            </motion.p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
