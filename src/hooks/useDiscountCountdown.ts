import { useState, useEffect } from 'react';

interface CountdownResult {
  timeLeft: string; // "HH:MM:SS"
  isExpired: boolean;
  hasExpiry: boolean;
}

export const useDiscountCountdown = (expiresAt: string | null | undefined): CountdownResult => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return { timeLeft: '', isExpired: false, hasExpiry: false };

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { timeLeft: '00:00:00', isExpired: true, hasExpiry: true };

  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const timeLeft = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return { timeLeft, isExpired: false, hasExpiry: true };
};
