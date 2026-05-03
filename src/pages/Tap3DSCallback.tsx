import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * React-route fallback for Tap's 3-D Secure redirect.
 *
 * Mirrors the logic in `public/tap-3ds-callback.html` but lives behind
 * React Router so it ALSO catches the SPA-fallback case where the host
 * (or some redirect-chain hop) serves index.html for the callback URL.
 *
 * Why both exist:
 *  - The static HTML is preferred because it boots in <50 ms and runs the
 *    postMessage before React even loads, so the parent dismisses the
 *    iframe immediately.
 *  - The React route is a safety net for cases where the redirect chain
 *    drops the `.html` extension (Tap's `response.aspx` + BOP's bank
 *    gateway have been observed to do this), causing the iframe to land
 *    on `/tap-3ds-callback`. Without a matching route, React Router
 *    rendered NotFound — which is what the user reported as a 404 page
 *    inside the 3DS modal after submitting OTP.
 *
 * The component renders the same minimal "Verifying payment…" spinner so
 * the visual continuity is identical to the static file path.
 */
const Tap3DSCallback = () => {
  const [params] = useSearchParams();

  useEffect(() => {
    const tapId = params.get('tap_id') || '';
    const courseId = params.get('course') || '';
    const booking = params.get('booking') === '1';
    const bundle = params.get('bundle') === '1';
    const trainerCourseId = params.get('tc') || '';

    const msg = {
      type: 'TAP_3DS_COMPLETE',
      tap_id: tapId,
      course_id: courseId,
      booking,
      bundle,
      trainer_course_id: trainerCourseId,
    };

    // Three delivery modes — mirrors the static HTML callback exactly so
    // either entry point hands off identically to useTapPayment's listener.
    if (window.opener && !window.opener.closed) {
      // 1) Popup window flow (legacy desktop): tell the opener and close.
      window.opener.postMessage(msg, '*');
      setTimeout(() => {
        try {
          window.close();
        } catch {
          /* some browsers refuse window.close on cross-origin or non-popup
             windows — fall through silently, the parent will dismiss us */
        }
      }, 1500);
    } else if (window.parent && window.parent !== window) {
      // 2) Iframe flow (the common path): postMessage upward — useTapPayment
      // verifies the origin and finalises the charge.
      window.parent.postMessage(msg, '*');
    } else {
      // 3) Top-level navigation flow (the static HTML loaded directly,
      // e.g. mobile Safari blocking iframes): hard-redirect to the
      // appropriate finaliser route which performs the verify + insert.
      if (bundle && tapId) {
        window.location.href = `/payment-success?bundle=1&tap_id=${encodeURIComponent(tapId)}`;
      } else if (booking && trainerCourseId && tapId) {
        window.location.href = `/booking-payment-complete?tap_id=${encodeURIComponent(tapId)}&tc=${encodeURIComponent(trainerCourseId)}`;
      } else {
        window.location.href = `/payment-success?course=${encodeURIComponent(courseId)}&tap_id=${encodeURIComponent(tapId)}`;
      }
    }
  }, [params]);

  // Inline styles so we don't depend on any CSS chunk being loaded — this
  // page often renders inside an isolated iframe with the parent's CSS not
  // yet streamed, and we want the spinner visible immediately.
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        margin: 0,
        fontFamily: 'system-ui, sans-serif',
        background: '#0a0a0a',
        color: '#fff',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'tap3dsSpin .8s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ margin: 0 }}>Verifying payment…</p>
      </div>
      <style>{`@keyframes tap3dsSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Tap3DSCallback;
