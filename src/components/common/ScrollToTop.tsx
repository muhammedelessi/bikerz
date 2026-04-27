import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Reset stale scroll-locks left by Radix Dialog / Vaul Drawer.
 * These libraries add `data-scroll-locked` + inline `overflow:hidden`
 * to <html>/<body>. If a dialog unmounts without proper cleanup
 * (e.g. during route navigation), the lock can persist and block
 * all page scrolling.
 */
function clearStaleScrollLocks() {
  const html = document.documentElement;
  const body = document.body;

  // Radix uses data-scroll-locked="N" on <html>
  if (html.hasAttribute('data-scroll-locked')) {
    html.removeAttribute('data-scroll-locked');
  }

  // Remove any inline overflow:hidden left by scroll-lock libraries
  if (html.style.overflow === 'hidden') {
    html.style.removeProperty('overflow');
  }
  if (body.style.overflow === 'hidden') {
    body.style.removeProperty('overflow');
  }

  // Also clear margin-right that some scroll-lock libs add to compensate for scrollbar
  if (html.style.marginRight) {
    html.style.removeProperty('margin-right');
  }
  if (body.style.marginRight) {
    body.style.removeProperty('margin-right');
  }

  // Clear pointer-events if stuck
  if (body.style.pointerEvents === 'none') {
    body.style.removeProperty('pointer-events');
  }
}

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Clear any stale scroll locks from previous route's modals
    clearStaleScrollLocks();
    // Fire Meta Pixel PageView on SPA route change
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname]);

  // Safety: periodically check for orphaned scroll locks when no dialogs are open
  useEffect(() => {
    const isStuck = () => {
      const html = document.documentElement;
      const body = document.body;
      const hasLock = html.hasAttribute('data-scroll-locked');
      const bodyHidden = body.style.overflow === 'hidden';
      const bodyClicksDisabled = body.style.pointerEvents === 'none';
      return hasLock || bodyHidden || bodyClicksDisabled;
    };

    const hasLiveOverlay = () => {
      // Any open Radix Dialog, AlertDialog, Drawer, Vaul drawer, etc.
      return Boolean(
        document.querySelector('[data-state="open"][role="dialog"]') ||
          document.querySelector('[data-state="open"][role="alertdialog"]') ||
          document.querySelector('[vaul-drawer][data-state="open"]') ||
          document.querySelector('[data-radix-portal] [data-state="open"]'),
      );
    };

    const checkAndClear = () => {
      if (isStuck() && !hasLiveOverlay()) {
        clearStaleScrollLocks();
      }
    };

    // Periodic safety net (covers slow leaks)
    const checkInterval = setInterval(checkAndClear, 1000);

    // Reactive safety net: if the user clicks anywhere and the body is locked
    // without a real overlay, clear immediately so the click can take effect on
    // the next interaction. Capture-phase so we run before any handler.
    const onPointerDown = () => {
      // Run on the next tick so any legitimate dialog has a chance to register first
      setTimeout(checkAndClear, 0);
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true });

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('pointerdown', onPointerDown, { capture: true } as EventListenerOptions);
    };
  }, []);

  return null;
};

export default ScrollToTop;
