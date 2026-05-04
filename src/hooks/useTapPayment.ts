import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { RecoverableTapSourceUsedError, createCharge, verifyChargeOnce } from '@/services/payment.service';
import type { PaymentStatus, TapPaymentConfig } from '@/types/payment';

/**
 * How long before we silently start polling Tap to find out what happened
 * to a 3DS challenge that hasn't fired its postMessage yet. Real bank flows
 * complete in 5–20 s after OTP submit; if we're past 15 s the iframe is
 * almost certainly stuck (cross-origin navigation blocked, popup eaten by
 * an in-app browser, etc.). Polling won't bother the user — we only flip
 * the status when Tap returns a definitive result.
 */
const POLL_START_AFTER_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
/**
 * Hard ceiling. After this we close the iframe and route to the recovery
 * UI ("still confirming" → refresh / try-again CTA). Tightened from 180 s
 * because users were giving up before the timeout kicked in — most stuck
 * bank flows don't recover after a minute regardless.
 */
const HARD_TIMEOUT_MS = 75_000;

/**
 * Translate a Tap charge response or thrown error into a clear bilingual
 * message. Tap returns generic "Payment was declined" for many distinct
 * causes (currency-not-allowed, card-declined, insufficient-funds, BIN-
 * blocked, …) — we surface what little signal we do have so the user
 * isn't left guessing why the charge failed.
 */
function friendlyChargeError(
  raw: unknown,
  isRTL: boolean,
  defaultStatus: 'failed' | 'cancelled' | string = 'failed',
): string {
  const obj =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const responseMsg = (obj.response && typeof obj.response === 'object'
    ? (obj.response as Record<string, unknown>).message
    : undefined) as string | undefined;
  const tapMessage =
    (obj.tap_message as string | undefined) ||
    (obj.message as string | undefined) ||
    responseMsg ||
    '';

  const code = (obj.code as string | undefined) || '';
  const text = `${tapMessage} ${code}`.toLowerCase();

  // Map common Tap reason codes to clear bilingual messages.
  if (text.includes('insufficient') || text.includes('insufficient_funds')) {
    return isRTL
      ? 'رصيد البطاقة غير كافٍ. الرجاء استخدام بطاقة أخرى أو شحن البطاقة.'
      : 'Insufficient funds on the card. Please try another card or top it up.';
  }
  if (text.includes('expired') || text.includes('card_expired')) {
    return isRTL
      ? 'البطاقة منتهية الصلاحية. الرجاء استخدام بطاقة سارية.'
      : 'This card has expired. Please use a different card.';
  }
  if (text.includes('do_not_honor') || text.includes('not_honor') || text.includes('declined_by_bank')) {
    return isRTL
      ? 'رفض البنك العملية. تواصل مع البنك أو استخدم بطاقة أخرى.'
      : 'Your bank declined the transaction. Contact the bank or try another card.';
  }
  if (text.includes('invalid_card') || text.includes('card_not_allowed') || text.includes('invalid card')) {
    return isRTL
      ? 'بيانات البطاقة غير صحيحة أو غير مدعومة. تأكد من الرقم وتاريخ الانتهاء وCVV.'
      : 'Card details are invalid or not supported. Re-check the number, expiry, and CVV.';
  }
  if (text.includes('currency_not_allowed') || text.includes('unsupported currency')) {
    return isRTL
      ? 'هذه العملة غير مدعومة لبطاقتك. استخدم بطاقة دولية أو غيّر العملة.'
      : 'Your card does not support this currency. Try an international card or switch currency.';
  }
  if (text.includes('3d') || text.includes('authentication_failed') || text.includes('auth_failed')) {
    return isRTL
      ? 'فشل التحقق ثلاثي الأبعاد. تأكد من رمز OTP أو حاول مرة أخرى.'
      : '3-D Secure authentication failed. Re-check the OTP or try again.';
  }
  if (text.includes('cancelled') || text.includes('canceled') || defaultStatus === 'cancelled') {
    return isRTL
      ? 'تم إلغاء العملية.'
      : 'Transaction was cancelled.';
  }
  if (text.includes('timeout') || text.includes('timed out')) {
    return isRTL
      ? 'انتهت مهلة العملية. الرجاء المحاولة مرة أخرى.'
      : 'The transaction timed out. Please try again.';
  }
  if (tapMessage) return tapMessage;
  return isRTL
    ? 'تم رفض الدفع. الرجاء المحاولة مرة أخرى أو استخدام بطاقة مختلفة.'
    : 'Payment was declined. Please try again or use a different card.';
}

export type { PaymentMethod, PaymentStatus, TapPaymentConfig } from '@/types/payment';

interface UseTapPaymentReturn {
  status: PaymentStatus;
  error: string | null;
  chargeId: string | null;
  /** Tap 3-DS challenge URL — render in an in-page iframe (Option B custom UI). */
  challengeUrl: string | null;
  submitPayment: (config: TapPaymentConfig) => Promise<void>;
  cancelChallenge: () => Promise<void>;
  /**
   * Parents register their card-form `reinit()` here so cancelChallenge can
   * automatically force a fresh card iframe + token on cancel. Without this
   * the user clicks Pay → 3DS → Cancel → Pay-again, and Tap rejects the
   * second attempt with error 1126 "Source already used" (the existing
   * recovery path catches that, but the user briefly sees a flicker
   * + retry; calling reinit on cancel makes the next attempt clean).
   */
  registerCardReinit: (fn: (() => void) | null) => void;
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

  /** Card-form reinit hook (registered by the parent via registerCardReinit). */
  const cardReinitRef = useRef<(() => void) | null>(null);
  const registerCardReinit = useCallback((fn: (() => void) | null) => {
    cardReinitRef.current = fn;
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
          const isRTL =
            typeof document !== 'undefined' &&
            document.documentElement.getAttribute('dir') === 'rtl';
          setError(friendlyChargeError(data, isRTL, data.status));
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
      const isRTL =
        typeof document !== 'undefined' &&
        document.documentElement.getAttribute('dir') === 'rtl';
      setError(friendlyChargeError(err, isRTL));
      updateStatus('failed');
    }
  }, [updateStatus]);

  /**
   * Allow the recovery UI to re-poll the verify endpoint when the user clicks
   * "Refresh" on the "still confirming" state — and also for the new "Verify
   * Status Now" button in the 3DS modal's stuck hint.
   *
   * Clearing challengeUrl is critical: when the user clicks Verify Now the
   * iframe is the thing that's stuck (cross-origin redirect blocked). We need
   * to dismiss it before flipping to 'verifying'/'succeeded'/'failed', or
   * the modal would stay overlaid on top of whichever recovery UI we surface.
   */
  const recheckStatus = useCallback(async () => {
    const cid = chargeIdRef.current;
    if (!cid) return;
    setChallengeUrl(null);
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

  // 3-DS watchdog with active polling.
  //
  // The original watchdog waited the full 3 minutes before doing anything,
  // which left users staring at a stuck spinner whenever the iframe failed
  // to relay its result back to us (cross-origin navigation blocked,
  // in-app browser limitations, the bank's pageClosed handler crashing,
  // etc.). The fix: silently start polling Tap directly at the 30 s mark.
  //
  //   t = 0        challenge_3ds opens
  //   t = 30 s     start polling /verify-charge every 5 s in the background
  //   on success   close iframe, transition to 'succeeded'
  //   on failure   close iframe, transition to 'failed' with a clear reason
  //   t = 180 s    give up, surface the "still confirming" recovery UI
  //
  // Polling is silent (no UI change) until Tap returns a definitive status
  // — the user keeps seeing the iframe in case the legitimate flow recovers.
  useEffect(() => {
    if (status !== 'challenging_3ds') return;

    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    // Start the silent poll at +30 s.
    const pollStartTimer = setTimeout(() => {
      if (stopped) return;
      const cid = chargeIdRef.current;
      if (!cid) return;
      console.info('[TapPayment] 3DS still pending after 30s — starting silent poll');
      pollIntervalId = setInterval(async () => {
        if (stopped) return;
        try {
          const data = await verifyChargeOnce(cid);
          if (stopped) return;
          if (data?.status === 'succeeded') {
            console.info('[TapPayment] poll caught succeeded charge — closing iframe');
            stopped = true;
            if (pollIntervalId) clearInterval(pollIntervalId);
            setChallengeUrl(null);
            updateStatus('succeeded');
            return;
          }
          if (data?.status === 'failed' || data?.status === 'cancelled') {
            console.info('[TapPayment] poll caught', data.status, '— closing iframe');
            stopped = true;
            if (pollIntervalId) clearInterval(pollIntervalId);
            const isRTL =
              typeof document !== 'undefined' &&
              document.documentElement.getAttribute('dir') === 'rtl';
            setError(friendlyChargeError(data, isRTL, data.status));
            setChallengeUrl(null);
            updateStatus('failed');
          }
          // initiated / processing → keep polling, don't change UI
        } catch (e) {
          // Network blip; let the next tick try again. The hard timeout
          // below will give up if it never recovers.
          console.warn('[TapPayment] poll tick failed (will retry):', e);
        }
      }, POLL_INTERVAL_MS);
    }, POLL_START_AFTER_MS);

    // Hard ceiling: at +3 minutes give up the iframe and surface the
    // recovery UI ("still confirming"). The charge may yet settle — we
    // want the user to be able to refresh, not retry.
    const hardTimeoutId = setTimeout(() => {
      if (stopped) return;
      stopped = true;
      if (pollIntervalId) clearInterval(pollIntervalId);
      console.warn('[TapPayment] 3DS hard timeout — surfacing recovery UI');
      setChallengeUrl(null);
      const cid = chargeIdRef.current;
      if (cid) {
        verifyCharge(cid);
      } else {
        const isRTL =
          typeof document !== 'undefined' &&
          document.documentElement.getAttribute('dir') === 'rtl';
        setError(
          isRTL
            ? 'انتهت مهلة التحقق من البنك. الرجاء المحاولة مرة أخرى.'
            : 'Bank verification timed out. Please try again.',
        );
        updateStatus('failed');
      }
    }, HARD_TIMEOUT_MS);

    return () => {
      stopped = true;
      clearTimeout(pollStartTimer);
      clearTimeout(hardTimeoutId);
      if (pollIntervalId) clearInterval(pollIntervalId);
    };
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
      // Robust recoverable-error detection. We can't rely on `instanceof`
      // alone because Vite's HMR sometimes hands us a freshly-evaluated copy
      // of the class while the thrown error was constructed from the OLD
      // module — same shape, different identity, and `instanceof` is false.
      // Fall back to inspecting `name`, `code`, and the message text so the
      // recovery path always fires for Tap error 1126 regardless of HMR
      // module identity.
      const isRecoverable =
        err instanceof RecoverableTapSourceUsedError ||
        err?.name === 'RecoverableTapSourceUsedError' ||
        err?.code === '1126' ||
        /source\s+already\s+used|create\s+the\s+new\s+source/i.test(err?.message ?? '');

      if (isRecoverable) {
        console.info('[TapPayment] Retokenizing after Tap rejected a previously used source');
        setError(null);
        updateStatus('idle');
        throw err;
      }
      console.error('[TapPayment] error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      updateStatus('failed');
    }
  }, [detectedCountry, updateStatus, setChargeIdSafe]);

  const cancelChallenge = useCallback(async () => {
    const isRTL =
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('dir') === 'rtl';
    setChallengeUrl(null);
    setError(null);

    // Defensive verify: in rare cases the bank actually completed the
    // charge but our iframe couldn't relay the result (cross-origin block,
    // in-app browser, etc.) and the user clicks Cancel believing nothing
    // happened. Ask Tap directly so we don't tell the user "no charge
    // made" when one did go through.
    const cid = chargeIdRef.current;
    if (cid) {
      try {
        const data = await verifyChargeOnce(cid);
        if (data?.status === 'succeeded') {
          // Charge already went through — surface success instead of cancel.
          updateStatus('succeeded');
          toast.success(
            isRTL
              ? 'تم الدفع بنجاح! جاري التحويل…'
              : 'Payment succeeded! Redirecting…',
          );
          return;
        }
        if (data?.status === 'failed') {
          setError(friendlyChargeError(data, isRTL, 'failed'));
          updateStatus('failed');
          toast.error(
            isRTL
              ? 'تم رفض العملية من البنك.'
              : 'The bank declined the transaction.',
          );
          return;
        }
        // 'initiated' / 'cancelled' / unknown → treat as a clean cancel.
      } catch (e) {
        // Verify failed; continue with the silent-cancel path. The user
        // can retry; if a charge did sneak through, the next attempt's
        // duplicate-check would still surface it.
        console.warn('[TapPayment] cancelChallenge verify failed (proceeding as cancelled):', e);
      }
    }

    // Soft cancel — user closed the 3DS modal themselves. Reset to idle
    // (not 'failed') so the parent can show its normal card form again
    // without a red error overlay. The toast tells the user nothing was
    // charged and they can retry — that's the missing feedback they were
    // seeing as silent.
    setChargeIdSafe(null);
    updateStatus('idle');
    // Force a fresh card iframe + token so the next Pay click doesn't
    // bump into Tap error 1126 "Source already used". This is the silent
    // fix to "the form doesn't reset to accept another payment".
    try {
      cardReinitRef.current?.();
    } catch (e) {
      console.warn('[TapPayment] cardReinit on cancel failed:', e);
    }
    toast.info(
      isRTL
        ? 'تم إلغاء عملية الدفع — لم يُخصم أي مبلغ من بطاقتك.'
        : 'Payment cancelled — no amount was charged to your card.',
      { duration: 5000 },
    );
  }, [updateStatus, setChargeIdSafe]);

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

  return { status, error, chargeId, challengeUrl, submitPayment, cancelChallenge, recheckStatus, setExternalError, reset, registerCardReinit };
}
