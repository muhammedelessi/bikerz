import React, { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, Sparkles, RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import type { PaymentStatus } from '@/types/payment';
import { translateTapPaymentDisplayError } from '@/lib/userFacingServerMessages';
import PaymentProgressSteps from '@/components/checkout/PaymentProgressSteps';
import CheckoutWhatsAppHelp from '@/components/checkout/CheckoutWhatsAppHelp';

interface CheckoutStatusOverlayProps {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  courseId: string;
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  /** Called by the "Refresh" button on the `confirming` state to re-poll Tap. */
  onRecheck?: () => Promise<void>;
  navigate: (path: string) => void;
}

const CheckoutStatusOverlay: React.FC<CheckoutStatusOverlayProps> = memo(({
  paymentStatus,
  paymentError,
  courseId,
  onSuccess,
  onOpenChange,
  onRetry,
  onRecheck,
  navigate,
}) => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const [rechecking, setRechecking] = useState(false);
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
        className="flex flex-col items-center justify-center px-4 py-10 text-center gap-1"
        role="status"
        aria-live="polite"
      >
        <h4 className="text-lg font-bold text-foreground mb-1">
          {t(titleKey)}
        </h4>
        <p className="text-sm text-muted-foreground mb-5">
          {t(subKey)}
        </p>
        {/* Stepped progress replaces the lonely spinner — gives users
            concrete forward motion so they're less likely to abandon
            during the slow bank-confirmation step. */}
        <PaymentProgressSteps paymentStatus={paymentStatus} isRTL={isRTL} />
        {/* WhatsApp help — only shows on slow charges (after 8s) so we
            don't distract during the fast happy path. */}
        <div className="mt-5">
          <CheckoutWhatsAppHelp
            context="processing"
            delayMs={8000}
            courseId={courseId}
          />
        </div>
      </motion.div>
    );
  }

  /**
   * `confirming` — verification polling exhausted. The charge MAY have
   * succeeded but Tap hasn't confirmed yet. CRITICAL: do NOT show "Try Again"
   * here — the user could double-pay on a charge that's about to succeed.
   * Instead show a "Refresh" CTA that re-polls verifyCharge.
   */
  if (paymentStatus === 'confirming') {
    const handleRefresh = async () => {
      if (!onRecheck || rechecking) return;
      setRechecking(true);
      try {
        await onRecheck();
      } finally {
        setRechecking(false);
      }
    };
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 px-4 text-center"
        role="status"
        aria-live="polite"
      >
        <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h4 className="text-xl font-bold text-foreground mb-2">
          {t('checkout.statusOverlay.confirmingTitle')}
        </h4>
        <p className="mb-5 max-w-md text-sm text-muted-foreground leading-relaxed">
          {t('checkout.statusOverlay.confirmingBody')}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
          <Button variant="cta" className="flex-1" onClick={handleRefresh} disabled={rechecking}>
            {rechecking ? (
              <Loader2 className="w-4 h-4 animate-spin me-2" />
            ) : (
              <RefreshCw className="w-4 h-4 me-2" />
            )}
            {t('checkout.statusOverlay.refreshStatus')}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              onOpenChange(false);
              navigate(`/courses/${courseId}`);
            }}
          >
            {isRTL ? 'العودة لاحقاً' : 'Check later'}
          </Button>
        </div>
        <div className="mt-4">
          <CheckoutWhatsAppHelp context="confirming" courseId={courseId} />
        </div>
      </motion.div>
    );
  }

  if (paymentStatus === 'succeeded') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-8 text-center"
        role="status"
        aria-live="assertive"
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
        <div className="mt-4">
          <CheckoutWhatsAppHelp context="failed" reason={reason} courseId={courseId} />
        </div>
      </motion.div>
    );
  }

  return null;
});

CheckoutStatusOverlay.displayName = 'CheckoutStatusOverlay';

export default CheckoutStatusOverlay;
