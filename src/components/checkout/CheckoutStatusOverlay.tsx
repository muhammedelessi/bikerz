import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import type { PaymentStatus } from '@/types/payment';
import { translateTapPaymentDisplayError } from '@/lib/userFacingServerMessages';

interface CheckoutStatusOverlayProps {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  courseId: string;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  navigate: (path: string) => void;
}

const CheckoutStatusOverlay: React.FC<CheckoutStatusOverlayProps> = memo(({
  paymentStatus,
  paymentError,
  courseId,
  onSuccess,
  onOpenChange,
  onRetry,
  navigate,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const localizedPaymentError = paymentError ? translateTapPaymentDisplayError(paymentError, t) : null;

  if (paymentStatus === 'processing' || paymentStatus === 'verifying') {
    const titleKey =
      paymentStatus === 'processing'
        ? 'checkout.statusOverlay.processingPayment'
        : 'checkout.statusOverlay.verifyingPayment';
    const subKey =
      paymentStatus === 'processing'
        ? 'checkout.statusOverlay.doNotClosePage'
        : 'checkout.statusOverlay.pleaseWaitMoment';
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <h4 className="text-lg font-bold text-foreground mb-1">
          {t(titleKey)}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t(subKey)}
        </p>
      </motion.div>
    );
  }

  if (paymentStatus === 'succeeded') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h4 className="text-xl font-bold text-foreground mb-2">
          {t('checkout.statusOverlay.paymentSuccessful')}
        </h4>
        <p className="text-muted-foreground mb-4">
          {t('checkout.statusOverlay.enrolledSuccess')}
        </p>
        <Button
          variant="cta"
          onClick={() => {
            onSuccess();
            onOpenChange(false);
            navigate(`/courses/${courseId}/learn?welcome=1`);
          }}
        >
          <Sparkles className="w-4 h-4 me-2" />
          {t('checkout.statusOverlay.startLearningNow')}
        </Button>
      </motion.div>
    );
  }

  if (paymentStatus === 'failed') {
    const reason = localizedPaymentError || t('checkout.statusOverlay.paymentErrorFallback');
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 px-4 text-center"
        role="alert"
        aria-live="assertive"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <h4 className="text-xl font-bold text-foreground mb-2">
          {t('checkout.statusOverlay.paymentFailed')}
        </h4>
        <p className="mb-4 max-w-md text-sm text-muted-foreground leading-relaxed">
          {t('checkout.statusOverlay.noDeductionNotice')}
        </p>
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="w-full max-w-md mb-5 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 text-start"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-1">
            {t('checkout.statusOverlay.failureReasonLabel')}
          </p>
          <p className="text-sm font-medium text-foreground leading-relaxed break-words">
            {reason}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Button variant="cta" className="flex-1" onClick={onRetry}>
            {t('checkout.statusOverlay.tryAgain')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate(`/courses/${courseId}`);
            }}
          >
            {t('payment.backToCourse')}
          </Button>
        </div>
      </motion.div>
    );
  }

  return null;
});

CheckoutStatusOverlay.displayName = 'CheckoutStatusOverlay';

export default CheckoutStatusOverlay;
