import { useMemo } from 'react';

export function usePaymentMethodDetection() {
  return useMemo(() => {
    const ua = navigator.userAgent;

    // Apple Pay: Safari on iOS/macOS
    const isAppleDevice = /Mac|iPhone|iPad|iPod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua) || /AppleWebKit/.test(ua) && !/Chrome/.test(ua);
    const supportsApplePay = isAppleDevice && (isSafari || /iPhone|iPad|iPod/.test(ua));

    // Google Pay: Android or Chrome (not Safari)
    const isAndroid = /Android/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
    const supportsGooglePay = isAndroid || (isChrome && !isAppleDevice);

    return {
      supportsApplePay,
      supportsGooglePay,
    };
  }, []);
}
