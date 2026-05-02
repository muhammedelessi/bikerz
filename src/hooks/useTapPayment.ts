import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { RecoverableTapSourceUsedError, createCharge, verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  chargeId: string | null;
  /** Tap 3-DS challenge URL — render in an in-page iframe (Option B custom UI). */
  challengeUrl: string | null;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  cancelChallenge: () => void;
  /** Re-poll Tap for the latest status of the current charge — used by the
   *  "still confirming" recovery UI so the user can recover without retrying
   *  a payment that may have actually succeeded. */
  recheckStatus: () => Promise<void>;
  /**
   * Surface a pre-charge failure (e.g. tokenize() rejected by Tap, browser
   * crashed mid-flow) into the same status-overlay infrastructure that the
   * post-charge `failed` state uses. Keeps the UX consistent: the user
   * always sees the same failure card with a localized reason and a
   * Retry CTA, no matter where in the funnel the error happened.
   */
  setExternalError: (message: string) => void;
  reset: () => void;
}

export function useTapPayment(): UseTapPaymentReturn {
  const { detectedCountry } = useCurrency();
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const statusRef = useRef<PaymentStatus>('idle');
  const chargeIdRef = useRef<string | null>(null);

  const updateStatus = useCallback((s: PaymentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const setChargeIdSafe = useCallback((cid: string | null) => {
    chargeIdRef.current = cid;
    setChargeId(cid);
  }, []);

  /**
   * Verify a charge with backoff. We treat exhausting the polling window as
   * "still processing" rather than "failed" — Tap may finalize the charge
   * after our last attempt, and showing "failed" here is what causes users
   * to retry and get double-charged. The recheckStatus() escape hatch lets
   * the recovery UI re-poll on demand.
   */
  const verifyCharge = useCallback(async (cid: string) => {
    updateStatus('verifying');
    try {
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const data = await verifyChargeOnce(cid);
        if (data?.status === 'succeeded') {
          updateStatus('succeeded');
          return;
        }
        if (data?.status === 'failed' || data?.status === 'cancelled') {
          setError((data as any)?.tap_message || (data as any)?.message || 'Payment was declined. Please try again.');
          updateStatus('failed');
          return;
        }
        if (attempt < maxAttempts - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      // Polling window exhausted — DO NOT mark as failed (would tempt the
      // user to pay again on a possibly-successful charge). Surface a
      // distinct "still confirming" state that the UI can render with a
      // refresh CTA instead of a retry CTA.
      setError(null);
      updateStatus('confirming');
    } catch (err: any) {
      setError(err.message || 'Payment verification failed');
      updateStatus('failed');
    }
  }, [updateStatus]);

  /**
   * Allow the recovery UI to re-poll the verify endpoint when the user clicks
   * "Refresh" on the "still confirming" state. Reuses the same backoff cap.
   */
  const recheckStatus = useCallback(async () => {
    const cid = chargeIdRef.current;
    if (!cid) return;
    await verifyCharge(cid);
  }, [verifyCharge]);

  // Listen for postMessage from the in-page 3-DS iframe.
  //
  // SECURITY: only accept messages from a same-host origin. We compare
  // `hostname` (not full origin) so that test environments (Lovable preview
  // proxying through `xxx.lovableproject.com` while the 3DS callback comes
  // back from `bikerz.lovable.app`) still work. Production checkout always
  // has callback + parent on `academy.bikerz.com` so this is still strict
  // enough to block cross-origin spoofing.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only react to TAP_3DS_COMPLETE messages — ignore everything else
      // (Lovable analytics, Sonner toasts, etc.) early so the security
      // log below isn't drowned in noise.
      if (event.data?.type !== 'TAP_3DS_COMPLETE') return;

      let parentHost = '';
      let messageHost = '';
      try {
        parentHost = new URL(window.location.href).hostname;
        messageHost = new URL(event.origin).hostname;
      } catch {
        /* malformed origin → reject */
      }
      if (!parentHost || !messageHost || parentHost !== messageHost) {
        // Log loudly so prod issues are diagnosable — silent rejects were the
        // cause of the user-reported "stuck on bank verification" bug.
        console.warn(
          '[TapPayment] Rejected 3DS callback from foreign origin:',
          event.origin,
          'expected hostname:', parentHost,
        );
        return;
      }

      const tapId = event.data.tap_id;
      console.log('[TapPayment] 3DS callback received, tap_id=', tapId);
      setChallengeUrl(null);
      if (tapId && typeof tapId === 'string' && tapId.startsWith('chg_')) {
        setChargeIdSafe(tapId);
        verifyCharge(tapId);
      } else {
        setError('Payment response missing. Please try again.');
        updateStatus('failed');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [verifyCharge, updateStatus, setChargeIdSafe]);

  // 3-DS watchdog: if the iframe is open longer than 3 minutes without
  // sending us a result, the user is almost certainly stuck on the bank's
  // page and won't recover without a nudge. Transition to "confirming"
  // (not "failed") because the charge MAY still settle — the
  // CheckoutStatusOverlay then shows a "Check status" / "Try again" CTA
  // instead of leaving the user with a hung modal and no message.
  useEffect(() => {
    if (status !== 'challenging_3ds') return;
    const id = setTimeout(() => {
      console.warn('[TapPayment] 3DS watchdog: no callback in 3 minutes, surfacing recovery UI');
      setChallengeUrl(null);
      const cid = chargeIdRef.current;
      if (cid) {
        // Re-poll Tap; it'll resolve to succeeded/failed/confirming.
        verifyCharge(cid);
      } else {
        setError('Bank verification timed out. Please try again.');
        updateStatus('failed');
      }
    }, 180_000);
    return () => clearTimeout(id);
  }, [status, verifyCharge, updateStatus]);

  const submitPayment = useCallback(async (config: TapPaymentConfig) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession?.access_token) {
      setError('Please sign in to make a payment');
      updateStatus('failed');
      return;
    }

    updateStatus('processing');
    setError(null);
    setChallengeUrl(null);

    try {
      const data: any = await createCharge(
        config,
        currentSession.access_token,
        currentSession.user.id,
        detectedCountry,
      );

      console.log('[TapPayment] createCharge response:', { status: data?.status, hasRedirect: !!data?.redirect_url, msg: data?.tap_message });
      setChargeIdSafe(data?.charge_id ?? null);

      if (data.status === 'succeeded') {
        updateStatus('succeeded');
        return;
      }

      // Immediate decline / cancel — surface our own branded failure overlay
      // instead of redirecting to Tap's hosted result page.
      if (data.status === 'failed' || data.status === 'cancelled') {
        setError(
          data.tap_message ||
            (config.isRTL ? 'تم رفض الدفع. يرجى المحاولة مرة أخرى.' : 'Payment was declined. Please try again.'),
        );
        updateStatus('failed');
        return;
      }

      if (data.redirect_url) {
        // Render Tap's 3-DS challenge inside our own modal iframe — user never
        // sees a Tap-hosted page; on completion the static callback page posts
        // back the tap_id and our overlay verifies + finishes the flow.
        setChallengeUrl(data.redirect_url);
        updateStatus('challenging_3ds');
      } else {
        setError('Payment gateway did not return a payment page.');
        updateStatus('failed');
      }
    } catch (err: any) {
      console.error('[TapPayment] error:', err);
      if (err instanceof RecoverableTapSourceUsedError) {
        updateStatus('idle');
        throw err;
      }
      setError(err.message || 'Payment failed. Please try again.');
      updateStatus('failed');
    }
  }, [detectedCountry, updateStatus, setChargeIdSafe]);

  const cancelChallenge = useCallback(() => {
    setChallengeUrl(null);
    setError(null);
    // Soft cancel — user closed the 3DS modal themselves. Reset to idle
    // instead of 'failed' so we don't show a harsh red error UI.
    updateStatus('idle');
  }, [updateStatus]);

  const reset = useCallback(() => {
    setChallengeUrl(null);
    setChargeIdSafe(null);
    updateStatus('idle');
    setError(null);
  }, [updateStatus, setChargeIdSafe]);

  const setExternalError = useCallback((message: string) => {
    setError(message || 'Payment failed. Please try again.');
    updateStatus('failed');
  }, [updateStatus]);

  return { status, error, chargeId, challengeUrl, submitPayment, cancelChallenge, recheckStatus, setExternalError, reset };
}
