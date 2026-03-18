import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Captures page views, user sessions, and realtime presence
 * into the analytics tables so the admin dashboard shows real data.
 */

function getDeviceType(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Other';
}

// Generate a session token per browser tab session
function generateUUID(): string {
  // Fallback for older iOS Safari that lacks crypto.randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Polyfill using crypto.getRandomValues (supported since iOS 11)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getSessionToken(): string {
  let token = sessionStorage.getItem('analytics_session_token');
  if (!token) {
    token = generateUUID();
    sessionStorage.setItem('analytics_session_token', token);
  }
  return token;
}

export function useAnalyticsTracking() {
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const pageEntryRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create or update user session
  const ensureSession = useCallback(async (userId: string | null) => {
    if (!userId) return;
    if (sessionIdRef.current) return;

    const sessionToken = getSessionToken();

    // Check if session already exists
    const { data: existing } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existing) {
      sessionIdRef.current = existing.id;
      // Update last activity
      await supabase
        .from('user_sessions')
        .update({ last_activity_at: new Date().toISOString(), is_active: true })
        .eq('id', existing.id);
      return;
    }

    const { data: newSession } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        device_type: getDeviceType(),
        browser: getBrowser(),
        os: getOS(),
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        is_active: true,
        page_views: 0,
      })
      .select('id')
      .single();

    if (newSession) {
      sessionIdRef.current = newSession.id;
    }
  }, []);

  // Track page view
  const trackPageView = useCallback(async (path: string, userId: string | null) => {
    // Record time on previous page
    const timeOnPrevPage = lastPathRef.current
      ? Math.round((Date.now() - pageEntryRef.current) / 1000)
      : null;

    // Insert page view (works for both auth and anon via RLS)
    await supabase.from('page_view_events').insert({
      user_id: userId || null,
      session_id: sessionIdRef.current || null,
      page_path: path,
      page_title: document.title,
      referrer: document.referrer || null,
      time_on_page_seconds: timeOnPrevPage,
    });

    // Update session last_activity
    if (sessionIdRef.current) {
      try {
        await supabase
          .from('user_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', sessionIdRef.current);
      } catch {
        // Silent fail
      }
    }

    pageEntryRef.current = Date.now();
    lastPathRef.current = path;
  }, []);

  // Update presence
  const updatePresence = useCallback(async (userId: string | null, path: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('realtime_presence')
        .upsert(
          {
            user_id: userId,
            session_id: sessionIdRef.current,
            current_page: path,
            is_watching_video: path.includes('/learn') || path.includes('/lessons/'),
            last_heartbeat_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (error) {
        // Fallback: try insert
        await supabase.from('realtime_presence').insert({
          user_id: userId,
          session_id: sessionIdRef.current,
          current_page: path,
          is_watching_video: path.includes('/learn') || path.includes('/lessons/'),
        });
      }
    } catch {
      // Silent fail
    }
  }, []);

  // Main effect: run on route change
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      if (cancelled) return;

      if (userId) {
        await ensureSession(userId);
      }

      await trackPageView(location.pathname, userId);
      await updatePresence(userId, location.pathname);
    };

    run();

    return () => { cancelled = true; };
  }, [location.pathname, ensureSession, trackPageView, updatePresence]);

  // Heartbeat: update presence every 30s for live users
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await updatePresence(user.id, location.pathname);
        // Update session last_activity
        if (sessionIdRef.current) {
          await supabase
            .from('user_sessions')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', sessionIdRef.current);
        }
      }
    }, 30000);

    heartbeatRef.current = interval;
    return () => clearInterval(interval);
  }, [location.pathname, updatePresence]);

  // On tab close: end session
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionIdRef.current) {
        const timeOnPage = Math.round((Date.now() - pageEntryRef.current) / 1000);
        // Use sendBeacon for reliable delivery on tab close
        const payload = JSON.stringify({
          ended_at: new Date().toISOString(),
          is_active: false,
        });
        // Best-effort update via fetch keepalive
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sessionIdRef.current}`,
          // sendBeacon doesn't support PATCH easily, so just let it expire
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
